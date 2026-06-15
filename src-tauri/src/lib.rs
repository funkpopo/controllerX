mod controller;
mod keyboard_mouse;
mod platform_identity;
mod profiles;
mod settings;
mod verification;
mod window_control;
mod xinput;

use std::sync::{Arc, Mutex};

use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, State};

use crate::settings::AppSettings;

const MENU_SHOW_HIDE: &str = "show_hide";
const MENU_CLICK_THROUGH: &str = "click_through";
const MENU_LOCK_POSITION: &str = "lock_position";
const MENU_OBS_MODE: &str = "obs_mode";
const MENU_SIZE_COMPACT: &str = "size_compact";
const MENU_SIZE_STANDARD: &str = "size_standard";
const MENU_SIZE_LARGE: &str = "size_large";
const MENU_QUIT: &str = "quit";

type SettingsState = Arc<Mutex<AppSettings>>;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_settings,
            get_profile_catalog,
            set_click_through,
            set_lock_position,
            set_obs_mode,
            set_overlay_size,
            set_display_device_window_size,
            save_hardware_verification_report
        ])
        .setup(|app| {
            let mut loaded_settings = settings::load_or_create(app.handle())
                .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error)))?;
            settings::sanitize(&mut loaded_settings);
            settings::save(app.handle(), &loaded_settings)
                .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error)))?;
            let settings_state = Arc::new(Mutex::new(loaded_settings));
            app.manage(settings_state.clone());

            window_control::configure_main_window(app.handle(), settings_state.clone())
                .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error)))?;
            create_tray(app.handle(), settings_state.clone())?;
            controller::spawn_controller_poll(app.handle().clone(), settings_state);
            keyboard_mouse::spawn_keyboard_mouse_poll(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run controllerX");
}

#[tauri::command]
fn get_settings(settings: State<'_, SettingsState>) -> Result<AppSettings, String> {
    settings
        .lock()
        .map(|settings| settings.clone())
        .map_err(|_| "Settings lock is poisoned.".to_string())
}

#[tauri::command]
fn update_settings(
    app: tauri::AppHandle,
    settings: State<'_, SettingsState>,
    mut next_settings: AppSettings,
) -> Result<AppSettings, String> {
    // Prevent updating obs_mode through the general update_settings command.
    // OBS mode can only be toggled via the system tray menu.
    let current_settings = settings
        .lock()
        .map_err(|_| "Settings lock is poisoned.".to_string())?;
    next_settings.overlay.obs_mode = current_settings.overlay.obs_mode;
    drop(current_settings);

    window_control::replace_settings(&app, &settings, next_settings)
}

#[tauri::command]
fn get_profile_catalog() -> Vec<profiles::ProfileInfo> {
    profiles::profile_catalog()
}

#[tauri::command]
fn set_click_through(
    app: tauri::AppHandle,
    settings: State<'_, SettingsState>,
    enabled: bool,
) -> Result<AppSettings, String> {
    window_control::set_click_through(&app, &settings, enabled)
}

#[tauri::command]
fn set_lock_position(
    app: tauri::AppHandle,
    settings: State<'_, SettingsState>,
    enabled: bool,
) -> Result<AppSettings, String> {
    window_control::set_lock_position(&app, &settings, enabled)
}

#[tauri::command]
fn set_obs_mode(
    app: tauri::AppHandle,
    settings: State<'_, SettingsState>,
    enabled: bool,
) -> Result<AppSettings, String> {
    window_control::set_obs_mode(&app, &settings, enabled)
}

#[tauri::command]
fn set_overlay_size(
    app: tauri::AppHandle,
    settings: State<'_, SettingsState>,
    size: &str,
) -> Result<AppSettings, String> {
    let size = match size {
        "compact" => window_control::OverlayWindowSize::Compact,
        "standard" => window_control::OverlayWindowSize::Standard,
        "large" => window_control::OverlayWindowSize::Large,
        _ => return Err(format!("Unsupported overlay size '{size}'.")),
    };

    window_control::set_named_size(&app, &settings, size)
}

#[tauri::command]
fn set_display_device_window_size(
    app: tauri::AppHandle,
    settings: State<'_, SettingsState>,
    display_device: &str,
) -> Result<AppSettings, String> {
    let size = match display_device {
        "controller" => window_control::DisplayDeviceWindowSize::Controller,
        "keyboardMouse" | "keyboard_mouse" => {
            window_control::DisplayDeviceWindowSize::KeyboardMouse
        }
        _ => return Err(format!("Unsupported display device '{display_device}'.")),
    };

    window_control::set_display_device_window_size(&app, &settings, size)
}

#[tauri::command]
fn save_hardware_verification_report(
    app: tauri::AppHandle,
    file_name: &str,
    content: &str,
) -> Result<verification::SavedHardwareVerificationReport, String> {
    verification::save_hardware_report(&app, file_name, content)
}

