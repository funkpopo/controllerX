use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, Monitor, PhysicalPosition, PhysicalSize, Position,
    Size, WebviewWindow, WindowEvent,
};

use crate::settings::{self, AppSettings};

pub const MAIN_WINDOW: &str = "main";

/// How long the window must stay still before move/resize changes hit the disk.
const WINDOW_SAVE_DEBOUNCE: Duration = Duration::from_millis(500);
const SCREEN_EDGE_MARGIN: i32 = 8;
const MIN_WINDOW_WIDTH: u32 = 420;
const MIN_WINDOW_HEIGHT: u32 = 260;
const CONTROLLER_WINDOW_SIZE: (u32, u32) = (720, 438);
const KEYBOARD_MOUSE_WINDOW_SIZE: (u32, u32) = (720, 280);

#[derive(Clone, Copy, Debug)]
pub enum OverlayWindowSize {
    Compact,
    Standard,
    Large,
}

impl OverlayWindowSize {
    pub fn dimensions(self) -> (u32, u32) {
        match self {
            OverlayWindowSize::Compact => (520, 320),
            OverlayWindowSize::Standard => (720, 438),
            OverlayWindowSize::Large => (980, 596),
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub enum DisplayDeviceWindowSize {
    Controller,
    KeyboardMouse,
}

impl DisplayDeviceWindowSize {
    fn dimensions(self) -> (u32, u32) {
        match self {
            DisplayDeviceWindowSize::Controller => CONTROLLER_WINDOW_SIZE,
            DisplayDeviceWindowSize::KeyboardMouse => KEYBOARD_MOUSE_WINDOW_SIZE,
        }
    }
}

pub fn configure_main_window(
    app: &AppHandle,
    settings_state: Arc<Mutex<AppSettings>>,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return Err("Main window was not created.".to_string());
    };

    let settings = settings_state
        .lock()
        .map_err(|_| "Settings lock is poisoned.".to_string())?
        .clone();

    window
        .set_decorations(false)
        .map_err(|error| format!("Failed to remove decorations: {error}"))?;
    window
        .set_always_on_top(true)
        .map_err(|error| format!("Failed to set always-on-top: {error}"))?;
    window
        .set_skip_taskbar(false)
        .map_err(|error| format!("Failed to keep taskbar entry: {error}"))?;
    apply_window_interaction_state(&window, &settings)?;

    // Position is persisted in physical pixels and restored before the size so
    // the logical size below resolves against the correct monitor's DPI.
    if let (Some(x), Some(y)) = (settings.overlay.window.x, settings.overlay.window.y) {
        if stored_position_is_visible(&window, x, y) {
            window
                .set_position(Position::Physical(PhysicalPosition::new(x, y)))
                .map_err(|error| format!("Failed to restore window position: {error}"))?;
        }
    }

    apply_window_size_and_keep_visible(
        &window,
        settings.overlay.window.width,
        settings.overlay.window.height,
    )
    .map_err(|error| format!("Failed to restore window size: {error}"))?;

    window
        .show()
        .map_err(|error| format!("Failed to show main window: {error}"))?;
    attach_window_persistence(app.clone(), window, settings_state);
    Ok(())
}

pub fn toggle_main_window(app: &AppHandle) -> Result<bool, String> {
    let window = main_window(app)?;
    match window
        .is_visible()
        .map_err(|error| format!("Failed to read window visibility: {error}"))?
    {
        true => window
            .hide()
            .map(|_| false)
            .map_err(|error| format!("Failed to hide main window: {error}")),
        false => {
            window
                .show()
                .map_err(|error| format!("Failed to show main window: {error}"))?;
            window
                .set_focus()
                .map_err(|error| format!("Failed to focus main window: {error}"))?;
            Ok(true)
        }
    }
}

pub fn set_click_through(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    enabled: bool,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;

    let updated = update_settings(app, settings_state, |settings| {
        settings.overlay.click_through = enabled;
    })?;
    apply_window_interaction_state(&window, &updated)?;

    emit_settings_updated(app, &updated);

    Ok(updated)
}

pub fn set_lock_position(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    enabled: bool,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;

    let updated = update_settings(app, settings_state, |settings| {
        settings.overlay.lock_position = enabled;
    })?;
    apply_window_interaction_state(&window, &updated)?;

    emit_settings_updated(app, &updated);

    Ok(updated)
}

pub fn set_obs_mode(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    enabled: bool,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;

    let updated = update_settings(app, settings_state, |settings| {
        settings.overlay.obs_mode = enabled;
    })?;
    apply_window_interaction_state(&window, &updated)?;

    emit_settings_updated(app, &updated);

    Ok(updated)
}

pub fn set_named_size(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    size: OverlayWindowSize,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;
    let (width, height) = size.dimensions();
    let applied = apply_window_size_and_keep_visible(&window, width, height)?;

    let updated = update_settings(app, settings_state, |settings| {
        settings.overlay.window.width = applied.logical_width;
        settings.overlay.window.height = applied.logical_height;
        if let Some(position) = applied.position {
            settings.overlay.window.x = Some(position.x);
            settings.overlay.window.y = Some(position.y);
        }
    })?;

    emit_settings_updated(app, &updated);

    Ok(updated)
}

pub fn set_display_device_window_size(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    size: DisplayDeviceWindowSize,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;
    let (width, height) = size.dimensions();
    let applied = apply_window_size_and_keep_visible(&window, width, height)?;

    let updated = update_settings(app, settings_state, |settings| {
        settings.overlay.window.width = applied.logical_width;
        settings.overlay.window.height = applied.logical_height;
        if let Some(position) = applied.position {
            settings.overlay.window.x = Some(position.x);
            settings.overlay.window.y = Some(position.y);
        }
    })?;

    emit_settings_updated(app, &updated);

    Ok(updated)
}

pub fn update_settings(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    edit: impl FnOnce(&mut AppSettings),
) -> Result<AppSettings, String> {
    let snapshot = update_settings_in_memory(settings_state, edit)?;
    settings::save(app, &snapshot)?;
    Ok(snapshot)
}

fn update_settings_in_memory(
    settings_state: &Arc<Mutex<AppSettings>>,
    edit: impl FnOnce(&mut AppSettings),
) -> Result<AppSettings, String> {
    let mut settings = settings_state
        .lock()
        .map_err(|_| "Settings lock is poisoned.".to_string())?;
    edit(&mut settings);
    settings::sanitize(&mut settings);
    Ok(settings.clone())
}

pub fn replace_settings(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    mut next_settings: AppSettings,
) -> Result<AppSettings, String> {
    settings::sanitize(&mut next_settings);

    let window = main_window(app)?;
    apply_window_interaction_state(&window, &next_settings)?;
    let applied = apply_window_size_and_keep_visible(
        &window,
        next_settings.overlay.window.width,
        next_settings.overlay.window.height,
    )
    .map_err(|error| format!("Failed to apply window size: {error}"))?;
    next_settings.overlay.window.width = applied.logical_width;
    next_settings.overlay.window.height = applied.logical_height;
    if let Some(position) = applied.position {
        next_settings.overlay.window.x = Some(position.x);
        next_settings.overlay.window.y = Some(position.y);
    }

    let snapshot = {
        let mut settings = settings_state
            .lock()
            .map_err(|_| "Settings lock is poisoned.".to_string())?;
        *settings = next_settings;
        settings.clone()
    };
    settings::save(app, &snapshot)?;
    Ok(snapshot)
}

fn attach_window_persistence(
    app: AppHandle,
    window: WebviewWindow,
    settings_state: Arc<Mutex<AppSettings>>,
) {
    let save_trigger = spawn_debounced_settings_saver(app.clone(), settings_state.clone());
    let event_window = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Moved(position) => {
            let result = update_settings_in_memory(&settings_state, |settings| {
                settings.overlay.window.x = Some(position.x);
                settings.overlay.window.y = Some(position.y);
            });
            match result {
                Ok(_) => request_debounced_save(&app, &save_trigger),
                Err(error) => emit_command_error(&app, error),
            }
        }
        WindowEvent::Resized(size) => {
            if size.width == 0 || size.height == 0 || event_window.is_minimized().unwrap_or(false) {
                return;
            }

            let scale = event_window.scale_factor().unwrap_or(1.0);
            let logical = size.to_logical::<f64>(scale);
            let result = update_settings_in_memory(&settings_state, |settings| {
                settings.overlay.window.width = logical.width.round() as u32;
                settings.overlay.window.height = logical.height.round() as u32;
            });
            match result {
                Ok(_) => request_debounced_save(&app, &save_trigger),
                Err(error) => emit_command_error(&app, error),
            }
        }
        _ => {}
    });
}

