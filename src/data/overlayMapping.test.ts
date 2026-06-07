import { describe, expect, it } from "vitest";
import {
  buttonValueByCode,
  dpadAxisX,
  dpadAxisY,
  dpadDirectionForElement,
  dpadDirectionValue,
  getElementRenderState,
  getDpadDirectionRenderState,
  isElementActive,
  shouldClipSharedDpadDirectionElement,
  shouldRenderElement,
  triggerValue,
  validateOverlayPresetElements
} from "./overlayMapping";
import type { ControllerSnapshot, OverlayElement } from "../types/controller";
import xboxPresetFile from "../../public/vendor/input-overlay/xbox-controller/xbox-controller.json";
import xboxOnePresetFile from "../../public/vendor/input-overlay/xbox-one-controller/xbox-one-controller.json";
import dualSensePresetFile from "../../public/vendor/input-overlay/dualsense/dualsense.json";
import type { OverlayPresetFile } from "../types/controller";

const xboxPreset = xboxPresetFile as unknown as OverlayPresetFile;
const xboxOnePreset = xboxOnePresetFile as unknown as OverlayPresetFile;
const dualSensePreset = dualSensePresetFile as unknown as OverlayPresetFile;

function snapshot(
  buttons: Partial<ControllerSnapshot["buttons"]> = {},
  axes: Partial<ControllerSnapshot["axes"]> = {}
): ControllerSnapshot {
  return {
    status: "active",
    connected: true,
    id: "test",
    name: "Test Controller",
    device: null,
    profile: null,
    unsupported: null,
    buttons: {
      south: 0,
      east: 0,
      west: 0,
      north: 0,
      leftBumper: 0,
      rightBumper: 0,
      leftTriggerButton: 0,
      rightTriggerButton: 0,
      select: 0,
      start: 0,
      mode: 0,
      leftThumb: 0,
      rightThumb: 0,
      dpadUp: 0,
      dpadDown: 0,
      dpadLeft: 0,
      dpadRight: 0,
      misc1: 0,
      paddle1: 0,
      paddle2: 0,
      paddle3: 0,
      paddle4: 0,
      touchpad: 0,
      ...buttons
    },
    axes: {
      leftStickX: 0,
      leftStickY: 0,
      rightStickX: 0,
      rightStickY: 0,
      leftTrigger: 0,
      rightTrigger: 0,
      dpadX: 0,
      dpadY: 0,
      ...axes
    },
    updatedAtMs: 1
  };
}

function element(overrides: Partial<OverlayElement>): OverlayElement {
  return {
    id: "test",
    type: 2,
    pos: [0, 0],
    mapping: [0, 0, 10, 10],
    ...overrides
  };
}

function renderableElementIds(
  preset: OverlayPresetFile,
  controller: ControllerSnapshot
) {
  return preset.elements
    .filter((presetElement) =>
      shouldRenderElement(
        presetElement,
        getElementRenderState(presetElement, controller)
      )
    )
    .map((presetElement) => presetElement.id);
}

function presetElement(
  preset: OverlayPresetFile,
  predicate: (element: OverlayElement) => boolean
) {
  const found = preset.elements.find(predicate);
  if (!found) {
    throw new Error("Expected preset element was not found.");
  }

  return found;
}

