use serde::Serialize;

use crate::controller::{ControllerAxes, ControllerButtons};
use crate::profiles::{
    CalibrationStatus, ControllerFamily, DeviceIdentity, DeviceMatchKind, ProfileInfo,
    XInputDriverEvidence,
};
use crate::settings::InputSettings;

const MAX_XINPUT_CONTROLLERS: usize = 4;
const XINPUT_ID_PREFIX: &str = "windows-xinput";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XInputDevice {
    pub slot: u32,
    pub packet_number: u32,
}

#[derive(Clone, Debug)]
pub struct XInputSnapshot {
    pub device: XInputDevice,
    pub identity: DeviceIdentity,
    pub profile: ProfileInfo,
    pub buttons: ControllerButtons,
    pub axes: ControllerAxes,
}

pub struct XInputPoller {
    previous_states: [Option<RawXInputState>; MAX_XINPUT_CONTROLLERS],
    active_slot: Option<usize>,
}

impl XInputPoller {
    pub fn new() -> Self {
        Self {
            previous_states: [None; MAX_XINPUT_CONTROLLERS],
            active_slot: None,
        }
    }

    pub fn poll(&mut self, settings: &InputSettings) -> XInputPoll {
        let states = std::array::from_fn(|slot| platform_state(slot as u32));
        self.poll_states(states, settings)
    }

    fn poll_states(
        &mut self,
        states: [Option<RawXInputState>; MAX_XINPUT_CONTROLLERS],
        settings: &InputSettings,
    ) -> XInputPoll {
        let mut active = None;
        let mut changed = false;
        let mut events = Vec::new();
        let mut connected_slots = Vec::new();
        let mut recently_changed_slot = None;
        let had_previous_state = self.previous_states.iter().any(Option::is_some);

        for (slot, state) in states.into_iter().enumerate() {
            match state {
                Some(raw) => {
                    let previous = self.previous_states[slot];
                    if previous.is_none() {
                        events.push(format!("XInputConnected slot={slot}"));
                    }
                    if previous != Some(raw) {
                        changed = true;
                        if previous.is_some() || had_previous_state {
                            recently_changed_slot = Some(slot);
                        }
                        events.push(format!(
                            "XInput StateChanged slot={slot} packet={} buttons=0x{:04x} lt={:.2} rt={:.2}",
                            raw.packet_number,
                            raw.buttons,
                            trigger_u8(raw.left_trigger),
                            trigger_u8(raw.right_trigger)
                        ));
                    }
                    self.previous_states[slot] = Some(raw);
                    connected_slots.push((slot, raw));
                }
                None => {
                    if self.previous_states[slot].take().is_some() {
                        changed = true;
                        events.push(format!("XInputDisconnected slot={slot}"));
                    }
                }
            }
        }

        if let Some(slot) = recently_changed_slot {
            self.active_slot = Some(slot);
        }

        if !self.active_slot.is_some_and(|slot| {
            connected_slots
                .iter()
                .any(|(connected, _)| *connected == slot)
        }) {
            self.active_slot = connected_slots.first().map(|(slot, _)| *slot);
        }

        if let Some(slot) = self.active_slot {
            active = connected_slots
                .iter()
                .find(|(connected, _)| *connected == slot)
                .map(|(slot, raw)| build_snapshot(*slot as u32, *raw, settings));
        }

        XInputPoll {
            active,
            changed,
            events,
        }
    }
}