/// Writes settings to disk only after the window has been quiet for
/// `WINDOW_SAVE_DEBOUNCE`, so dragging never causes per-pixel file writes and
/// never holds the settings lock during IO.
fn spawn_debounced_settings_saver(
    app: AppHandle,
    settings_state: Arc<Mutex<AppSettings>>,
) -> mpsc::Sender<()> {
    let (sender, receiver) = mpsc::channel::<()>();
    std::thread::spawn(move || {
        while receiver.recv().is_ok() {
            while receiver.recv_timeout(WINDOW_SAVE_DEBOUNCE).is_ok() {}

            let snapshot = match settings_state.lock() {
                Ok(settings) => settings.clone(),
                Err(_) => {
                    emit_command_error(&app, "Settings lock is poisoned.".to_string());
                    continue;
                }
            };
            if let Err(error) = settings::save(&app, &snapshot) {
                emit_command_error(&app, error);
            }
        }
    });
    sender
}

fn request_debounced_save(app: &AppHandle, save_trigger: &mpsc::Sender<()>) {
    if save_trigger.send(()).is_err() {
        emit_command_error(app, "Settings saver is no longer running.".to_string());
    }
}

struct AppliedWindowFrame {
    logical_width: u32,
    logical_height: u32,
    position: Option<PhysicalPosition<i32>>,
}

