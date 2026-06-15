use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use gilrs::{Axis, Button, EventType, Gamepad, GamepadId, Gilrs};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::profiles::{
    device_identity, match_profile, profile_by_id, profile_info, ControllerFamily,
    ControllerProfile, DeviceIdentity, ProfileId, ProfileInfo, RawButtonCode, TriggerAxisMode,
    UnsupportedDevice,
};
use crate::settings::{AppSettings, InputSettings, SimulationScenario};
use crate::window_control::MAIN_WINDOW;
use crate::xinput::{XInputPoller, XInputSnapshot};

const POLL_INTERVAL: Duration = Duration::from_millis(8);
/// Polling cadence while nothing is connected; keeps idle CPU usage low and
/// only delays first detection by at most this interval.
const NO_DEVICE_POLL_INTERVAL: Duration = Duration::from_millis(120);
/// Polling cadence while the overlay window is hidden. Input is still drained so
/// gilrs never overflows and connect/disconnect events keep flowing, but there
/// is no point emitting snapshots to an invisible webview at full rate.
const HIDDEN_POLL_INTERVAL: Duration = Duration::from_millis(200);
const IDLE_SNAPSHOT_INTERVAL: Duration = Duration::from_millis(250);
/// Snapshots are coalesced to at most ~60 per second; the poll loop still runs
/// at full rate so no input edge is lost, only the IPC emission is throttled.
const SNAPSHOT_EMIT_MIN_INTERVAL: Duration = Duration::from_millis(16);
const INPUT_EVENT_EMIT_INTERVAL: Duration = Duration::from_millis(90);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerSnapshot {
    pub status: ControllerStatus,
    pub connected: bool,
    pub id: Option<String>,
    pub name: Option<String>,
    pub device: Option<DeviceIdentity>,
    pub profile: Option<ProfileInfo>,
    pub unsupported: Option<UnsupportedDevice>,
    pub buttons: ControllerButtons,
    pub axes: ControllerAxes,
    pub updated_at_ms: u128,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ControllerStatus {
    NoDevice,
    Active,
    Unsupported,
    Simulated,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerButtons {
    pub south: f32,
    pub east: f32,
    pub west: f32,
    pub north: f32,
    pub left_bumper: f32,
    pub right_bumper: f32,
    pub left_trigger_button: f32,
    pub right_trigger_button: f32,
    pub select: f32,
    pub start: f32,
    pub mode: f32,
    pub left_thumb: f32,
    pub right_thumb: f32,
    pub dpad_up: f32,
    pub dpad_down: f32,
    pub dpad_left: f32,
    pub dpad_right: f32,
    pub misc1: f32,
    pub paddle1: f32,
    pub paddle2: f32,
    pub paddle3: f32,
    pub paddle4: f32,
    pub touchpad: f32,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerAxes {
    pub left_stick_x: f32,
    pub left_stick_y: f32,
    pub right_stick_x: f32,
    pub right_stick_y: f32,
    pub left_trigger: f32,
    pub right_trigger: f32,
    pub dpad_x: f32,
    pub dpad_y: f32,
}

pub fn spawn_controller_poll(app: AppHandle, settings: Arc<Mutex<AppSettings>>) {
    thread::spawn(move || {
        let started_at = Instant::now();
        let mut gilrs = match Gilrs::new() {
            Ok(gilrs) => gilrs,
            Err(error) => {
                emit_or_log(
                    &app,
                    "controller-error",
                    format!("failed to initialize gamepad input: {error}"),
                );
                return;
            }
        };

        let mut last_emit = Instant::now() - IDLE_SNAPSHOT_INTERVAL;
        let mut last_input_event_emit = Instant::now() - INPUT_EVENT_EMIT_INTERVAL;
        let mut last_simulated_connected: Option<bool> = None;
        let mut last_active_gamepad: Option<GamepadId> = None;
        let mut pending_emit = false;
        let mut anything_connected = true;
        let mut was_visible = true;
        let mut xinput = XInputPoller::new();
        loop {
            let settings_snapshot = match settings.lock() {
                Ok(guard) => guard.clone(),
                Err(_) => {
                    emit_or_log(
                        &app,
                        "controller-error",
                        "settings lock is poisoned; controller polling stopped",
                    );
                    return;
                }
            };

            // The overlay only consumes snapshots while it is visible. When the
            // user hides it from the tray we keep draining input but stop the
            // high-rate IPC, then force a fresh snapshot the moment it returns.
            let window_visible = main_window_visible(&app);
            if window_visible && !was_visible {
                pending_emit = true;
            }
            was_visible = window_visible;

            let mut changed = false;
            while let Some(event) = gilrs.next_event() {
                changed = true;
                last_active_gamepad = Some(event.id);
                if matches!(event.event, EventType::Connected | EventType::Disconnected) {
                    emit_or_log(
                        &app,
                        "controller-device-event",
                        format!("{:?}", event.event),
                    );
                }
                if let Some(message) = input_event_message(&event.event) {
                    let is_button_event = matches!(
                        event.event,
                        EventType::ButtonPressed(..)
                            | EventType::ButtonReleased(..)
                            | EventType::ButtonRepeated(..)
                            | EventType::ButtonChanged(..)
                    );
                    if is_button_event
                        || last_input_event_emit.elapsed() >= INPUT_EVENT_EMIT_INTERVAL
                    {
                        emit_or_log(&app, "controller-device-event", message);
                        last_input_event_emit = Instant::now();
                    }
                }
            }

            let xinput_poll = if settings_snapshot.simulation.enabled {
                None
            } else {
                Some(xinput.poll(&settings_snapshot.input))
            };

            if let Some(poll) = &xinput_poll {
                changed |= poll.changed;
                for event in &poll.events {
                    emit_or_log(&app, "controller-device-event", event.clone());
                }
            }

            // Simulation animates continuously, so it always has fresh data.
            if changed || settings_snapshot.simulation.enabled {
                pending_emit = true;
            }

            if window_visible
                && ((pending_emit && last_emit.elapsed() >= SNAPSHOT_EMIT_MIN_INTERVAL)
                    || last_emit.elapsed() >= IDLE_SNAPSHOT_INTERVAL)
            {
                let elapsed_ms = started_at.elapsed().as_millis();
                let snapshot = if settings_snapshot.simulation.enabled {
                    let snapshot = build_simulated_snapshot(&settings_snapshot, elapsed_ms);
                    if matches!(
                        settings_snapshot.simulation.scenario,
                        SimulationScenario::HotPlug
                    ) {
                        if last_simulated_connected != Some(snapshot.connected) {
                            let event = if snapshot.connected {
                                "SimulatedConnected"
                            } else {
                                "SimulatedDisconnected"
                            };
                            emit_or_log(&app, "controller-device-event", event.to_string());
                            last_simulated_connected = Some(snapshot.connected);
                        }
                    } else {
                        last_simulated_connected = None;
                    }
                    snapshot
                } else {
                    last_simulated_connected = None;
                    build_hardware_snapshot(
                        &gilrs,
                        &settings_snapshot,
                        xinput_poll.as_ref().and_then(|poll| poll.active.as_ref()),
                        last_active_gamepad,
                        elapsed_ms,
                    )
                };
                anything_connected = snapshot.connected;
                emit_or_log(&app, "controller-state", snapshot);
                last_emit = Instant::now();
                pending_emit = false;
            }

            let sleep_interval = if !window_visible {
                HIDDEN_POLL_INTERVAL
            } else if anything_connected || pending_emit || settings_snapshot.simulation.enabled {
                POLL_INTERVAL
            } else {
                NO_DEVICE_POLL_INTERVAL
            };
            thread::sleep(sleep_interval);
        }
    });
}

/// Reports whether the overlay window is currently visible. Defaults to `true`
/// when the window handle or its state cannot be read, so polling never stalls
/// on an unexpected error.
fn main_window_visible(app: &AppHandle) -> bool {
    app.get_webview_window(MAIN_WINDOW)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(true)
}

fn build_hardware_snapshot(
    gilrs: &Gilrs,
    settings: &AppSettings,
    xinput: Option<&XInputSnapshot>,
    preferred_gamepad: Option<GamepadId>,
    updated_at_ms: u128,
) -> ControllerSnapshot {
    // Prefer the most recently active gamepad so that with several connected
    // controllers the overlay follows the one actually being used, matching
    // the XInput poller's behavior.
    let active = preferred_gamepad
        .map(|id| (id, gilrs.gamepad(id)))
        .filter(|(_, gamepad)| gamepad.is_connected())
        .or_else(|| gilrs.gamepads().find(|(_, gamepad)| gamepad.is_connected()));

    if let Some((id, gamepad)) = active {
        let identity = device_identity(id, &gamepad);
        match match_profile(&identity) {
            Ok(profile) => {
                if let Some(xinput) = xinput.filter(|_| should_read_profile_from_xinput(&profile)) {
                    return xinput_hardware_snapshot(
                        xinput,
                        Some(identity),
                        Some(profile_info(&profile)),
                        updated_at_ms,
                    );
                }

                match read_controller_state(&gamepad, &profile, &settings.input) {
                    Ok((buttons, axes)) => ControllerSnapshot {
                        status: ControllerStatus::Active,
                        connected: true,
                        id: Some(identity.id.clone()),
                        name: Some(identity.name.clone()),
                        device: Some(identity),
                        profile: Some(profile_info(&profile)),
                        unsupported: None,
                        buttons,
                        axes,
                        updated_at_ms,
                    },
                    Err(reason) => unsupported_snapshot(
                        identity,
                        Some(profile_info(&profile)),
                        reason,
                        updated_at_ms,
                    ),
                }
            }
            Err(unsupported) => {
                if let Some(xinput) = xinput {
                    xinput_hardware_snapshot(xinput, None, None, updated_at_ms)
                } else {
                    ControllerSnapshot {
                        status: ControllerStatus::Unsupported,
                        connected: true,
                        id: Some(identity.id.clone()),
                        name: Some(identity.name.clone()),
                        device: Some(identity),
                        profile: None,
                        unsupported: Some(unsupported),
                        buttons: ControllerButtons::default(),
                        axes: ControllerAxes::default(),
                        updated_at_ms,
                    }
                }
            }
        }
    } else if let Some(xinput) = xinput {
        xinput_hardware_snapshot(xinput, None, None, updated_at_ms)
    } else {
        empty_snapshot(updated_at_ms)
    }
}

fn should_read_profile_from_xinput(profile: &ControllerProfile) -> bool {
    matches!(
        profile.family,
        ControllerFamily::Xbox | ControllerFamily::XInput
    )
}

fn xinput_hardware_snapshot(
    xinput: &XInputSnapshot,
    preferred_identity: Option<DeviceIdentity>,
    preferred_profile: Option<ProfileInfo>,
    updated_at_ms: u128,
) -> ControllerSnapshot {
    let mut identity = preferred_identity.unwrap_or_else(|| xinput.identity.clone());
    identity.xinput = Some(xinput.device.clone());
    if identity.xinput_driver.is_none() {
        identity.xinput_driver = xinput.identity.xinput_driver.clone();
    }

    ControllerSnapshot {
        status: ControllerStatus::Active,
        connected: true,
        id: Some(identity.id.clone()),
        name: Some(identity.name.clone()),
        device: Some(identity),
        profile: Some(preferred_profile.unwrap_or_else(|| xinput.profile.clone())),
        unsupported: None,
        buttons: xinput.buttons.clone(),
        axes: xinput.axes.clone(),
        updated_at_ms,
    }
}

fn emit_or_log<T>(app: &AppHandle, event: &str, payload: T)
where
    T: Serialize + Clone,
{
    if let Err(error) = app.emit(event, payload) {
        eprintln!("Failed to emit {event}: {error}");
    }
}

fn read_controller_state(
    gamepad: &Gamepad<'_>,
    profile: &crate::profiles::ControllerProfile,
    settings: &InputSettings,
) -> Result<(ControllerButtons, ControllerAxes), String> {
    let map = profile.input_map;
    let transform = profile.transform;

    let left_stick_x = apply_stick_axis(
        required_axis_value(gamepad, map.left_stick_x, "left_stick_x", 0.0)?,
        settings.left_stick_deadzone,
        settings.stick_sensitivity,
        false,
    );
    let left_stick_y = apply_stick_axis(
        required_axis_value(gamepad, map.left_stick_y, "left_stick_y", 0.0)?,
        settings.left_stick_deadzone,
        settings.stick_sensitivity,
        settings.invert_left_y ^ transform.invert_left_y,
    );
    let right_stick_x = apply_stick_axis(
        required_axis_value(gamepad, map.right_stick_x, "right_stick_x", 0.0)?,
        settings.right_stick_deadzone,
        settings.stick_sensitivity,
        false,
    );
    let right_stick_y = apply_stick_axis(
        required_axis_value(gamepad, map.right_stick_y, "right_stick_y", 0.0)?,
        settings.right_stick_deadzone,
        settings.stick_sensitivity,
        settings.invert_right_y ^ transform.invert_right_y,
    );

    let left_trigger_button =
        configured_button_value(gamepad, map.left_trigger_button).unwrap_or(0.0);
    let right_trigger_button =
        configured_button_value(gamepad, map.right_trigger_button).unwrap_or(0.0);
    let left_trigger = trigger_value(
        gamepad,
        TriggerSources {
            axis: map.left_trigger_axis,
            button: map.left_trigger_button,
            mode: transform.left_trigger_axis_mode,
        },
        "left_trigger",
        settings.trigger_deadzone,
        settings.trigger_sensitivity,
    )?;
    let right_trigger = trigger_value(
        gamepad,
        TriggerSources {
            axis: map.right_trigger_axis,
            button: map.right_trigger_button,
            mode: transform.right_trigger_axis_mode,
        },
        "right_trigger",
        settings.trigger_deadzone,
        settings.trigger_sensitivity,
    )?;

    let dpad_x = match optional_axis_value(gamepad, map.dpad_x, "dpad_x")? {
        Some(value) => apply_stick_axis(value, 0.01, 1.0, false),
        None => 0.0,
    };
    let dpad_y = match optional_axis_value(gamepad, map.dpad_y, "dpad_y")? {
        Some(value) => apply_stick_axis(
            value,
            0.01,
            1.0,
            settings.invert_dpad_y ^ transform.invert_dpad_y,
        ),
        None => 0.0,
    };
    let extra_buttons = map.extra_buttons;

    Ok((
        ControllerButtons {
            south: required_button_value(gamepad, map.south, "south")?,
            east: required_button_value(gamepad, map.east, "east")?,
            west: required_button_value(gamepad, map.west, "west")?,
            north: required_button_value(gamepad, map.north, "north")?,
            left_bumper: required_button_value(gamepad, map.left_bumper, "left_bumper")?,
            right_bumper: required_button_value(gamepad, map.right_bumper, "right_bumper")?,
            left_trigger_button,
            right_trigger_button,
            select: required_button_value(gamepad, map.select, "select")?,
            start: required_button_value(gamepad, map.start, "start")?,
            mode: required_button_value(gamepad, map.mode, "mode")?,
            left_thumb: required_button_value(gamepad, map.left_thumb, "left_thumb")?,
            right_thumb: required_button_value(gamepad, map.right_thumb, "right_thumb")?,
            dpad_up: required_button_value(gamepad, map.dpad_up, "dpad_up")?,
            dpad_down: required_button_value(gamepad, map.dpad_down, "dpad_down")?,
            dpad_left: required_button_value(gamepad, map.dpad_left, "dpad_left")?,
            dpad_right: required_button_value(gamepad, map.dpad_right, "dpad_right")?,
            misc1: optional_raw_button_value(gamepad, extra_buttons.misc1),
            paddle1: optional_raw_button_value(gamepad, extra_buttons.paddle1),
            paddle2: optional_raw_button_value(gamepad, extra_buttons.paddle2),
            paddle3: optional_raw_button_value(gamepad, extra_buttons.paddle3),
            paddle4: optional_raw_button_value(gamepad, extra_buttons.paddle4),
            touchpad: optional_raw_button_value(gamepad, extra_buttons.touchpad),
        },
        ControllerAxes {
            left_stick_x,
            left_stick_y,
            right_stick_x,
            right_stick_y,
            left_trigger,
            right_trigger,
            dpad_x,
            dpad_y,
        },
    ))
}

fn build_simulated_snapshot(settings: &AppSettings, updated_at_ms: u128) -> ControllerSnapshot {
    let profile_id = ProfileId::from_str(&settings.simulation.profile_id);
    let Some(profile_id) = profile_id else {
        return ControllerSnapshot {
            status: ControllerStatus::Unsupported,
            connected: true,
            id: Some("simulation".to_string()),
            name: Some("Invalid simulation profile".to_string()),
            device: None,
            profile: None,
            unsupported: Some(UnsupportedDevice {
                reason: format!(
                    "Simulation profile '{}' is not registered.",
                    settings.simulation.profile_id
                ),
                identity: simulated_identity("Invalid simulation profile"),
            }),
            buttons: ControllerButtons::default(),
            axes: ControllerAxes::default(),
            updated_at_ms,
        };
    };

    let profile = match profile_by_id(profile_id) {
        Ok(profile) => profile,
        Err(unsupported) => {
            return ControllerSnapshot {
                status: ControllerStatus::Unsupported,
                connected: true,
                id: Some("simulation".to_string()),
                name: Some("Invalid simulation profile".to_string()),
                device: None,
                profile: None,
                unsupported: Some(unsupported),
                buttons: ControllerButtons::default(),
                axes: ControllerAxes::default(),
                updated_at_ms,
            };
        }
    };

    let seconds = updated_at_ms as f32 / 1000.0;

    if matches!(settings.simulation.scenario, SimulationScenario::HotPlug) {
        let connected = (seconds as u64 / 3) % 2 == 0;
        if !connected {
            return empty_snapshot(updated_at_ms);
        }
    }

    let phase = seconds * std::f32::consts::TAU * 0.24;
    let mut buttons = ControllerButtons::default();
    let mut axes = ControllerAxes::default();

    match settings.simulation.scenario {
        SimulationScenario::Sweep => {
            axes.left_stick_x = phase.sin();
            axes.left_stick_y = phase.cos();
            axes.right_stick_x = (phase * 1.4).sin();
            axes.right_stick_y = (phase * 1.4).cos();
            axes.left_trigger = positive_wave(seconds, 0.55);
            axes.right_trigger = positive_wave(seconds + 0.8, 0.55);
            buttons.south = pulsed(seconds, 0.0);
            buttons.east = pulsed(seconds, 0.35);
            buttons.west = pulsed(seconds, 0.7);
            buttons.north = pulsed(seconds, 1.05);
            buttons.left_bumper = pulsed(seconds, 1.4);
            buttons.right_bumper = pulsed(seconds, 1.75);
            buttons.dpad_up = pulsed(seconds, 2.1);
            buttons.dpad_right = pulsed(seconds, 2.45);
            buttons.dpad_down = pulsed(seconds, 2.8);
            buttons.dpad_left = pulsed(seconds, 3.15);
            apply_simulated_extra_buttons(profile.id, seconds, &mut buttons);
        }
        SimulationScenario::Buttons => {
            let slot = ((seconds * 3.0) as u32) % simulated_button_slot_count(profile.id);
            match slot {
                0 => buttons.south = 1.0,
                1 => buttons.east = 1.0,
                2 => buttons.west = 1.0,
                3 => buttons.north = 1.0,
                4 => buttons.left_bumper = 1.0,
                5 => buttons.right_bumper = 1.0,
                6 => buttons.select = 1.0,
                7 => buttons.start = 1.0,
                8 => buttons.left_thumb = 1.0,
                9 => buttons.right_thumb = 1.0,
                10 => buttons.mode = 1.0,
                11 => buttons.dpad_up = 1.0,
                12 => buttons.touchpad = 1.0,
                13 => buttons.misc1 = 1.0,
                _ => buttons.dpad_up = 1.0,
            }
        }
        SimulationScenario::Triggers => {
            axes.left_trigger = positive_wave(seconds, 0.4);
            axes.right_trigger = positive_wave(seconds + 1.2, 0.4);
            buttons.left_trigger_button = axes.left_trigger;
            buttons.right_trigger_button = axes.right_trigger;
        }
        SimulationScenario::HotPlug => {
            axes.left_stick_x = phase.sin();
            axes.left_stick_y = phase.cos();
            axes.right_stick_x = (phase * 1.25).sin();
            axes.right_stick_y = (phase * 1.25).cos();
            axes.left_trigger = positive_wave(seconds, 0.45);
            axes.right_trigger = positive_wave(seconds + 0.9, 0.45);
            buttons.south = pulsed(seconds, 0.0);
            buttons.start = pulsed(seconds, 1.1);
            buttons.dpad_right = pulsed(seconds, 2.2);
            apply_simulated_extra_buttons(profile.id, seconds, &mut buttons);
        }
    }

    ControllerSnapshot {
        status: ControllerStatus::Simulated,
        connected: true,
        id: Some("simulation".to_string()),
        name: Some(format!("Simulated {}", profile.display_name)),
        device: Some(simulated_identity(profile.display_name)),
        profile: Some(profile_info(&profile)),
        unsupported: None,
        buttons,
        axes,
        updated_at_ms,
    }
}

fn empty_snapshot(updated_at_ms: u128) -> ControllerSnapshot {
    ControllerSnapshot {
        status: ControllerStatus::NoDevice,
        connected: false,
        id: None,
        name: None,
        device: None,
        profile: None,
        unsupported: None,
        buttons: ControllerButtons::default(),
        axes: ControllerAxes::default(),
        updated_at_ms,
    }
}

fn simulated_identity(display_name: &str) -> DeviceIdentity {
    DeviceIdentity {
        id: "simulation".to_string(),
        name: format!("Simulated {display_name}"),
        vendor_id: None,
        product_id: None,
        uuid: "simulation".to_string(),
        xinput_driver: None,
        xinput: None,
    }
}

fn unsupported_snapshot(
    identity: DeviceIdentity,
    profile: Option<ProfileInfo>,
    reason: String,
    updated_at_ms: u128,
) -> ControllerSnapshot {
    ControllerSnapshot {
        status: ControllerStatus::Unsupported,
        connected: true,
        id: Some(identity.id.clone()),
        name: Some(identity.name.clone()),
        device: Some(identity.clone()),
        profile,
        unsupported: Some(UnsupportedDevice { reason, identity }),
        buttons: ControllerButtons::default(),
        axes: ControllerAxes::default(),
        updated_at_ms,
    }
}

fn required_button_value(
    gamepad: &Gamepad<'_>,
    button: Button,
    logical_name: &str,
) -> Result<f32, String> {
    let code = gamepad.button_code(button).ok_or_else(|| {
        format!("Mapped button '{logical_name}' is not exposed by gilrs as {button:?}.")
    })?;

    Ok(gamepad
        .state()
        .button_data(code)
        .map(|button| button.value().clamp(0.0, 1.0))
        .unwrap_or(0.0))
}

fn required_axis_value(
    gamepad: &Gamepad<'_>,
    axis: Axis,
    logical_name: &str,
    default_value: f32,
) -> Result<f32, String> {
    let code = gamepad.axis_code(axis).ok_or_else(|| {
        format!("Mapped axis '{logical_name}' is not exposed by gilrs as {axis:?}.")
    })?;

    Ok(gamepad
        .state()
        .axis_data(code)
        .map(|axis| axis.value().clamp(-1.0, 1.0))
        .unwrap_or(default_value.clamp(-1.0, 1.0)))
}

fn optional_axis_value(
    gamepad: &Gamepad<'_>,
    axis: Option<Axis>,
    logical_name: &str,
) -> Result<Option<f32>, String> {
    match axis {
        Some(axis) => required_axis_value(gamepad, axis, logical_name, 0.0).map(Some),
        None => Ok(None),
    }
}

fn optional_raw_button_value(gamepad: &Gamepad<'_>, raw_code: Option<RawButtonCode>) -> f32 {
    let Some(raw_code) = raw_code else {
        return 0.0;
    };

    gamepad
        .state()
        .buttons()
        .find(|(code, _)| code.into_u32() == raw_code.packed_gilrs_code)
        .map(|(_, button)| button.value().clamp(0.0, 1.0))
        .unwrap_or(0.0)
}

#[derive(Clone, Copy, Debug)]
struct TriggerSources {
    axis: Option<Axis>,
    button: Option<Button>,
    mode: TriggerAxisMode,
}

fn trigger_value(
    gamepad: &Gamepad<'_>,
    sources: TriggerSources,
    logical_name: &str,
    deadzone: f32,
    sensitivity: f32,
) -> Result<f32, String> {
    let axis_value = configured_axis_value(gamepad, sources.axis, trigger_rest_value(sources.mode))
        .map(|value| apply_trigger_axis(value, sources.mode, deadzone, sensitivity));
    let button_value = configured_button_value(gamepad, sources.button);

    match (axis_value, button_value) {
        (Some(axis), Some(button)) => Ok(axis.max(button)),
        (Some(axis), None) => Ok(axis),
        (None, Some(button)) => Ok(button),
        (None, None) => Err(format!(
            "Mapped trigger '{logical_name}' is not exposed by gilrs as {}.",
            trigger_source_description(sources)
        )),
    }
}

fn configured_axis_value(
    gamepad: &Gamepad<'_>,
    axis: Option<Axis>,
    default_value: f32,
) -> Option<f32> {
    let axis = axis?;
    let code = gamepad.axis_code(axis)?;

    Some(
        gamepad
            .state()
            .axis_data(code)
            .map(|axis| axis.value().clamp(-1.0, 1.0))
            .unwrap_or(default_value.clamp(-1.0, 1.0)),
    )
}

fn configured_button_value(gamepad: &Gamepad<'_>, button: Option<Button>) -> Option<f32> {
    let button = button?;
    let code = gamepad.button_code(button)?;

    Some(
        gamepad
            .state()
            .button_data(code)
            .map(|button| button.value().clamp(0.0, 1.0))
            .unwrap_or(0.0),
    )
}

fn trigger_source_description(sources: TriggerSources) -> String {
    let mut parts = Vec::new();
    if let Some(axis) = sources.axis {
        parts.push(format!("axis {axis:?}"));
    }
    if let Some(button) = sources.button {
        parts.push(format!("button {button:?}"));
    }

    if parts.is_empty() {
        "any configured trigger source".to_string()
    } else {
        parts.join(" or ")
    }
}

fn apply_stick_axis(value: f32, deadzone: f32, sensitivity: f32, invert: bool) -> f32 {
    let mut value = if value.abs() <= deadzone {
        0.0
    } else {
        let sign = value.signum();
        let normalized = (value.abs() - deadzone) / (1.0 - deadzone);
        sign * normalized.powf(1.0 / sensitivity)
    };

    if invert {
        value = -value;
    }

    value.clamp(-1.0, 1.0)
}

fn apply_trigger_axis(value: f32, mode: TriggerAxisMode, deadzone: f32, sensitivity: f32) -> f32 {
    let normalized = match mode {
        TriggerAxisMode::PositiveZeroToOne => value.clamp(0.0, 1.0),
        TriggerAxisMode::SignedMinusOneToOne => ((value + 1.0) / 2.0).clamp(0.0, 1.0),
    };

    if normalized <= deadzone {
        0.0
    } else {
        ((normalized - deadzone) / (1.0 - deadzone))
            .powf(1.0 / sensitivity)
            .clamp(0.0, 1.0)
    }
}

fn trigger_rest_value(mode: TriggerAxisMode) -> f32 {
    match mode {
        TriggerAxisMode::PositiveZeroToOne => 0.0,
        TriggerAxisMode::SignedMinusOneToOne => -1.0,
    }
}

fn positive_wave(seconds: f32, speed: f32) -> f32 {
    ((seconds * std::f32::consts::TAU * speed).sin() * 0.5 + 0.5).clamp(0.0, 1.0)
}

fn pulsed(seconds: f32, offset: f32) -> f32 {
    if ((seconds + offset) * 2.4).fract() > 0.62 {
        1.0
    } else {
        0.0
    }
}

fn simulated_button_slot_count(profile_id: ProfileId) -> u32 {
    match profile_id {
        ProfileId::DualSense => 14,
        ProfileId::DualShock4 => 13,
        _ => 12,
    }
}

fn apply_simulated_extra_buttons(
    profile_id: ProfileId,
    seconds: f32,
    buttons: &mut ControllerButtons,
) {
    match profile_id {
        ProfileId::DualSense => {
            buttons.touchpad = buttons.touchpad.max(pulsed(seconds, 3.5));
            buttons.misc1 = buttons.misc1.max(pulsed(seconds, 3.85));
        }
        ProfileId::DualShock4 => {
            buttons.touchpad = buttons.touchpad.max(pulsed(seconds, 3.5));
        }
        _ => {}
    }
}

fn input_event_message(event: &EventType) -> Option<String> {
    match event {
        EventType::ButtonPressed(button, code) => Some(format!(
            "Input ButtonPressed {button:?} raw={}",
            code.into_u32()
        )),
        EventType::ButtonReleased(button, code) => Some(format!(
            "Input ButtonReleased {button:?} raw={}",
            code.into_u32()
        )),
        EventType::ButtonRepeated(button, code) => Some(format!(
            "Input ButtonRepeated {button:?} raw={}",
            code.into_u32()
        )),
        EventType::ButtonChanged(button, value, code) => Some(format!(
            "Input ButtonChanged {button:?} value={value:.2} raw={}",
            code.into_u32()
        )),
        EventType::AxisChanged(axis, value, code) if value.abs() >= 0.08 => Some(format!(
            "Input AxisChanged {axis:?} value={value:.2} raw={}",
            code.into_u32()
        )),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signed_trigger_axis_normalizes_rest_to_zero() {
        assert_eq!(
            apply_trigger_axis(-1.0, TriggerAxisMode::SignedMinusOneToOne, 0.0, 1.0),
            0.0
        );
        assert_eq!(
            apply_trigger_axis(1.0, TriggerAxisMode::SignedMinusOneToOne, 0.0, 1.0),
            1.0
        );
    }

    #[test]
    fn trigger_source_description_names_axis_and_button_sources() {
        let description = trigger_source_description(TriggerSources {
            axis: Some(Axis::LeftZ),
            button: Some(Button::LeftTrigger2),
            mode: TriggerAxisMode::PositiveZeroToOne,
        });

        assert!(description.contains("axis LeftZ"));
        assert!(description.contains("button LeftTrigger2"));
    }

    #[test]
    fn input_event_message_reports_mapped_and_unknown_input_activity() {
        let pressed = input_event_message(&EventType::ButtonPressed(
            Button::South,
            Button::South.to_nec().unwrap(),
        ))
        .unwrap();
        let changed = input_event_message(&EventType::ButtonChanged(
            Button::LeftTrigger2,
            0.5,
            Button::LeftTrigger2.to_nec().unwrap(),
        ))
        .unwrap();

        assert!(pressed.contains("ButtonPressed South"));
        assert!(changed.contains("ButtonChanged LeftTrigger2"));
    }

    #[test]
    fn stick_deadzone_remaps_remaining_range() {
        assert_eq!(apply_stick_axis(0.05, 0.1, 1.0, false), 0.0);
        assert!(apply_stick_axis(0.55, 0.1, 1.0, false) > 0.49);
        assert!(apply_stick_axis(0.55, 0.1, 1.0, true) < -0.49);
    }

    #[test]
    fn hot_plug_simulation_cycles_between_connected_and_no_device() {
        let mut settings = AppSettings::default();
        settings.simulation.enabled = true;
        settings.simulation.scenario = SimulationScenario::HotPlug;
        settings.simulation.profile_id = "dualsense".to_string();

        let connected = build_simulated_snapshot(&settings, 1_000);
        let disconnected = build_simulated_snapshot(&settings, 3_500);
        let reconnected = build_simulated_snapshot(&settings, 6_100);

        assert!(connected.connected);
        assert!(matches!(connected.status, ControllerStatus::Simulated));
        assert_eq!(
            connected
                .profile
                .as_ref()
                .map(|profile| profile.id.as_str()),
            Some("dualsense")
        );

        assert!(!disconnected.connected);
        assert!(matches!(disconnected.status, ControllerStatus::NoDevice));
        assert!(disconnected.profile.is_none());

        assert!(reconnected.connected);
        assert!(matches!(reconnected.status, ControllerStatus::Simulated));
    }

    #[test]
    fn hot_plug_simulation_has_explicit_connected_activity() {
        let mut settings = AppSettings::default();
        settings.simulation.enabled = true;
        settings.simulation.scenario = SimulationScenario::HotPlug;
        settings.simulation.profile_id = "xbox-series".to_string();

        let snapshot = build_simulated_snapshot(&settings, 1_250);

        assert!(snapshot.connected);
        assert!(snapshot.axes.left_stick_x.abs() > 0.01);
        assert!(snapshot.axes.left_trigger > 0.01);
        assert!(snapshot.axes.right_trigger > 0.01);
    }
}
