import { describe, expect, it } from "vitest";
import {
  EMPTY_KEYBOARD_MOUSE_STATE,
  shouldCommitKeyboardMouseSnapshot
} from "./useKeyboardMouseState";
import type { KeyboardMouseSnapshot } from "../types/controller";

function snapshot(
  partial: Partial<KeyboardMouseSnapshot> = {}
): KeyboardMouseSnapshot {
  return {
    ...EMPTY_KEYBOARD_MOUSE_STATE,
    ...partial,
    mouseButtons: {
      ...EMPTY_KEYBOARD_MOUSE_STATE.mouseButtons,
      ...partial.mouseButtons
    }
  };
}

describe("shouldCommitKeyboardMouseSnapshot", () => {
  it("commits the first snapshot", () => {
    expect(shouldCommitKeyboardMouseSnapshot(null, snapshot())).toBe(true);
  });

  it("skips when keys and mouse buttons are unchanged", () => {
    const previous = snapshot({
      pressedKeys: [0x41, 0x42],
      mouseButtons: { left: true, right: false, middle: false, x1: false, x2: false },
      updatedAtMs: 1
    });
    const next = snapshot({
      pressedKeys: [0x41, 0x42],
      mouseButtons: { left: true, right: false, middle: false, x1: false, x2: false },
      updatedAtMs: 2
    });

    expect(shouldCommitKeyboardMouseSnapshot(previous, next)).toBe(false);
  });

  it("commits when pressed keys change", () => {
    const previous = snapshot({ pressedKeys: [0x41] });
    const next = snapshot({ pressedKeys: [0x41, 0x42] });

    expect(shouldCommitKeyboardMouseSnapshot(previous, next)).toBe(true);
  });

  it("commits when a mouse button changes", () => {
    const previous = snapshot({
      mouseButtons: { left: false, right: false, middle: false, x1: false, x2: false }
    });
    const next = snapshot({
      mouseButtons: { left: false, right: false, middle: true, x1: false, x2: false }
    });

    expect(shouldCommitKeyboardMouseSnapshot(previous, next)).toBe(true);
  });

  it("commits when support/error metadata changes", () => {
    const previous = snapshot({ supported: true, error: null });
    const next = snapshot({ supported: false, error: "hook failed" });

    expect(shouldCommitKeyboardMouseSnapshot(previous, next)).toBe(true);
  });
});