fn create_tray(app: &tauri::AppHandle, settings_state: SettingsState) -> tauri::Result<()> {
    let initial_settings = settings_state
        .lock()
        .map(|settings| settings.clone())
        .map_err(|_| tauri::Error::Anyhow(anyhow::anyhow!("Settings lock is poisoned.")))?;
    let show_hide = CheckMenuItem::with_id(
        app,
        MENU_SHOW_HIDE,
        "显示/隐藏叠加层",
        true,
        true,
        None::<&str>,
    )?;
    let click_through = CheckMenuItem::with_id(
        app,
        MENU_CLICK_THROUGH,
        "鼠标穿透",
        true,
        initial_settings.overlay.click_through,
        None::<&str>,
    )?;
    let lock_position = CheckMenuItem::with_id(
        app,
        MENU_LOCK_POSITION,
        "锁定位置",
        true,
        initial_settings.overlay.lock_position,
        None::<&str>,
    )?;
    let obs_mode = CheckMenuItem::with_id(
        app,
        MENU_OBS_MODE,
        "OBS 模式（仅显示输入）",
        true,
        initial_settings.overlay.obs_mode,
        None::<&str>,
    )?;
    let size_compact =
        MenuItem::with_id(app, MENU_SIZE_COMPACT, "窗口尺寸: 紧凑", true, None::<&str>)?;
    let size_standard = MenuItem::with_id(
        app,
        MENU_SIZE_STANDARD,
        "窗口尺寸: 标准",
        true,
        None::<&str>,
    )?;
    let size_large = MenuItem::with_id(app, MENU_SIZE_LARGE, "窗口尺寸: 大", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "退出 controllerX", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show_hide,
            &click_through,
            &lock_position,
            &obs_mode,
            &size_compact,
            &size_standard,
            &size_large,
            &quit,
        ],
    )?;

    let show_hide_for_menu = show_hide.clone();
    let show_hide_for_tray = show_hide.clone();

    let mut builder = TrayIconBuilder::with_id("controllerx")
        .tooltip("controllerX")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            MENU_SHOW_HIDE => {
                emit_if_error(app, toggle_overlay_visibility(app, &show_hide_for_menu))
            }
            MENU_CLICK_THROUGH => match current_settings(&settings_state) {
                Ok(settings) => emit_if_error(
                    app,
                    window_control::set_click_through(
                        app,
                        &settings_state,
                        !settings.overlay.click_through,
                    )
                    .map(|_| ()),
                ),
                Err(error) => emit_command_error(app, error),
            },
            MENU_LOCK_POSITION => match current_settings(&settings_state) {
                Ok(settings) => emit_if_error(
                    app,
                    window_control::set_lock_position(
                        app,
                        &settings_state,
                        !settings.overlay.lock_position,
                    )
                    .map(|_| ()),
                ),
                Err(error) => emit_command_error(app, error),
            },
            MENU_OBS_MODE => match current_settings(&settings_state) {
                Ok(settings) => emit_if_error(
                    app,
                    window_control::set_obs_mode(app, &settings_state, !settings.overlay.obs_mode)
                        .map(|_| ()),
                ),
                Err(error) => emit_command_error(app, error),
            },
            MENU_SIZE_COMPACT => {
                emit_if_error(
                    app,
                    window_control::set_named_size(
                        app,
                        &settings_state,
                        window_control::OverlayWindowSize::Compact,
                    )
                    .map(|_| ()),
                );
            }
            MENU_SIZE_STANDARD => {
                emit_if_error(
                    app,
                    window_control::set_named_size(
                        app,
                        &settings_state,
                        window_control::OverlayWindowSize::Standard,
                    )
                    .map(|_| ()),
                );
            }
            MENU_SIZE_LARGE => {
                emit_if_error(
                    app,
                    window_control::set_named_size(
                        app,
                        &settings_state,
                        window_control::OverlayWindowSize::Large,
                    )
                    .map(|_| ()),
                );
            }
            MENU_QUIT => {
                // Flush any window move/resize still waiting in the debounced
                // saver before the process exits.
                if let Ok(settings) = current_settings(&settings_state) {
                    if let Err(error) = settings::save(app, &settings) {
                        eprintln!("Failed to save settings on quit: {error}");
                    }
                }
                app.exit(0)
            }
            id => emit_command_error(app, format!("Unhandled tray menu event '{id}'.")),
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                emit_if_error(
                    tray.app_handle(),
                    toggle_overlay_visibility(tray.app_handle(), &show_hide_for_tray),
                );
            }
        });

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::Anyhow(anyhow::anyhow!("Application icon is missing.")))?;
    builder = builder.icon(icon);

    builder.build(app)?;
    Ok(())
}

fn current_settings(settings_state: &SettingsState) -> Result<AppSettings, String> {
    settings_state
        .lock()
        .map(|settings| settings.clone())
        .map_err(|_| "Settings lock is poisoned.".to_string())
}

fn emit_if_error(app: &tauri::AppHandle, result: Result<(), String>) {
    if let Err(error) = result {
        emit_command_error(app, error);
    }
}

fn toggle_overlay_visibility(
    app: &tauri::AppHandle,
    show_hide: &CheckMenuItem<tauri::Wry>,
) -> Result<(), String> {
    let visible = window_control::toggle_main_window(app)?;
    show_hide
        .set_checked(visible)
        .map_err(|error| format!("Failed to update tray visibility check: {error}"))
}

fn emit_command_error(app: &tauri::AppHandle, message: String) {
    if let Err(error) = app.emit("app-command-error", message) {
        eprintln!("Failed to emit app-command-error: {error}");
    }
}
