import type { AppSettings, ControllerSnapshot } from "../types/controller";

export const KEYBOARD_MOUSE_PRESET_VALUE = "__keyboard_mouse";

export type DisplayDevice = "controller" | "keyboardMouse";

export function resolveDisplayDevice(
  settings: AppSettings,
  controller: Pick<ControllerSnapshot, "connected">
): DisplayDevice {
  const { showController, showKeyboardMouse } = settings.overlay;

  if (showController && showKeyboardMouse) {
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
  if (!settings.overlay.showController) {
    return KEYBOARD_MOUSE_PRESET_VALUE;
  }

  return settings.overlay.selectedPresetId ?? "";
}

export function applyDeviceSelection(settings: AppSettings, value: string) {
  if (value === KEYBOARD_MOUSE_PRESET_VALUE) {
    settings.overlay.selectedPresetId = null;
    settings.overlay.showController = false;
    settings.overlay.showKeyboardMouse = true;
    return;
  }

  if (!value) {
    settings.overlay.selectedPresetId = null;
    settings.overlay.showController = true;
    settings.overlay.showKeyboardMouse = true;
    return;
  }

  settings.overlay.selectedPresetId = value;
  settings.overlay.showController = true;
  settings.overlay.showKeyboardMouse = false;
}
