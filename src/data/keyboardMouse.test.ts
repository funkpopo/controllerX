import { describe, expect, it } from "vitest";
import {
  KEYBOARD_ROWS,
  VK,
  isKeyboardKeyActive,
  keyLabel,
  movementMagnitude,
  otherPressedKeyLabels,
  wheelMagnitude
} from "./keyboardMouse";

function layoutKey(id: string) {
  const found = KEYBOARD_ROWS.flat().find((keyboardKey) => keyboardKey.id === id);
  if (!found) {
    throw new Error(`Missing key '${id}'.`);
  }

  return found;
}

describe("keyboard/mouse mapping", () => {
  it("treats generic and left/right modifier virtual keys as the same visual key", () => {
    expect(isKeyboardKeyActive(layoutKey("shift"), new Set([VK.shift]))).toBe(true);
    expect(isKeyboardKeyActive(layoutKey("shift"), new Set([VK.leftShift]))).toBe(
      true
    );
    expect(isKeyboardKeyActive(layoutKey("control"), new Set([VK.rightControl]))).toBe(
      true
    );
  });

  it("formats common virtual-key labels", () => {
    expect(keyLabel(VK.w)).toBe("W");
    expect(keyLabel(VK.digit3)).toBe("3");
    expect(keyLabel(0x70)).toBe("F1");
    expect(keyLabel(VK.leftAlt)).toBe("L Alt");
    expect(keyLabel(255)).toBe("VK 255");
  });

  it("keeps extra pressed keys out of the fixed keyboard layout", () => {
    expect(otherPressedKeyLabels([VK.w, 0x70, 255])).toEqual(["F1", "VK 255"]);
  });

  it("computes mouse movement and wheel activity magnitudes", () => {
    expect(movementMagnitude({ x: 3, y: 4, wheelX: 0, wheelY: 0 })).toBe(5);
    expect(wheelMagnitude({ x: 0, y: 0, wheelX: -120, wheelY: 120 })).toBe(240);
  });
});
