import { describe, expect, it } from "vitest";
import {
  BOTH_DISPLAY_VALUE,
  KEYBOARD_MOUSE_PRESET_VALUE,
  applyDeviceSelection,
  deviceSelectValue,
  resolveDisplayDevice
} from "./displayDevice";
import type { AppSettings, ControllerSnapshot } from "../types/controller";

function settings(
  showController: boolean,
  showKeyboardMouse: boolean,
  selectedPresetId: string | null = null,
  simultaneousDisplay = false
): AppSettings {
  return {
    schemaVersion: 1,
    language: "zhCn",
    overlay: {
      selectedPresetId,
      opacity: 0.92,
      showController,
      showKeyboardMouse,
      simultaneousDisplay,
      presetSkin: "default",
      clickThrough: false,
      lockPosition: false,
      obsMode: false,
      window: {
        x: null,
        y: null,
        width: 720,
        height: 438
      }
    },
    input: {
      leftStickDeadzone: 0.08,
      rightStickDeadzone: 0.08,
      triggerDeadzone: 0.02,
      stickSensitivity: 1,
      triggerSensitivity: 1,
      invertLeftY: false,
      invertRightY: false,
      invertDpadY: false
    },
    simulation: {
      enabled: false,
      scenario: "sweep",
      profileId: "dualsense"
    }
  };
}

function controller(connected: boolean): Pick<ControllerSnapshot, "connected"> {
  return { connected };
}

describe("display device resolution", () => {
  it("prefers the controller layer when both layers are enabled and a controller is connected", () => {
    expect(resolveDisplayDevice(settings(true, true), controller(true))).toBe(
      "controller"
    );
  });

  it("falls back to the keyboard/mouse layer when both layers are enabled without a controller", () => {
    expect(resolveDisplayDevice(settings(true, true), controller(false))).toBe(
      "keyboardMouse"
    );
  });

  it("shows both layers when simultaneous display is enabled", () => {
    expect(
      resolveDisplayDevice(settings(true, true, null, true), controller(false))
    ).toBe("both");
    expect(
      resolveDisplayDevice(settings(true, true, null, true), controller(true))
    ).toBe("both");
  });

  it("falls back to the keyboard/mouse layer when both layers are disabled", () => {
    const next = settings(false, false);

    expect(resolveDisplayDevice(next, controller(true))).toBe("keyboardMouse");
    expect(deviceSelectValue(next)).toBe(KEYBOARD_MOUSE_PRESET_VALUE);
  });

  it("keeps an explicit keyboard/mouse selection independent of controller state", () => {
    expect(resolveDisplayDevice(settings(false, true), controller(true))).toBe(
      "keyboardMouse"
    );
  });

  it("maps the toolbar select value to the keyboard/mouse layer", () => {
    const next = settings(true, false, "dualsense");

    applyDeviceSelection(next, KEYBOARD_MOUSE_PRESET_VALUE);

    expect(next.overlay.selectedPresetId).toBeNull();
    expect(next.overlay.showController).toBe(false);
    expect(next.overlay.showKeyboardMouse).toBe(true);
    expect(next.overlay.simultaneousDisplay).toBe(false);
    expect(deviceSelectValue(next)).toBe(KEYBOARD_MOUSE_PRESET_VALUE);
  });

  it("maps the simultaneous select value to dual display", () => {
    const next = settings(false, true, "dualsense");

    applyDeviceSelection(next, BOTH_DISPLAY_VALUE);

    expect(next.overlay.selectedPresetId).toBeNull();
    expect(next.overlay.showController).toBe(true);
    expect(next.overlay.showKeyboardMouse).toBe(true);
    expect(next.overlay.simultaneousDisplay).toBe(true);
    expect(deviceSelectValue(next)).toBe(BOTH_DISPLAY_VALUE);
    expect(resolveDisplayDevice(next, controller(true))).toBe("both");
  });

  it("maps the automatic select value to dual-enabled device recognition", () => {
    const next = settings(false, true, "dualsense", true);

    applyDeviceSelection(next, "");

    expect(next.overlay.selectedPresetId).toBeNull();
    expect(next.overlay.showController).toBe(true);
    expect(next.overlay.showKeyboardMouse).toBe(true);
    expect(next.overlay.simultaneousDisplay).toBe(false);
    expect(deviceSelectValue(next)).toBe("");
  });

  it("maps a controller preset selection to the controller layer", () => {
    const next = settings(false, true);

    applyDeviceSelection(next, "xbox-controller");

    expect(next.overlay.selectedPresetId).toBe("xbox-controller");
    expect(next.overlay.showController).toBe(true);
    expect(next.overlay.showKeyboardMouse).toBe(false);
    expect(next.overlay.simultaneousDisplay).toBe(false);
    expect(deviceSelectValue(next)).toBe("xbox-controller");
  });
});
