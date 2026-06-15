import type { MouseMovement } from "../types/controller";

export type KeyboardKey = {
  id: string;
  label: string;
  codes: number[];
  width: number;
  topLabel?: string;
  subLabel?: string;
};

export const VK = {
  backspace: 0x08,
  tab: 0x09,
  enter: 0x0d,
  shift: 0x10,
  control: 0x11,
  alt: 0x12,
  capsLock: 0x14,
  escape: 0x1b,
  space: 0x20,
  left: 0x25,
  up: 0x26,
  right: 0x27,
  down: 0x28,
  delete: 0x2e,
  digit0: 0x30,
  digit1: 0x31,
  digit2: 0x32,
  digit3: 0x33,
  digit4: 0x34,
  digit5: 0x35,
  digit6: 0x36,
  digit7: 0x37,
  digit8: 0x38,
  digit9: 0x39,
  a: 0x41,
  b: 0x42,
  c: 0x43,
  d: 0x44,
  e: 0x45,
  f: 0x46,
  g: 0x47,
  h: 0x48,
  i: 0x49,
  j: 0x4a,
  k: 0x4b,
  l: 0x4c,
  m: 0x4d,
  n: 0x4e,
  o: 0x4f,
  p: 0x50,
  q: 0x51,
  r: 0x52,
  s: 0x53,
  t: 0x54,
  u: 0x55,
  v: 0x56,
  w: 0x57,
  x: 0x58,
  y: 0x59,
  z: 0x5a,
  leftWindows: 0x5b,
  rightWindows: 0x5c,
  leftShift: 0xa0,
  rightShift: 0xa1,
  leftControl: 0xa2,
  rightControl: 0xa3,
  leftAlt: 0xa4,
  rightAlt: 0xa5,
  semicolon: 0xba,
  equals: 0xbb,
  comma: 0xbc,
  minus: 0xbd,
  period: 0xbe,
  slash: 0xbf,
  bracketLeft: 0xdb,
  backslash: 0xdc,
  bracketRight: 0xdd,
  quote: 0xde
} as const;

const KEY = 48;

