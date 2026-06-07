import { describe, expect, it } from "vitest";
import {
  buttonValueByCode,
  dpadAxisX,
  dpadAxisY,
  getElementRenderState,
  shouldRenderElement,
  triggerValue
} from "./overlayMapping";
import type { ControllerSnapshot, OverlayElement } from "../types/controller";

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

describe("overlay mapping", () => {
  it("maps standard face button codes to normalized button values", () => {
    const controller = snapshot({ south: 1, east: 0.5, west: 0.25, north: 0.75 });

    expect(buttonValueByCode(0, controller)).toBe(1);
    expect(buttonValueByCode(1, controller)).toBe(0.5);
    expect(buttonValueByCode(2, controller)).toBe(0.25);
    expect(buttonValueByCode(3, controller)).toBe(0.75);
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

  it("renders base and stick layers even when their active value is zero", () => {
    const baseState = getElementRenderState(element({ type: 0 }), snapshot());
    const stickState = getElementRenderState(element({ type: 5 }), snapshot());

    expect(shouldRenderElement(element({ type: 0 }), baseState)).toBe(true);
    expect(shouldRenderElement(element({ type: 5 }), stickState)).toBe(true);
  });
});
