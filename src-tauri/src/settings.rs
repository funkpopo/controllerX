use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::Manager;

const SETTINGS_FILE: &str = "settings.json";

/// Active settings file path for this process. Prefer the install/executable
/// directory; fall back to the legacy OS app-config path only when the install
/// directory is not writable.
static ACTIVE_SETTINGS_PATH: OnceLock<PathBuf> = OnceLock::new();

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u32,
    #[serde(default)]
    pub language: AppLanguage,
    pub overlay: OverlaySettings,
    pub input: InputSettings,
    pub simulation: SimulationSettings,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AppLanguage {
    #[default]
    ZhCn,
    En,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySettings {
    pub selected_preset_id: Option<String>,
    pub opacity: f32,
    #[serde(default = "default_true")]
    pub show_controller: bool,
    #[serde(default = "default_true")]
    pub show_keyboard_mouse: bool,
    /// When both layers are enabled, show them side-by-side instead of auto-switching.
    #[serde(default)]
    pub simultaneous_display: bool,
    /// Skin/color variant for presets that ship black/white assets.
    #[serde(default)]
    pub preset_skin: PresetSkin,
    pub click_through: bool,
    pub lock_position: bool,
    #[serde(default)]
    pub obs_mode: bool,
    pub window: WindowSettings,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PresetSkin {
    #[default]
    Default,
    Black,
    White,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSettings {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputSettings {
    pub left_stick_deadzone: f32,
    pub right_stick_deadzone: f32,
    pub trigger_deadzone: f32,
    pub stick_sensitivity: f32,
    pub trigger_sensitivity: f32,
    pub invert_left_y: bool,
    pub invert_right_y: bool,
    pub invert_dpad_y: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationSettings {
    pub enabled: bool,
    pub scenario: SimulationScenario,
    pub profile_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SimulationScenario {
    Sweep,
    Buttons,
    Triggers,
    HotPlug,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            language: AppLanguage::ZhCn,
            overlay: OverlaySettings {
                selected_preset_id: None,
                opacity: 0.92,
                show_controller: true,
                show_keyboard_mouse: true,
                simultaneous_display: false,
                preset_skin: PresetSkin::Default,
                click_through: false,
                lock_position: false,
                obs_mode: false,
                window: WindowSettings {
                    x: None,
                    y: None,
                    // Snug default around DualSense-like controller aspect (~1.7)
                    // plus the toolbar; keyboard/mouse stages scale to fill.
                    width: 600,
                    height: 360,
                },
            },
            input: InputSettings::default(),
            simulation: SimulationSettings {
                enabled: false,
                scenario: SimulationScenario::Sweep,
                profile_id: "dualsense".to_string(),
            },
        }
    }
}

impl Default for InputSettings {
    fn default() -> Self {
        Self {
            left_stick_deadzone: 0.08,
            right_stick_deadzone: 0.08,
            trigger_deadzone: 0.02,
            stick_sensitivity: 1.0,
            trigger_sensitivity: 1.0,
            invert_left_y: false,
            invert_right_y: false,
            invert_dpad_y: false,
        }
    }
}

pub fn load_or_create(app: &tauri::AppHandle) -> Result<AppSettings, String> {
    let install_path = install_settings_path()?;
    if install_path.exists() {
        remember_settings_path(install_path.clone());
        return read_settings_file(&install_path);
    }

    // Older builds stored settings under the OS app-config directory
    // (e.g. %AppData%\dev.controllerx.overlay). Migrate once into the
    // install/executable directory so portable installs keep one file.
    if let Some(legacy_path) = legacy_settings_path(app) {
        if legacy_path.exists() && legacy_path != install_path {
            match read_settings_file(&legacy_path) {
                Ok(settings) => {
                    match write_settings_file(&install_path, &settings) {
                        Ok(()) => {
                            remember_settings_path(install_path);
                        }
                        Err(error) => {
                            // Keep using the readable legacy copy if the install
                            // directory is not writable (e.g. Program Files).
                            eprintln!(
                                "Failed to migrate settings to {}: {error}. Continuing from {}.",
                                install_path.display(),
                                legacy_path.display()
                            );
                            remember_settings_path(legacy_path);
                        }
                    }
                    return Ok(settings);
                }
                Err(error) => {
                    eprintln!(
                        "Failed to read legacy settings {}: {error}. Creating defaults.",
                        legacy_path.display()
                    );
                }
            }
        }
    }

    let settings = AppSettings::default();
    match write_settings_file(&install_path, &settings) {
        Ok(()) => {
            remember_settings_path(install_path);
            Ok(settings)
        }
        Err(install_error) => {
            // Last resort when the install folder is read-only.
            if let Some(legacy_path) = legacy_settings_path(app) {
                write_settings_file(&legacy_path, &settings).map_err(|legacy_error| {
                    format!(
                        "{install_error}; also failed to write legacy settings {}: {legacy_error}",
                        legacy_path.display()
                    )
                })?;
                eprintln!(
                    "Install directory is not writable for settings ({}). Using {}.",
                    install_error,
                    legacy_path.display()
                );
                remember_settings_path(legacy_path);
                Ok(settings)
            } else {
                Err(install_error)
            }
        }
    }
}

pub fn save(_app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = active_settings_path()?;
    write_settings_file(&path, settings)
}

fn active_settings_path() -> Result<PathBuf, String> {
    if let Some(path) = ACTIVE_SETTINGS_PATH.get() {
        return Ok(path.clone());
    }
    let path = install_settings_path()?;
    remember_settings_path(path.clone());
    Ok(path)
}

fn remember_settings_path(path: PathBuf) {
    let _ = ACTIVE_SETTINGS_PATH.set(path);
}

fn install_settings_path() -> Result<PathBuf, String> {
    Ok(settings_file_in(&install_dir()?))
}

fn legacy_settings_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|path| path.join(SETTINGS_FILE))
}

fn install_dir() -> Result<PathBuf, String> {
    let executable = std::env::current_exe()
        .map_err(|error| format!("Failed to resolve executable path: {error}"))?;
    resolve_install_dir(&executable)
}

fn resolve_install_dir(executable: &Path) -> Result<PathBuf, String> {
    let parent = executable.parent().ok_or_else(|| {
        format!(
            "Executable path has no parent directory: {}",
            executable.display()
        )
    })?;
    if parent.as_os_str().is_empty() {
        return Err(format!(
            "Executable path has no parent directory: {}",
            executable.display()
        ));
    }
    Ok(parent.to_path_buf())
}

fn settings_file_in(dir: &Path) -> PathBuf {
    dir.join(SETTINGS_FILE)
}

fn read_settings_file(path: &Path) -> Result<AppSettings, String> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read settings {}: {error}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse settings {}: {error}", path.display()))
}

fn write_settings_file(path: &Path, settings: &AppSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create settings directory: {error}"))?;
    }

    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Failed to serialize settings: {error}"))?;
    fs::write(path, content)
        .map_err(|error| format!("Failed to write settings {}: {error}", path.display()))
}

