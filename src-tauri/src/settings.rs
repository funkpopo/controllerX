use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::Manager;

const SETTINGS_FILE: &str = "settings.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u32,
    pub overlay: OverlaySettings,
    pub input: InputSettings,
    pub simulation: SimulationSettings,
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
    pub click_through: bool,
    pub lock_position: bool,
    pub hide_toolbar_when_idle: bool,
    pub toolbar_idle_ms: u64,
    #[serde(default)]
    pub obs_mode: bool,
    pub window: WindowSettings,
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
            overlay: OverlaySettings {
                selected_preset_id: None,
                opacity: 0.92,
                show_controller: true,
                show_keyboard_mouse: true,
                click_through: false,
                lock_position: false,
                hide_toolbar_when_idle: false,
                toolbar_idle_ms: 1800,
                obs_mode: false,
                window: WindowSettings {
                    x: None,
                    y: None,
                    width: 720,
                    height: 438,
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
    let path = settings_path(app)?;
    if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("Failed to read settings {}: {error}", path.display()))?;
        serde_json::from_str(&content)
            .map_err(|error| format!("Failed to parse settings {}: {error}", path.display()))
    } else {
        let settings = AppSettings::default();
        save(app, &settings)?;
        Ok(settings)
    }
}

pub fn save(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create settings directory: {error}"))?;
    }

    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Failed to serialize settings: {error}"))?;
    fs::write(&path, content)
        .map_err(|error| format!("Failed to write settings {}: {error}", path.display()))
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join(SETTINGS_FILE))
        .map_err(|error| format!("Failed to resolve app config directory: {error}"))
}

pub fn sanitize(settings: &mut AppSettings) {
    settings.overlay.opacity = settings.overlay.opacity.clamp(0.25, 1.0);
    if !settings.overlay.show_controller && !settings.overlay.show_keyboard_mouse {
        settings.overlay.show_keyboard_mouse = true;
    }
    settings.overlay.toolbar_idle_ms = settings.overlay.toolbar_idle_ms.clamp(600, 8_000);
    settings.overlay.window.width = settings.overlay.window.width.clamp(420, 2560);
    settings.overlay.window.height = settings.overlay.window.height.clamp(260, 1440);

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
}
