import { describe, expect, it } from "vitest";
import {
  KEYBOARD_ROWS,
  VK,
  isKeyboardKeyActive,
  keyLabel,
  otherPressedKeyLabels
} from "./keyboardMouse";

function layoutKey(id: string) {
  const found = KEYBOARD_ROWS.flat().find((keyboardKey) => keyboardKey.id === id);
  if (!found) {
    throw new Error(`Missing key '${id}'.`);
  }

  return found;
}

describe("keyboard/mouse mapping", () => {
  it("defines a fixed 64-key compact keyboard layout", () => {
    expect(KEYBOARD_ROWS.flat()).toHaveLength(64);
  });

  it("treats generic and left/right modifier virtual keys as the same visual key", () => {
    expect(isKeyboardKeyActive(layoutKey("left-shift"), new Set([VK.shift]))).toBe(
      true
    );
    expect(isKeyboardKeyActive(layoutKey("left-shift"), new Set([VK.leftShift]))).toBe(
      true
    );
    expect(isKeyboardKeyActive(layoutKey("right-shift"), new Set([VK.rightShift]))).toBe(
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

  it("can label keys outside the fixed keyboard layout for diagnostics", () => {
    expect(otherPressedKeyLabels([VK.w, 0x70, 255])).toEqual(["F1", "VK 255"]);
  });
});