pub fn sanitize(settings: &mut AppSettings) {
    settings.overlay.opacity = settings.overlay.opacity.clamp(0.25, 1.0);
    if !settings.overlay.show_controller && !settings.overlay.show_keyboard_mouse {
        settings.overlay.show_keyboard_mouse = true;
    }
    settings.overlay.window.width = settings.overlay.window.width.clamp(360, 2560);
    settings.overlay.window.height = settings.overlay.window.height.clamp(220, 1440);

    settings.input.left_stick_deadzone = settings.input.left_stick_deadzone.clamp(0.0, 0.4);
    settings.input.right_stick_deadzone = settings.input.right_stick_deadzone.clamp(0.0, 0.4);
    settings.input.trigger_deadzone = settings.input.trigger_deadzone.clamp(0.0, 0.4);
    settings.input.stick_sensitivity = settings.input.stick_sensitivity.clamp(0.25, 2.5);
    settings.input.trigger_sensitivity = settings.input.trigger_sensitivity.clamp(0.25, 2.5);
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_clamps_user_editable_ranges() {
        let mut settings = AppSettings::default();
        settings.overlay.opacity = 2.0;
        settings.input.left_stick_deadzone = 1.0;
        settings.input.trigger_sensitivity = 5.0;

        sanitize(&mut settings);

        assert_eq!(settings.overlay.opacity, 1.0);
        assert_eq!(settings.input.left_stick_deadzone, 0.4);
        assert_eq!(settings.input.trigger_sensitivity, 2.5);
    }

    #[test]
    fn sanitize_preserves_dual_enabled_auto_device_mode() {
        let mut both_enabled = AppSettings::default();
        both_enabled.overlay.show_controller = true;
        both_enabled.overlay.show_keyboard_mouse = true;

        sanitize(&mut both_enabled);

        assert!(both_enabled.overlay.show_controller);
        assert!(both_enabled.overlay.show_keyboard_mouse);
    }

    #[test]
    fn sanitize_uses_keyboard_mouse_when_no_display_layer_is_enabled() {
        let mut both_disabled = AppSettings::default();
        both_disabled.overlay.show_controller = false;
        both_disabled.overlay.show_keyboard_mouse = false;

        sanitize(&mut both_disabled);

        assert!(!both_disabled.overlay.show_controller);
        assert!(both_disabled.overlay.show_keyboard_mouse);
    }

    #[test]
    fn sanitize_preserves_explicit_controller_mode() {
        let mut settings = AppSettings::default();
        settings.overlay.show_controller = true;
        settings.overlay.show_keyboard_mouse = false;

        sanitize(&mut settings);

        assert!(settings.overlay.show_controller);
        assert!(!settings.overlay.show_keyboard_mouse);
    }

    #[test]
    fn settings_file_lives_beside_the_executable() {
        let install = resolve_install_dir(Path::new(r"C:\Apps\controllerX\controllerX.exe"))
            .expect("install dir");
        assert_eq!(install, PathBuf::from(r"C:\Apps\controllerX"));
        assert_eq!(
            settings_file_in(&install),
            PathBuf::from(r"C:\Apps\controllerX\settings.json")
        );
    }

    #[test]
    fn resolve_install_dir_rejects_root_only_paths() {
        // Windows drive roots and bare file names have no usable parent folder.
        assert!(resolve_install_dir(Path::new("controllerX.exe")).is_err());
    }
}
