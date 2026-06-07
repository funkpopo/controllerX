use std::sync::{Arc, Mutex};

use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Size, WebviewWindow,
    WindowEvent,
};

use crate::settings::{self, AppSettings};

pub const MAIN_WINDOW: &str = "main";

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
    window
        .set_resizable(!settings.overlay.lock_position)
        .map_err(|error| format!("Failed to set resize lock: {error}"))?;
    window
        .set_ignore_cursor_events(settings.overlay.click_through)
        .map_err(|error| format!("Failed to set click-through mode: {error}"))?;
    window
        .set_size(Size::Logical(LogicalSize::new(
            settings.overlay.window.width as f64,
            settings.overlay.window.height as f64,
        )))
        .map_err(|error| format!("Failed to restore window size: {error}"))?;

    if let (Some(x), Some(y)) = (settings.overlay.window.x, settings.overlay.window.y) {
        window
            .set_position(Position::Logical(LogicalPosition::new(x as f64, y as f64)))
            .map_err(|error| format!("Failed to restore window position: {error}"))?;
    }

    window
        .show()
        .map_err(|error| format!("Failed to show main window: {error}"))?;
    attach_window_persistence(app.clone(), window, settings_state);
    Ok(())
}

pub fn toggle_main_window(app: &AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    match window
        .is_visible()
        .map_err(|error| format!("Failed to read window visibility: {error}"))?
    {
        true => window
            .hide()
            .map_err(|error| format!("Failed to hide main window: {error}")),
        false => {
            window
                .show()
                .map_err(|error| format!("Failed to show main window: {error}"))?;
            window
                .set_focus()
                .map_err(|error| format!("Failed to focus main window: {error}"))
        }
    }
}

pub fn set_click_through(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    enabled: bool,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|error| format!("Failed to set click-through mode: {error}"))?;

    update_settings(app, settings_state, |settings| {
        settings.overlay.click_through = enabled;
    })
}

pub fn set_lock_position(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    enabled: bool,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;
    window
        .set_resizable(!enabled)
        .map_err(|error| format!("Failed to update resize lock: {error}"))?;

    update_settings(app, settings_state, |settings| {
        settings.overlay.lock_position = enabled;
    })
}

pub fn set_named_size(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    size: OverlayWindowSize,
) -> Result<AppSettings, String> {
    let window = main_window(app)?;
    let (width, height) = size.dimensions();
    window
        .set_size(Size::Logical(LogicalSize::new(width as f64, height as f64)))
        .map_err(|error| format!("Failed to set window size: {error}"))?;

    update_settings(app, settings_state, |settings| {
        settings.overlay.window.width = width;
        settings.overlay.window.height = height;
    })
}

pub fn update_settings(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    edit: impl FnOnce(&mut AppSettings),
) -> Result<AppSettings, String> {
    let mut settings = settings_state
        .lock()
        .map_err(|_| "Settings lock is poisoned.".to_string())?;
    edit(&mut settings);
    settings::sanitize(&mut settings);
    settings::save(app, &settings)?;
    Ok(settings.clone())
}

pub fn replace_settings(
    app: &AppHandle,
    settings_state: &Arc<Mutex<AppSettings>>,
    mut next_settings: AppSettings,
) -> Result<AppSettings, String> {
    settings::sanitize(&mut next_settings);

    let window = main_window(app)?;
    window
        .set_ignore_cursor_events(next_settings.overlay.click_through)
        .map_err(|error| format!("Failed to apply click-through mode: {error}"))?;
    window
        .set_resizable(!next_settings.overlay.lock_position)
        .map_err(|error| format!("Failed to apply resize lock: {error}"))?;
    window
        .set_size(Size::Logical(LogicalSize::new(
            next_settings.overlay.window.width as f64,
            next_settings.overlay.window.height as f64,
        )))
        .map_err(|error| format!("Failed to apply window size: {error}"))?;

    let mut settings = settings_state
        .lock()
        .map_err(|_| "Settings lock is poisoned.".to_string())?;
    *settings = next_settings;
    settings::save(app, &settings)?;
    Ok(settings.clone())
}

fn attach_window_persistence(
    app: AppHandle,
    window: WebviewWindow,
    settings_state: Arc<Mutex<AppSettings>>,
) {
    window.on_window_event(move |event| match event {
        WindowEvent::Moved(position) => {
            if let Err(error) = update_settings(&app, &settings_state, |settings| {
                settings.overlay.window.x = Some(position.x);
                settings.overlay.window.y = Some(position.y);
            }) {
                emit_command_error(&app, error);
            }
        }
        WindowEvent::Resized(size) => {
            if let Err(error) = update_settings(&app, &settings_state, |settings| {
                settings.overlay.window.width = size.width;
                settings.overlay.window.height = size.height;
            }) {
                emit_command_error(&app, error);
            }
        }
        _ => {}
    });
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| "Main window is not available.".to_string())
}

fn emit_command_error(app: &AppHandle, message: String) {
    if let Err(error) = app.emit("app-command-error", message) {
        eprintln!("Failed to emit app-command-error: {error}");
    }
}
