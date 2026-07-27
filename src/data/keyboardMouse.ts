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

/** Base unit key size — kept compact so the stage can fill typical overlay windows. */
export const KEY = 42;
export const KEYBOARD_KEY_GAP = 3;
export const KEYBOARD_PANEL_PADDING = 5;
export const KEYBOARD_MOUSE_GAP = 8;
export const MOUSE_PANEL_WIDTH = 110;

export const KEYBOARD_ROWS: KeyboardKey[][] = [
  [
    key("escape", "Esc", VK.escape),
    key("digit1", "1", VK.digit1, { topLabel: "!" }),
    key("digit2", "2", VK.digit2, { topLabel: "@" }),
    key("digit3", "3", VK.digit3, { topLabel: "#" }),
    key("digit4", "4", VK.digit4, { topLabel: "$" }),
    key("digit5", "5", VK.digit5, { topLabel: "%" }),
    key("digit6", "6", VK.digit6, { topLabel: "^" }),
    key("digit7", "7", VK.digit7, { topLabel: "&" }),
    key("digit8", "8", VK.digit8, { topLabel: "*" }),
    key("digit9", "9", VK.digit9, { topLabel: "(" }),
    key("digit0", "0", VK.digit0, { topLabel: ")" }),
    key("minus", "-", VK.minus, { topLabel: "_" }),
    key("equals", "=", VK.equals, { topLabel: "+" }),
    key("backspace", "Backspace", VK.backspace, { width: 86 })
  ],
  [
    key("tab", "Tab", VK.tab, { width: 66 }),
    key("q", "Q", VK.q),
    key("w", "W", VK.w),
    key("e", "E", VK.e),
    key("r", "R", VK.r),
    key("t", "T", VK.t),
    key("y", "Y", VK.y),
    key("u", "U", VK.u),
    key("i", "I", VK.i),
    key("o", "O", VK.o),
    key("p", "P", VK.p),
    key("bracket-left", "[", VK.bracketLeft, { topLabel: "{" }),
    key("bracket-right", "]", VK.bracketRight, { topLabel: "}" }),
    key("backslash", "\\", VK.backslash, { topLabel: "|" })
  ],
  [
    key("caps-lock", "Caps Lock", VK.capsLock, { width: 80 }),
    key("a", "A", VK.a),
    key("s", "S", VK.s),
    key("d", "D", VK.d),
    key("f", "F", VK.f),
    key("g", "G", VK.g),
    key("h", "H", VK.h),
    key("j", "J", VK.j),
    key("k", "K", VK.k),
    key("l", "L", VK.l),
    key("semicolon", ";", VK.semicolon, { topLabel: ":" }),
    key("quote", "'", VK.quote, { topLabel: '"' }),
    key("enter", "Enter", VK.enter, { width: 90 })
  ],
  [
    key("left-shift", "L Shift", [VK.shift, VK.leftShift], { width: 92 }),
    key("z", "Z", VK.z),
    key("x", "X", VK.x),
    key("c", "C", VK.c),
    key("v", "V", VK.v),
    key("b", "B", VK.b),
    key("n", "N", VK.n),
    key("m", "M", VK.m),
    key("comma", ",", VK.comma, { topLabel: "<" }),
    key("period", ".", VK.period, { topLabel: ">" }),
    key("slash", "/", VK.slash, { topLabel: "?" }),
    key("right-shift", "R Shift", VK.rightShift, { width: 54 }),
    key("up", "↑", VK.up),
    key("delete", "Del", VK.delete)
  ],
  [
    // Left/right modifiers use distinct codes so each side can highlight alone.
    key("left-control", "L Ctrl", [VK.control, VK.leftControl], { width: 56 }),
    key("win", "Win", [VK.leftWindows, VK.rightWindows], { width: 56 }),
    key("left-alt", "L Alt", [VK.alt, VK.leftAlt], { width: 56 }),
    key("space", "Space", VK.space, { width: 292 }),
    key("right-alt", "R Alt", VK.rightAlt, { width: 56 }),
    key("right-control", "R Ctrl", VK.rightControl, { width: 42 }),
    key("left", "←", VK.left),
    key("down", "↓", VK.down),
    key("right", "→", VK.right)
  ]
];

/** Unscaled keyboard+mouse stage size used for first paint before DOM measure. */
export function keyboardMouseNaturalSize() {
  const rowWidths = KEYBOARD_ROWS.map(
    (row) =>
      row.reduce((sum, keyboardKey) => sum + keyboardKey.width, 0) +
      KEYBOARD_KEY_GAP * Math.max(0, row.length - 1)
  );
  const keyboardWidth =
    Math.max(...rowWidths, 0) + KEYBOARD_PANEL_PADDING * 2 + 4; // + border
  const keyboardHeight =
    KEYBOARD_ROWS.length * KEY +
    KEYBOARD_KEY_GAP * Math.max(0, KEYBOARD_ROWS.length - 1) +
    KEYBOARD_PANEL_PADDING * 2 +
    4;
  // Mouse panel is CSS-sized; keep a stable estimate that matches styles.css.
  const mouseWidth = MOUSE_PANEL_WIDTH + 4;
  const mouseHeight = 118;
  return {
    width: keyboardWidth + KEYBOARD_MOUSE_GAP + mouseWidth,
    height: Math.max(keyboardHeight, mouseHeight)
  };
}

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