#[derive(Clone, Copy)]
struct WorkArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn apply_window_size_and_keep_visible(
    window: &WebviewWindow,
    width: u32,
    height: u32,
) -> Result<AppliedWindowFrame, String> {
    let monitor = target_monitor(window)?;
    let scale_factor = monitor
        .as_ref()
        .map(Monitor::scale_factor)
        .unwrap_or_else(|| window.scale_factor().unwrap_or(1.0));
    let work_area = monitor.as_ref().map(monitor_work_area);
    let (logical_width, logical_height) = work_area
        .map(|work_area| clamp_logical_size_to_work_area(width, height, work_area, scale_factor))
        .unwrap_or((width, height));

    // Capture the current position and size BEFORE resizing to maintain bottom alignment
    let old_position = window.outer_position().ok();
    let old_size = window.outer_size().ok();

    window
        .set_size(Size::Logical(LogicalSize::new(
            logical_width as f64,
            logical_height as f64,
        )))
        .map_err(|error| format!("Failed to set window size: {error}"))?;

    let Some(work_area) = work_area else {
        return Ok(AppliedWindowFrame {
            logical_width,
            logical_height,
            position: None,
        });
    };

    let Ok(current_position) = window.outer_position() else {
        return Ok(AppliedWindowFrame {
            logical_width,
            logical_height,
            position: None,
        });
    };
    let physical_size = window.outer_size().unwrap_or_else(|_| {
        PhysicalSize::new(
            (logical_width as f64 * scale_factor).round() as u32,
            (logical_height as f64 * scale_factor).round() as u32,
        )
    });

    // Calculate position adjustment to maintain bottom alignment when height changes
    let mut adjusted_position = current_position;
    if let (Some(old_pos), Some(old_sz)) = (old_position, old_size) {
        let height_delta = physical_size.height as i32 - old_sz.height as i32;
        if height_delta != 0 {
            // Move the window up/down by the height difference to keep the bottom edge in place
            adjusted_position = PhysicalPosition::new(
                old_pos.x,
                old_pos.y - height_delta,
            );
        }
    }

    let clamped_position = clamp_position_to_work_area(adjusted_position, physical_size, work_area);

    if clamped_position != current_position {
        window
            .set_position(Position::Physical(clamped_position))
            .map_err(|error| format!("Failed to keep window inside display: {error}"))?;
        Ok(AppliedWindowFrame {
            logical_width,
            logical_height,
            position: Some(clamped_position),
        })
    } else {
        Ok(AppliedWindowFrame {
            logical_width,
            logical_height,
            position: None,
        })
    }
}

