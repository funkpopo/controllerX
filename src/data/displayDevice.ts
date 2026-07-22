import type { AppSettings, ControllerSnapshot } from "../types/controller";

export const KEYBOARD_MOUSE_PRESET_VALUE = "__keyboard_mouse";
export const BOTH_DISPLAY_VALUE = "__both";

export type DisplayDevice = "controller" | "keyboardMouse" | "both";

export function resolveDisplayDevice(
  settings: AppSettings,
  controller: Pick<ControllerSnapshot, "connected">
): DisplayDevice {
  const { showController, showKeyboardMouse, simultaneousDisplay } =
    settings.overlay;

  if (showController && showKeyboardMouse) {
    if (simultaneousDisplay) {
      return "both";
    }

    return controller.connected ? "controller" : "keyboardMouse";
  }

  if (showKeyboardMouse) {
    return "keyboardMouse";
  }

  if (showController) {
    return "controller";
  }

  return "keyboardMouse";
}

export function deviceSelectValue(settings: AppSettings) {
  if (
    settings.overlay.showController &&
    settings.overlay.showKeyboardMouse &&
    settings.overlay.simultaneousDisplay
  ) {
    return BOTH_DISPLAY_VALUE;
  }

  if (!settings.overlay.showController) {
    return KEYBOARD_MOUSE_PRESET_VALUE;
  }

  if (settings.overlay.showKeyboardMouse && !settings.overlay.simultaneousDisplay) {
    // Auto-detect: both layers enabled, exclusive switch.
    return settings.overlay.selectedPresetId ?? "";
  }

  return settings.overlay.selectedPresetId ?? "";
}

export function applyDeviceSelection(settings: AppSettings, value: string) {
  if (value === KEYBOARD_MOUSE_PRESET_VALUE) {
    settings.overlay.selectedPresetId = null;
    settings.overlay.showController = false;
    settings.overlay.showKeyboardMouse = true;
    settings.overlay.simultaneousDisplay = false;
    return;
  }

  if (value === BOTH_DISPLAY_VALUE) {
    settings.overlay.selectedPresetId = null;
    settings.overlay.showController = true;
    settings.overlay.showKeyboardMouse = true;
    settings.overlay.simultaneousDisplay = true;
    return;
  }

  if (!value) {
    settings.overlay.selectedPresetId = null;
    settings.overlay.showController = true;
    settings.overlay.showKeyboardMouse = true;
    settings.overlay.simultaneousDisplay = false;
    return;
  }

  settings.overlay.selectedPresetId = value;
  settings.overlay.showController = true;
  settings.overlay.showKeyboardMouse = false;
  settings.overlay.simultaneousDisplay = false;
}