pub struct XInputPoll {
    pub active: Option<XInputSnapshot>,
    pub changed: bool,
    pub events: Vec<String>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
struct RawXInputState {
    packet_number: u32,
    buttons: u16,
    left_trigger: u8,
    right_trigger: u8,
    left_thumb_x: i16,
    left_thumb_y: i16,
    right_thumb_x: i16,
    right_thumb_y: i16,
}

fn build_snapshot(slot: u32, raw: RawXInputState, settings: &InputSettings) -> XInputSnapshot {
    let device = XInputDevice {
        slot,
        packet_number: raw.packet_number,
    };
    let identity = DeviceIdentity {
        id: format!("{XINPUT_ID_PREFIX}-{slot}"),
        name: format!("Windows XInput Controller {}", slot + 1),
        vendor_id: None,
        product_id: None,
        uuid: format!("{XINPUT_ID_PREFIX}-{slot}"),
        xinput_driver: Some(XInputDriverEvidence {
            source: "windows-xinput-api".to_string(),
            device_instance_id: format!("XInput user index {slot}"),
            class_name: None,
            service: Some("xinput1_4".to_string()),
            compatible_ids: Vec::new(),
        }),
        xinput: Some(device.clone()),
    };
    let profile = ProfileInfo {
        id: "generic-xinput".to_string(),
        display_name: "Generic XInput-compatible Controller".to_string(),
        family: ControllerFamily::XInput,
        preset_id: Some("xbox-controller".to_string()),
        match_kind: DeviceMatchKind::XInputApi,
        calibration_status: CalibrationStatus {
            preset_calibrated: false,
            input_map_calibrated: false,
            hardware_verified: false,
            notes: "State is read from the Windows XInput API so the transparent overlay can update without window focus; real hardware calibration remains required.",
        },
    };

    XInputSnapshot {
        device,
        identity,
        profile,
        buttons: ControllerButtons {
            south: button(raw.buttons, ButtonMask::A),
            east: button(raw.buttons, ButtonMask::B),
            west: button(raw.buttons, ButtonMask::X),
            north: button(raw.buttons, ButtonMask::Y),
            left_bumper: button(raw.buttons, ButtonMask::LeftShoulder),
            right_bumper: button(raw.buttons, ButtonMask::RightShoulder),
            left_trigger_button: trigger_u8(raw.left_trigger),
            right_trigger_button: trigger_u8(raw.right_trigger),
            select: button(raw.buttons, ButtonMask::Back),
            start: button(raw.buttons, ButtonMask::Start),
            mode: 0.0,
            left_thumb: button(raw.buttons, ButtonMask::LeftThumb),
            right_thumb: button(raw.buttons, ButtonMask::RightThumb),
            dpad_up: button(raw.buttons, ButtonMask::DpadUp),
            dpad_down: button(raw.buttons, ButtonMask::DpadDown),
            dpad_left: button(raw.buttons, ButtonMask::DpadLeft),
            dpad_right: button(raw.buttons, ButtonMask::DpadRight),
            misc1: 0.0,
            paddle1: 0.0,
            paddle2: 0.0,
            paddle3: 0.0,
            paddle4: 0.0,
            touchpad: 0.0,
        },
        axes: ControllerAxes {
            left_stick_x: apply_stick_axis(
                normalize_thumb(raw.left_thumb_x),
                settings.left_stick_deadzone,
                settings.stick_sensitivity,
                false,
            ),
            left_stick_y: apply_stick_axis(
                normalize_thumb(raw.left_thumb_y),
                settings.left_stick_deadzone,
                settings.stick_sensitivity,
                settings.invert_left_y,
            ),
            right_stick_x: apply_stick_axis(
                normalize_thumb(raw.right_thumb_x),
                settings.right_stick_deadzone,
                settings.stick_sensitivity,
                false,
            ),
            right_stick_y: apply_stick_axis(
                normalize_thumb(raw.right_thumb_y),
                settings.right_stick_deadzone,
                settings.stick_sensitivity,
                settings.invert_right_y,
            ),
            left_trigger: apply_trigger(
                trigger_u8(raw.left_trigger),
                settings.trigger_deadzone,
                settings.trigger_sensitivity,
            ),
            right_trigger: apply_trigger(
                trigger_u8(raw.right_trigger),
                settings.trigger_deadzone,
                settings.trigger_sensitivity,
            ),
            dpad_x: 0.0,
            dpad_y: 0.0,
        },
    }
}

fn button(buttons: u16, mask: ButtonMask) -> f32 {
    if buttons & mask.value() != 0 {
        1.0
    } else {
        0.0
    }
}

fn normalize_thumb(value: i16) -> f32 {
    if value < 0 {
        value as f32 / 32768.0
    } else {
        value as f32 / 32767.0
    }
    .clamp(-1.0, 1.0)
}

fn trigger_u8(value: u8) -> f32 {
    value as f32 / 255.0
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

fn apply_trigger(value: f32, deadzone: f32, sensitivity: f32) -> f32 {
    if value <= deadzone {
        0.0
    } else {
        ((value - deadzone) / (1.0 - deadzone))
            .powf(1.0 / sensitivity)
            .clamp(0.0, 1.0)
    }
}

#[derive(Clone, Copy)]
enum ButtonMask {
    DpadUp,
    DpadDown,
    DpadLeft,
    DpadRight,
    Start,
    Back,
    LeftThumb,
    RightThumb,
    LeftShoulder,
    RightShoulder,
    A,
    B,
    X,
    Y,
}

impl ButtonMask {
    fn value(self) -> u16 {
        match self {
            ButtonMask::DpadUp => 0x0001,
            ButtonMask::DpadDown => 0x0002,
            ButtonMask::DpadLeft => 0x0004,
            ButtonMask::DpadRight => 0x0008,
            ButtonMask::Start => 0x0010,
            ButtonMask::Back => 0x0020,
            ButtonMask::LeftThumb => 0x0040,
            ButtonMask::RightThumb => 0x0080,
            ButtonMask::LeftShoulder => 0x0100,
            ButtonMask::RightShoulder => 0x0200,
            ButtonMask::A => 0x1000,
            ButtonMask::B => 0x2000,
            ButtonMask::X => 0x4000,
            ButtonMask::Y => 0x8000,
        }
    }
}

#[cfg(target_os = "windows")]
fn platform_state(slot: u32) -> Option<RawXInputState> {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::UI::Input::XboxController::{XInputGetState, XINPUT_STATE};

    let mut state = XINPUT_STATE::default();
    let result = unsafe { XInputGetState(slot, &mut state as *mut _) };
    if result != ERROR_SUCCESS {
        return None;
    }

    let gamepad = state.Gamepad;
    Some(RawXInputState {
        packet_number: state.dwPacketNumber,
        buttons: gamepad.wButtons,
        left_trigger: gamepad.bLeftTrigger,
        right_trigger: gamepad.bRightTrigger,
        left_thumb_x: gamepad.sThumbLX,
        left_thumb_y: gamepad.sThumbLY,
        right_thumb_x: gamepad.sThumbRX,
        right_thumb_y: gamepad.sThumbRY,
    })
}

#[cfg(not(target_os = "windows"))]
fn platform_state(_slot: u32) -> Option<RawXInputState> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slot_states(
        states: impl IntoIterator<Item = (usize, RawXInputState)>,
    ) -> [Option<RawXInputState>; MAX_XINPUT_CONTROLLERS] {
        let mut result = [None; MAX_XINPUT_CONTROLLERS];
        for (slot, state) in states {
            result[slot] = Some(state);
        }
        result
    }

    #[test]
    fn converts_xinput_buttons_to_controller_buttons() {
        let raw = RawXInputState {
            buttons: ButtonMask::A.value()
                | ButtonMask::RightShoulder.value()
                | ButtonMask::DpadLeft.value(),
            ..RawXInputState::default()
        };

        let snapshot = build_snapshot(0, raw, &InputSettings::default());

        assert_eq!(snapshot.buttons.south, 1.0);
        assert_eq!(snapshot.buttons.right_bumper, 1.0);
        assert_eq!(snapshot.buttons.dpad_left, 1.0);
        assert_eq!(snapshot.buttons.east, 0.0);
    }

    #[test]
    fn normalizes_xinput_axes_and_triggers() {
        let raw = RawXInputState {
            left_trigger: 255,
            right_trigger: 128,
            left_thumb_x: 32767,
            left_thumb_y: -32768,
            ..RawXInputState::default()
        };

        let snapshot = build_snapshot(
            1,
            raw,
            &InputSettings {
                left_stick_deadzone: 0.0,
                right_stick_deadzone: 0.0,
                trigger_deadzone: 0.0,
                stick_sensitivity: 1.0,
                trigger_sensitivity: 1.0,
                invert_left_y: false,
                invert_right_y: false,
                invert_dpad_y: false,
            },
        );

        assert_eq!(snapshot.axes.left_stick_x, 1.0);
        assert_eq!(snapshot.axes.left_stick_y, -1.0);
        assert_eq!(snapshot.axes.left_trigger, 1.0);
        assert!(snapshot.axes.right_trigger > 0.5);
    }

    #[test]
    fn marks_snapshot_as_xinput_api_profile() {
        let snapshot = build_snapshot(2, RawXInputState::default(), &InputSettings::default());

        assert_eq!(snapshot.profile.id, "generic-xinput");
        assert_eq!(snapshot.profile.match_kind, DeviceMatchKind::XInputApi);
        assert!(snapshot.identity.xinput.is_some());
        assert_eq!(
            snapshot
                .identity
                .xinput_driver
                .as_ref()
                .map(|e| e.source.as_str()),
            Some("windows-xinput-api")
        );
    }

    #[test]
    fn initial_poll_uses_first_connected_xinput_slot() {
        let mut poller = XInputPoller::new();

        let poll = poller.poll_states(
            slot_states([
                (
                    0,
                    RawXInputState {
                        packet_number: 1,
                        ..RawXInputState::default()
                    },
                ),
                (
                    2,
                    RawXInputState {
                        packet_number: 1,
                        buttons: ButtonMask::B.value(),
                        ..RawXInputState::default()
                    },
                ),
            ]),
            &InputSettings::default(),
        );

        let active = poll.active.unwrap();
        assert_eq!(active.device.slot, 0);
        assert_eq!(active.buttons.east, 0.0);
    }

    #[test]
    fn switches_active_xinput_slot_to_recently_changed_controller() {
        let mut poller = XInputPoller::new();

        let baseline = slot_states([
            (
                0,
                RawXInputState {
                    packet_number: 10,
                    ..RawXInputState::default()
                },
            ),
            (
                1,
                RawXInputState {
                    packet_number: 20,
                    ..RawXInputState::default()
                },
            ),
        ]);
        poller.poll_states(baseline, &InputSettings::default());

        let poll = poller.poll_states(
            slot_states([
                (
                    0,
                    RawXInputState {
                        packet_number: 10,
                        ..RawXInputState::default()
                    },
                ),
                (
                    1,
                    RawXInputState {
                        packet_number: 21,
                        buttons: ButtonMask::A.value(),
                        ..RawXInputState::default()
                    },
                ),
            ]),
            &InputSettings::default(),
        );

        let active = poll.active.unwrap();
        assert!(poll.changed);
        assert_eq!(active.device.slot, 1);
        assert_eq!(active.buttons.south, 1.0);
    }

    #[test]
    fn detects_xinput_raw_state_changes_when_packet_number_is_reused() {
        let mut poller = XInputPoller::new();

        poller.poll_states(
            slot_states([(
                0,
                RawXInputState {
                    packet_number: 7,
                    ..RawXInputState::default()
                },
            )]),
            &InputSettings::default(),
        );

        let poll = poller.poll_states(
            slot_states([(
                0,
                RawXInputState {
                    packet_number: 7,
                    buttons: ButtonMask::Y.value(),
                    ..RawXInputState::default()
                },
            )]),
            &InputSettings::default(),
        );

        let active = poll.active.unwrap();
        assert!(poll.changed);
        assert_eq!(active.device.packet_number, 7);
        assert_eq!(active.buttons.north, 1.0);
        assert!(poll
            .events
            .iter()
            .any(|event| event.contains("buttons=0x8000")));
    }
}