fn target_monitor(window: &WebviewWindow) -> Result<Option<Monitor>, String> {
    if let Some(monitor) = window
        .current_monitor()
        .map_err(|error| format!("Failed to read current monitor: {error}"))?
    {
        return Ok(Some(monitor));
    }

    let monitors = window
        .available_monitors()
        .map_err(|error| format!("Failed to enumerate monitors: {error}"))?;
    if monitors.is_empty() {
        return Ok(None);
    }

    let position = window.outer_position().ok();
    if let Some(position) = position {
        if let Some(monitor) = monitors
            .iter()
            .find(|monitor| work_area_contains_position(monitor_work_area(monitor), position))
        {
            return Ok(Some(monitor.clone()));
        }
    }

    Ok(monitors.into_iter().next())
}

fn monitor_work_area(monitor: &Monitor) -> WorkArea {
    let work_area = monitor.work_area();
    WorkArea {
        x: work_area.position.x,
        y: work_area.position.y,
        width: work_area.size.width,
        height: work_area.size.height,
    }
}

fn work_area_contains_position(work_area: WorkArea, position: PhysicalPosition<i32>) -> bool {
    position.x >= work_area.x
        && position.x < work_area.x + work_area.width as i32
        && position.y >= work_area.y
        && position.y < work_area.y + work_area.height as i32
}

fn clamp_logical_size_to_work_area(
    width: u32,
    height: u32,
    work_area: WorkArea,
    scale_factor: f64,
) -> (u32, u32) {
    let horizontal_margin = (SCREEN_EDGE_MARGIN * 2).max(0) as f64;
    let vertical_margin = (SCREEN_EDGE_MARGIN * 2).max(0) as f64;
    let max_width = ((work_area.width as f64 - horizontal_margin) / scale_factor)
        .floor()
        .max(MIN_WINDOW_WIDTH as f64) as u32;
    let max_height = ((work_area.height as f64 - vertical_margin) / scale_factor)
        .floor()
        .max(MIN_WINDOW_HEIGHT as f64) as u32;

    (width.min(max_width), height.min(max_height))
}

fn clamp_position_to_work_area(
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    work_area: WorkArea,
) -> PhysicalPosition<i32> {
    let min_x = work_area.x + SCREEN_EDGE_MARGIN;
    let min_y = work_area.y + SCREEN_EDGE_MARGIN;
    let max_x = work_area.x + work_area.width as i32 - size.width as i32 - SCREEN_EDGE_MARGIN;
    let max_y = work_area.y + work_area.height as i32 - size.height as i32 - SCREEN_EDGE_MARGIN;

    PhysicalPosition::new(
        clamp_axis_position(position.x, min_x, max_x),
        clamp_axis_position(position.y, min_y, max_y),
    )
}

fn clamp_axis_position(value: i32, min: i32, max: i32) -> i32 {
    if max < min {
        min
    } else {
        value.clamp(min, max)
    }
}