describe("overlay mapping", () => {
  it("maps standard face button codes to normalized button values", () => {
    const controller = snapshot({ south: 1, east: 0.5, west: 0.25, north: 0.75 });

    expect(buttonValueByCode(0, controller)).toBe(1);
    expect(buttonValueByCode(1, controller)).toBe(0.5);
    expect(buttonValueByCode(2, controller)).toBe(0.25);
    expect(buttonValueByCode(3, controller)).toBe(0.75);
  });

  it("maps SDL stick and PlayStation extension button codes explicitly", () => {
    const controller = snapshot({
      leftThumb: 0.6,
      rightThumb: 0.7,
      misc1: 0.8,
      paddle1: 0.1,
      paddle2: 0.2,
      paddle3: 0.3,
      paddle4: 0.4,
      touchpad: 0.9
    });

    expect(buttonValueByCode(7, controller)).toBe(0.6);
    expect(buttonValueByCode(8, controller)).toBe(0.7);
    expect(buttonValueByCode(15, controller)).toBe(0.8);
    expect(buttonValueByCode(16, controller)).toBe(0.1);
    expect(buttonValueByCode(17, controller)).toBe(0.2);
    expect(buttonValueByCode(18, controller)).toBe(0.3);
    expect(buttonValueByCode(19, controller)).toBe(0.4);
    expect(buttonValueByCode(20, controller)).toBe(0.9);
  });

  it("rejects unsupported input-overlay button codes", () => {
    expect(() => buttonValueByCode(21, snapshot())).toThrow("21");
  });

  it("keeps inactive face button sprites hidden", () => {
    const state = getElementRenderState(element({ code: 0 }), snapshot());

    expect(state.value).toBe(0);
    expect(shouldRenderElement(element({ code: 0 }), state)).toBe(false);
  });

  it("moves analog stick sprites using source coordinates and stick radius", () => {
    const state = getElementRenderState(
      element({ type: 5, side: 0, stick_radius: 40 }),
      snapshot({}, { leftStickX: 0.5, leftStickY: -0.25 })
    );

    expect(state.analog).toBe(true);
    expect(state.x).toBeCloseTo(20);
    expect(state.y).toBeCloseTo(10);
    expect(state.value).toBeCloseTo(0.5);
  });

  it("clips analog trigger overlays by normalized trigger pressure", () => {
    const controller = snapshot({}, { leftTrigger: 0.6, rightTrigger: 0.2 });
    const left = element({ type: 6, id: "PS5 Left Trigger L2" });
    const right = element({ type: 6, id: "PS5 Right Trigger R2" });

    expect(triggerValue(left, controller)).toBeCloseTo(0.6);
    expect(triggerValue(right, controller)).toBeCloseTo(0.2);
    expect(getElementRenderState(left, controller).clipRatio).toBeCloseTo(0.6);
  });

  it("combines D-Pad axes and button values without exceeding normalized range", () => {
    const controller = snapshot(
      { dpadLeft: 1, dpadDown: 1 },
      { dpadX: 0.75, dpadY: -0.5 }
    );

    expect(dpadAxisX(controller)).toBeCloseTo(0.75);
    expect(dpadAxisY(controller)).toBeCloseTo(1);
  });

  it("resolves D-Pad directions independently for split type-8 rendering", () => {
    const upOnly = snapshot({ dpadUp: 1 });
    const leftOnly = snapshot({ dpadLeft: 1 });
    const axisRight = snapshot({}, { dpadX: 0.8 });
    const dpad = element({ type: 8, id: "D-Pad" });

    expect(dpadDirectionValue("up", upOnly)).toBe(1);
    expect(dpadDirectionValue("down", upOnly)).toBe(0);
    expect(dpadDirectionValue("left", upOnly)).toBe(0);
    expect(dpadDirectionValue("right", upOnly)).toBe(0);

    expect(dpadDirectionValue("left", leftOnly)).toBe(1);
    expect(dpadDirectionValue("right", leftOnly)).toBe(0);

    expect(dpadDirectionValue("right", axisRight)).toBeCloseTo(0.8);
    expect(dpadDirectionValue("left", axisRight)).toBe(0);

    expect(
      shouldRenderElement(dpad, getDpadDirectionRenderState("up", upOnly))
    ).toBe(true);
    expect(
      shouldRenderElement(dpad, getDpadDirectionRenderState("down", upOnly))
    ).toBe(false);
  });

  it("detects Xbox D-Pad sprites that share one visual area and need directional clipping", () => {
    const directions = ["up", "down", "left", "right"] as const;

    for (const direction of directions) {
      const xboxElement = presetElement(
        xboxPreset,
        (presetElement) => presetElement.id === `dpad_${direction}`
      );
      const xboxOneElement = presetElement(
        xboxOnePreset,
        (presetElement) => presetElement.id === `dpad_${direction}`
      );

      expect(dpadDirectionForElement(xboxElement)).toBe(direction);
      expect(
        shouldClipSharedDpadDirectionElement(xboxElement, xboxPreset.elements)
      ).toBe(true);
      expect(
        shouldClipSharedDpadDirectionElement(
          xboxOneElement,
          xboxOnePreset.elements
        )
      ).toBe(false);
    }
  });

  it("renders base and stick layers even when their active value is zero", () => {
    const baseState = getElementRenderState(element({ type: 0 }), snapshot());
    const stickState = getElementRenderState(element({ type: 5 }), snapshot());

    expect(shouldRenderElement(element({ type: 0 }), baseState)).toBe(true);
    expect(shouldRenderElement(element({ type: 5 }), stickState)).toBe(true);
  });

  it("marks only non-body input elements active when their normalized value crosses the visual threshold", () => {
    const body = element({ type: 0 });
    const button = element({ type: 2, code: 0 });
    const trigger = element({ type: 6, id: "lt", side: 0 });
    const stick = element({ type: 5, side: 0 });
    const inactive = snapshot({ south: 0.2 }, { leftTrigger: 0.2, leftStickX: 0.03 });
    const active = snapshot({ south: 1 }, { leftTrigger: 0.7, leftStickX: 0.4 });

    expect(isElementActive(body, getElementRenderState(body, active))).toBe(false);
    expect(isElementActive(button, getElementRenderState(button, inactive))).toBe(
      false
    );
    expect(isElementActive(trigger, getElementRenderState(trigger, inactive))).toBe(
      false
    );
    expect(isElementActive(stick, getElementRenderState(stick, inactive))).toBe(
      false
    );
    expect(isElementActive(button, getElementRenderState(button, active))).toBe(true);
    expect(isElementActive(trigger, getElementRenderState(trigger, active))).toBe(
      true
    );
    expect(isElementActive(stick, getElementRenderState(stick, active))).toBe(true);
  });

  it("validates supported DualSense extension preset elements", () => {
    expect(() =>
      validateOverlayPresetElements("dualsense-test", [
        element({ id: "Button PS5 Mute", code: 15 }),
        element({ id: "Button PS5 TouchPad", code: 20 })
      ])
    ).not.toThrow();
  });

  it("rejects unsupported preset element types and mappings", () => {
    expect(() =>
      validateOverlayPresetElements("bad-preset", [
        element({ id: "Unknown Button", code: 99 }),
        element({ id: "Unknown Element", type: 99 })
      ])
    ).toThrow("unsupported");
  });

  it("renders active Xbox face buttons, shoulders, triggers, and D-Pad from the bundled preset", () => {
    validateOverlayPresetElements("xbox-controller", xboxPreset.elements);

    const rendered = renderableElementIds(
      xboxPreset,
      snapshot(
        {
          south: 1,
          east: 1,
          west: 1,
          north: 1,
          leftBumper: 1,
          rightBumper: 1,
          dpadUp: 1,
          dpadDown: 1,
          dpadLeft: 1,
          dpadRight: 1
        },
        {
          leftTrigger: 1,
          rightTrigger: 1
        }
      )
    );

    expect(rendered).toEqual(
      expect.arrayContaining([
        "a",
        "b",
        "x",
        "y",
        "ls",
        "rs",
        "dpad_up",
        "dpad_down",
        "dpad_left",
        "dpad_right",
        "lt",
        "rt"
      ])
    );
  });

  it("renders active DualSense D-Pad, shoulders, and triggers from the bundled preset", () => {
    validateOverlayPresetElements("dualsense", dualSensePreset.elements);

    const dpad = presetElement(
      dualSensePreset,
      (presetElement) => presetElement.type === 8
    );
    const leftTrigger = presetElement(
      dualSensePreset,
      (presetElement) => presetElement.id === "PS5 Left Trigger L2"
    );
    const rightTrigger = presetElement(
      dualSensePreset,
      (presetElement) => presetElement.id === "PS5 Right Trigger R2"
    );

    const controller = snapshot(
      {
        leftBumper: 1,
        rightBumper: 1,
        dpadUp: 1
      },
      {
        leftTrigger: 0.7,
        rightTrigger: 0.8
      }
    );
    const rendered = renderableElementIds(dualSensePreset, controller);

    expect(shouldRenderElement(dpad, getElementRenderState(dpad, controller))).toBe(
      true
    );
    expect(triggerValue(leftTrigger, controller)).toBeCloseTo(0.7);
    expect(triggerValue(rightTrigger, controller)).toBeCloseTo(0.8);
    expect(rendered).toEqual(
      expect.arrayContaining([
        "D-Pad",
        "PS5 Left Bumper L1",
        "PS5 Right Bumper R1",
        "PS5 Left Trigger L2",
        "PS5 Right Trigger R2"
      ])
    );
  });
});