export const KEYBOARD_ROWS: KeyboardKey[][] = [
  [
    key("escape", "Esc", VK.escape),
    key("digit1", "1", VK.digit1, { topLabel: "!", subLabel: "F1" }),
    key("digit2", "2", VK.digit2, { topLabel: "@", subLabel: "F2" }),
    key("digit3", "3", VK.digit3, { topLabel: "#", subLabel: "F3" }),
    key("digit4", "4", VK.digit4, { topLabel: "$", subLabel: "F4" }),
    key("digit5", "5", VK.digit5, { topLabel: "%", subLabel: "F5" }),
    key("digit6", "6", VK.digit6, { topLabel: "^", subLabel: "F6" }),
    key("digit7", "7", VK.digit7, { topLabel: "&", subLabel: "F7" }),
    key("digit8", "8", VK.digit8, { topLabel: "*", subLabel: "F8" }),
    key("digit9", "9", VK.digit9, { topLabel: "(", subLabel: "F9" }),
    key("digit0", "0", VK.digit0, { topLabel: ")", subLabel: "F10" }),
    key("minus", "-", VK.minus, { topLabel: "_", subLabel: "F11" }),
    key("equals", "=", VK.equals, { topLabel: "+", subLabel: "F12" }),
    key("backspace", "Backspace", VK.backspace, { width: 98 })
  ],
  [
    key("tab", "Tab", VK.tab, { width: 74 }),
    key("q", "Q", VK.q),
    key("w", "W", VK.w),
    key("e", "E", VK.e),
    key("r", "R", VK.r),
    key("t", "T", VK.t),
    key("y", "Y", VK.y),
    key("u", "U", VK.u),
    key("i", "I", VK.i, { subLabel: "PrtSc" }),
    key("o", "O", VK.o, { subLabel: "ScrLk" }),
    key("p", "P", VK.p, { subLabel: "Pause" }),
    key("bracket-left", "[", VK.bracketLeft, { topLabel: "{" }),
    key("bracket-right", "]", VK.bracketRight, { topLabel: "}" }),
    key("backslash", "\\", VK.backslash, { topLabel: "|" })
  ],
  [
    key("caps-lock", "Caps Lock", VK.capsLock, { width: 90 }),
    key("a", "A", VK.a),
    key("s", "S", VK.s),
    key("d", "D", VK.d, { subLabel: "Ins" }),
    key("f", "F", VK.f),
    key("g", "G", VK.g),
    key("h", "H", VK.h),
    key("j", "J", VK.j),
    key("k", "K", VK.k, { subLabel: "Home" }),
    key("l", "L", VK.l, { subLabel: "PgUp" }),
    key("semicolon", ";", VK.semicolon, { topLabel: ":", subLabel: "BS" }),
    key("quote", "'", VK.quote, { topLabel: '"' }),
    key("enter", "Enter", VK.enter, { width: 102 })
  ],
  [
    key("left-shift", "Shift", [VK.shift, VK.leftShift], { width: 104 }),
    key("z", "Z", VK.z),
    key("x", "X", VK.x),
    key("c", "C", VK.c),
    key("v", "V", VK.v),
    key("b", "B", VK.b),
    key("n", "N", VK.n),
    key("m", "M", VK.m, { subLabel: "Del" }),
    key("comma", ",", VK.comma, { topLabel: "<" }),
    key("period", ".", VK.period, { topLabel: ">", subLabel: "End" }),
    key("slash", "/", VK.slash, { topLabel: "?", subLabel: "PgDn" }),
    key("right-shift", "Shift", VK.rightShift, { width: 62 }),
    key("up", "↑", VK.up),
    key("delete", "Del", VK.delete)
  ],
  [
    key("control", "Ctrl", [VK.control, VK.leftControl, VK.rightControl], {
      width: 64
    }),
    key("win", "Win", [VK.leftWindows, VK.rightWindows], { width: 64 }),
    key("alt", "Alt", [VK.alt, VK.leftAlt], { width: 64 }),
    key("space", "Space", VK.space, { width: 332, subLabel: "Fn" }),
    key("right-alt", "Alt", VK.rightAlt, { width: 64 }),
    key("fn", "Fn", [], { width: 48 }),
    key("left", "←", VK.left),
    key("down", "↓", VK.down),
    key("right", "→", VK.right)
  ]
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
  [VK.capsLock, "Caps"],
  [VK.escape, "Esc"],
  [VK.space, "Space"],
  [VK.left, "Left"],
  [VK.up, "Up"],
  [VK.right, "Right"],
  [VK.down, "Down"],
  [VK.delete, "Del"],
  [VK.leftWindows, "Win"],
  [VK.rightWindows, "Win"],
  [VK.leftShift, "L Shift"],
  [VK.rightShift, "R Shift"],
  [VK.leftControl, "L Ctrl"],
  [VK.rightControl, "R Ctrl"],
  [VK.leftAlt, "L Alt"],
  [VK.rightAlt, "R Alt"],
  [VK.semicolon, ";"],
  [VK.equals, "="],
  [VK.comma, ","],
  [VK.minus, "-"],
  [VK.period, "."],
  [VK.slash, "/"],
  [VK.bracketLeft, "["],
  [VK.backslash, "\\"],
  [VK.bracketRight, "]"],
  [VK.quote, "'"]
]);

export function isKeyboardKeyActive(
  keyboardKey: KeyboardKey,
  pressedKeys: ReadonlySet<number>
) {
  return keyboardKey.codes.some((code) => pressedKeys.has(code));
}

export function otherPressedKeyLabels(pressedKeys: readonly number[], limit = 6) {
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

export function wheelMagnitude(movement: MouseMovement) {
  return Math.abs(movement.wheelX) + Math.abs(movement.wheelY);
}

function key(
  id: string,
  label: string,
  codeOrCodes: number | number[],
  options: Partial<Pick<KeyboardKey, "width" | "topLabel" | "subLabel">> = {}
): KeyboardKey {
  return {
    id,
    label,
    codes: Array.isArray(codeOrCodes) ? codeOrCodes : [codeOrCodes],
    width: options.width ?? KEY,
    topLabel: options.topLabel,
    subLabel: options.subLabel
  };
}
