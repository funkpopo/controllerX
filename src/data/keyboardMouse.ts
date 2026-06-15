import type { KeyboardMouseSnapshot, MouseMovement } from "../types/controller";

export type KeyboardKey = {
  id: string;
  label: string;
  codes: number[];
  width?: "wide" | "space";
};

export type MouseButtonId = keyof KeyboardMouseSnapshot["mouseButtons"];

export type MouseButtonDefinition = {
  id: MouseButtonId;
  label: string;
};

export const VK = {
  backspace: 0x08,
  tab: 0x09,
  enter: 0x0d,
  shift: 0x10,
  control: 0x11,
  alt: 0x12,
  escape: 0x1b,
  space: 0x20,
  left: 0x25,
  up: 0x26,
  right: 0x27,
  down: 0x28,
  digit0: 0x30,
  digit1: 0x31,
  digit2: 0x32,
  digit3: 0x33,
  digit4: 0x34,
  digit5: 0x35,
  digit6: 0x36,
  a: 0x41,
  c: 0x43,
  d: 0x44,
  e: 0x45,
  f: 0x46,
  g: 0x47,
  q: 0x51,
  r: 0x52,
  s: 0x53,
  t: 0x54,
  v: 0x56,
  w: 0x57,
  x: 0x58,
  z: 0x5a,
  leftShift: 0xa0,
  rightShift: 0xa1,
  leftControl: 0xa2,
  rightControl: 0xa3,
  leftAlt: 0xa4,
  rightAlt: 0xa5
} as const;

export const KEYBOARD_ROWS: KeyboardKey[][] = [
  [
    key("escape", "Esc", VK.escape),
    key("digit1", "1", VK.digit1),
    key("digit2", "2", VK.digit2),
    key("digit3", "3", VK.digit3),
    key("digit4", "4", VK.digit4),
    key("digit5", "5", VK.digit5),
    key("digit6", "6", VK.digit6)
  ],
  [
    key("tab", "Tab", VK.tab, "wide"),
    key("q", "Q", VK.q),
    key("w", "W", VK.w),
    key("e", "E", VK.e),
    key("r", "R", VK.r),
    key("t", "T", VK.t)
  ],
  [
    key("a", "A", VK.a),
    key("s", "S", VK.s),
    key("d", "D", VK.d),
    key("f", "F", VK.f),
    key("g", "G", VK.g),
    key("enter", "Enter", VK.enter, "wide")
  ],
  [
    key("shift", "Shift", [VK.shift, VK.leftShift, VK.rightShift], "wide"),
    key("z", "Z", VK.z),
    key("x", "X", VK.x),
    key("c", "C", VK.c),
    key("v", "V", VK.v),
    key("backspace", "Back", VK.backspace, "wide")
  ],
  [
    key("control", "Ctrl", [VK.control, VK.leftControl, VK.rightControl], "wide"),
    key("alt", "Alt", [VK.alt, VK.leftAlt, VK.rightAlt], "wide"),
    key("space", "Space", VK.space, "space"),
    key("up", "Up", VK.up)
  ],
  [key("left", "Left", VK.left), key("down", "Down", VK.down), key("right", "Right", VK.right)]
];

export const MOUSE_BUTTONS: MouseButtonDefinition[] = [
  { id: "left", label: "L" },
  { id: "middle", label: "M" },
  { id: "right", label: "R" },
  { id: "x1", label: "X1" },
  { id: "x2", label: "X2" }
];

const KNOWN_LAYOUT_CODES = new Set(
  KEYBOARD_ROWS.flat().flatMap((keyboardKey) => keyboardKey.codes)
);

const SPECIAL_KEY_LABELS = new Map<number, string>([
  [VK.backspace, "Back"],
  [VK.tab, "Tab"],
  [VK.enter, "Enter"],
  [VK.shift, "Shift"],
  [VK.control, "Ctrl"],
  [VK.alt, "Alt"],
  [VK.escape, "Esc"],
  [VK.space, "Space"],
  [VK.left, "Left"],
  [VK.up, "Up"],
  [VK.right, "Right"],
  [VK.down, "Down"],
  [VK.leftShift, "L Shift"],
  [VK.rightShift, "R Shift"],
  [VK.leftControl, "L Ctrl"],
  [VK.rightControl, "R Ctrl"],
  [VK.leftAlt, "L Alt"],
  [VK.rightAlt, "R Alt"]
]);

export function isKeyboardKeyActive(
  keyboardKey: KeyboardKey,
  pressedKeys: ReadonlySet<number>
) {
  return keyboardKey.codes.some((code) => pressedKeys.has(code));
}

export function otherPressedKeyLabels(
  pressedKeys: readonly number[],
  limit = 6
) {
  return pressedKeys
    .filter((code) => !KNOWN_LAYOUT_CODES.has(code))
    .sort((left, right) => left - right)
    .slice(0, limit)
    .map(keyLabel);
}

export function keyLabel(code: number) {
  const special = SPECIAL_KEY_LABELS.get(code);
  if (special) {
    return special;
  }

  if (code >= VK.digit0 && code <= VK.digit0 + 9) {
    return String.fromCharCode(code);
  }

  if (code >= VK.a && code <= VK.z) {
    return String.fromCharCode(code);
  }

  if (code >= 0x70 && code <= 0x7b) {
    return `F${code - 0x6f}`;
  }

  return `VK ${code}`;
}

export function movementMagnitude(movement: MouseMovement) {
  return Math.hypot(movement.x, movement.y);
}

export function wheelMagnitude(movement: MouseMovement) {
  return Math.abs(movement.wheelX) + Math.abs(movement.wheelY);
}

function key(
  id: string,
  label: string,
  codeOrCodes: number | number[],
  width?: KeyboardKey["width"]
): KeyboardKey {
  return {
    id,
    label,
    codes: Array.isArray(codeOrCodes) ? codeOrCodes : [codeOrCodes],
    width
  };
}