/// Rejects stored positions that no longer land on any connected monitor, so
/// the overlay cannot restore off-screen after a display change.
fn stored_position_is_visible(window: &WebviewWindow, x: i32, y: i32) -> bool {
    let Ok(monitors) = window.available_monitors() else {
        return true;
    };
    if monitors.is_empty() {
        return true;
    }

    // Probe a point inside the toolbar area so at least the drag handle is
    // reachable when the position is accepted.
    let probe_x = x + 60;
    let probe_y = y + 20;
    monitors.iter().any(|monitor| {
        let position = monitor.position();
        let size = monitor.size();
        probe_x >= position.x
            && probe_x < position.x + size.width as i32
            && probe_y >= position.y
            && probe_y < position.y + size.height as i32
    })
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "Main window is not available.".to_string())
}

fn apply_window_interaction_state(
    window: &WebviewWindow,
    settings: &AppSettings,
) -> Result<(), String> {
    window
        .set_resizable(overlay_resizable(settings))
        .map_err(|error| format!("Failed to apply resize lock: {error}"))?;
    window
        .set_ignore_cursor_events(overlay_ignores_cursor_events(settings))
        .map_err(|error| format!("Failed to apply click-through mode: {error}"))
}

fn overlay_resizable(settings: &AppSettings) -> bool {
    !settings.overlay.lock_position && !settings.overlay.obs_mode
}

fn overlay_ignores_cursor_events(settings: &AppSettings) -> bool {
    settings.overlay.click_through || settings.overlay.obs_mode
}

fn emit_settings_updated(app: &AppHandle, settings: &AppSettings) {
    if let Err(error) = app.emit("settings-updated", settings) {
        eprintln!("Failed to emit settings-updated: {error}");
    }
}

fn emit_command_error(app: &AppHandle, message: String) {
    if let Err(error) = app.emit("app-command-error", message) {
        eprintln!("Failed to emit app-command-error: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn obs_mode_forces_capture_safe_window_interactions() {
        let mut settings = AppSettings::default();
        settings.overlay.obs_mode = true;
        settings.overlay.click_through = false;
        settings.overlay.lock_position = false;

        assert!(overlay_ignores_cursor_events(&settings));
        assert!(!overlay_resizable(&settings));
    }

    #[test]
    fn normal_mode_uses_saved_click_and_lock_settings() {
        let mut settings = AppSettings::default();

        assert!(!overlay_ignores_cursor_events(&settings));
        assert!(overlay_resizable(&settings));

        settings.overlay.click_through = true;
        settings.overlay.lock_position = true;

        assert!(overlay_ignores_cursor_events(&settings));
        assert!(!overlay_resizable(&settings));
    }

    #[test]
    fn device_window_sizes_match_display_surface_shapes() {
        assert_eq!(
            DisplayDeviceWindowSize::Controller.dimensions(),
            CONTROLLER_WINDOW_SIZE
        );
        assert_eq!(
            DisplayDeviceWindowSize::KeyboardMouse.dimensions(),
            KEYBOARD_MOUSE_WINDOW_SIZE
        );
        assert!(KEYBOARD_MOUSE_WINDOW_SIZE.1 < CONTROLLER_WINDOW_SIZE.1);
    }

    #[test]
    fn logical_size_is_limited_to_monitor_work_area() {
        let work_area = WorkArea {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
        };

        assert_eq!(
            clamp_logical_size_to_work_area(980, 596, work_area, 1.0),
            (784, 584)
        );
        assert_eq!(
            clamp_logical_size_to_work_area(720, 320, work_area, 2.0),
            (420, 292)
        );
    }

    #[test]
    fn position_is_clamped_inside_monitor_work_area() {
        let work_area = WorkArea {
            x: 100,
            y: 50,
            width: 800,
            height: 600,
        };
        let size = PhysicalSize::new(300, 200);

        assert_eq!(
            clamp_position_to_work_area(PhysicalPosition::new(780, 500), size, work_area),
            PhysicalPosition::new(592, 442)
        );
        assert_eq!(
            clamp_position_to_work_area(PhysicalPosition::new(40, 10), size, work_area),
            PhysicalPosition::new(108, 58)
        );
    }
}
