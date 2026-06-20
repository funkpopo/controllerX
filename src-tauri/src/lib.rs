mod controller;
mod keyboard_mouse;
mod platform_identity;
mod profiles;
mod settings;
mod verification;
mod window_control;
mod xinput;

use std::sync::{Arc, Mutex};

use tauri::menu::{CheckMenuItem, Menu, MenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, State};

use crate::settings::{AppLanguage, AppSettings};

const MENU_SHOW_HIDE: &str = "show_hide";
const MENU_CLICK_THROUGH: &str = "click_through";
const MENU_LOCK_POSITION: &str = "lock_position";
const MENU_OBS_MODE: &str = "obs_mode";
const MENU_LANGUAGE_ZH_CN: &str = "language_zh_cn";
const MENU_LANGUAGE_EN: &str = "language_en";
const MENU_QUIT: &str = "quit";

type SettingsState = Arc<Mutex<AppSettings>>;

#[derive(Clone)]
struct TrayMenuItems {
    show_hide: CheckMenuItem<tauri::Wry>,
    click_through: CheckMenuItem<tauri::Wry>,
    lock_position: CheckMenuItem<tauri::Wry>,
    obs_mode: CheckMenuItem<tauri::Wry>,
    language: Submenu<tauri::Wry>,
    language_zh_cn: CheckMenuItem<tauri::Wry>,
    language_en: CheckMenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
}

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
    let show_hide = CheckMenuItem::with_id(app, MENU_SHOW_HIDE, "", true, true, None::<&str>)?;
    let click_through = CheckMenuItem::with_id(
        app,
        MENU_CLICK_THROUGH,
        "",
        true,
        initial_settings.overlay.click_through,
        None::<&str>,
    )?;
    let lock_position = CheckMenuItem::with_id(
        app,
        MENU_LOCK_POSITION,
        "",
        true,
        initial_settings.overlay.lock_position,
        None::<&str>,
    )?;
    let obs_mode = CheckMenuItem::with_id(
        app,
        MENU_OBS_MODE,
        "",
        true,
        initial_settings.overlay.obs_mode,
        None::<&str>,
    )?;
    let language_zh_cn = CheckMenuItem::with_id(
        app,
        MENU_LANGUAGE_ZH_CN,
        "",
        true,
        initial_settings.language == AppLanguage::ZhCn,
        None::<&str>,
    )?;
    let language_en = CheckMenuItem::with_id(
        app,
        MENU_LANGUAGE_EN,
        "",
        true,
        initial_settings.language == AppLanguage::En,
        None::<&str>,
    )?;
    let language = Submenu::with_items(app, "", true, &[&language_zh_cn, &language_en])?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "", true, None::<&str>)?;
    let menu_items = TrayMenuItems {
        show_hide,
        click_through,
        lock_position,
        obs_mode,
        language,
        language_zh_cn,
        language_en,
        quit,
    };
    apply_tray_language(&menu_items, initial_settings.language)?;

    let menu = Menu::with_items(
        app,
        &[
            &menu_items.show_hide,
            &menu_items.click_through,
            &menu_items.lock_position,
            &menu_items.obs_mode,
            &menu_items.language,
            &menu_items.quit,
        ],
    )?;

    let menu_items_for_menu = menu_items.clone();
    let show_hide_for_tray = menu_items.show_hide.clone();

    let mut builder = TrayIconBuilder::with_id("controllerx")
        .tooltip("controllerX")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            MENU_SHOW_HIDE => emit_if_error(
                app,
                toggle_overlay_visibility(app, &menu_items_for_menu.show_hide),
            ),
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
            MENU_LANGUAGE_ZH_CN => emit_if_error(
                app,
                set_language(
                    app,
                    &settings_state,
                    AppLanguage::ZhCn,
                    &menu_items_for_menu,
                ),
            ),
            MENU_LANGUAGE_EN => emit_if_error(
                app,
                set_language(app, &settings_state, AppLanguage::En, &menu_items_for_menu),
            ),
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

fn set_language(
    app: &tauri::AppHandle,
    settings_state: &SettingsState,
    language: AppLanguage,
    menu_items: &TrayMenuItems,
) -> Result<(), String> {
    let updated = window_control::update_settings(app, settings_state, |settings| {
        settings.language = language;
    })?;
    apply_tray_language(menu_items, updated.language)
        .map_err(|error| format!("Failed to update tray language menu: {error}"))?;
    app.emit("settings-updated", updated)
        .map_err(|error| format!("Failed to emit settings update: {error}"))
}

struct TrayLabels {
    show_hide: &'static str,
    click_through: &'static str,
    lock_position: &'static str,
    obs_mode: &'static str,
    language: &'static str,
    language_zh_cn: &'static str,
    language_en: &'static str,
    quit: &'static str,
}

fn tray_labels(language: AppLanguage) -> TrayLabels {
    match language {
        AppLanguage::ZhCn => TrayLabels {
            show_hide: "显示/隐藏叠加层",
            click_through: "鼠标穿透",
            lock_position: "锁定位置",
            obs_mode: "OBS 模式（仅显示输入）",
            language: "语言",
            language_zh_cn: "中文",
            language_en: "English",
            quit: "退出 controllerX",
        },
        AppLanguage::En => TrayLabels {
            show_hide: "Show/Hide Overlay",
            click_through: "Click-through",
            lock_position: "Lock Position",
            obs_mode: "OBS Mode (Input Only)",
            language: "Language",
            language_zh_cn: "中文",
            language_en: "English",
            quit: "Quit controllerX",
        },
    }
}

fn apply_tray_language(menu_items: &TrayMenuItems, language: AppLanguage) -> tauri::Result<()> {
    let labels = tray_labels(language);
    menu_items.show_hide.set_text(labels.show_hide)?;
    menu_items.click_through.set_text(labels.click_through)?;
    menu_items.lock_position.set_text(labels.lock_position)?;
    menu_items.obs_mode.set_text(labels.obs_mode)?;
    menu_items.language.set_text(labels.language)?;
    menu_items.language_zh_cn.set_text(labels.language_zh_cn)?;
    menu_items.language_en.set_text(labels.language_en)?;
    menu_items.quit.set_text(labels.quit)?;
    menu_items
        .language_zh_cn
        .set_checked(language == AppLanguage::ZhCn)?;
    menu_items
        .language_en
        .set_checked(language == AppLanguage::En)?;
    Ok(())
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
