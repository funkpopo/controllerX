import { useMemo, type CSSProperties } from "react";
import {
  KEYBOARD_ROWS,
  isKeyboardKeyActive,
  wheelMagnitude,
  type KeyboardKey
} from "../data/keyboardMouse";
import type { KeyboardMouseSnapshot } from "../types/controller";

type KeyboardMouseOverlayProps = {
  keyboardMouse: KeyboardMouseSnapshot;
  opacity: number;
};

export function KeyboardMouseOverlay({
  keyboardMouse,
  opacity
}: KeyboardMouseOverlayProps) {
  const pressedKeys = useMemo(
    () => new Set(keyboardMouse.pressedKeys),
    [keyboardMouse.pressedKeys]
  );
  const wheelActive = wheelMagnitude(keyboardMouse.movement) > 0;
  const wheelStyle = {
    "--wheel-x": `${clamp(keyboardMouse.movement.wheelX / 12, -18, 18)}px`,
    "--wheel-y": `${clamp(-keyboardMouse.movement.wheelY / 12, -18, 18)}px`
  } as CSSProperties;

  return (
    <div className="keyboard-mouse-overlay" style={{ opacity }}>
      <div className="keyboard-panel" aria-label="键盘输入">
        {KEYBOARD_ROWS.map((row, rowIndex) => (
          <div className="keyboard-row" key={rowIndex}>
            {row.map((keyboardKey) => (
              <KeyboardKeyCell
                key={keyboardKey.id}
                keyboardKey={keyboardKey}
                active={isKeyboardKeyActive(keyboardKey, pressedKeys)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mouse-panel" aria-label="鼠标输入">
        <div className="mouse-visual">
          <div className="mouse-shell">
            <span
              className={`mouse-main-button mouse-left ${
                keyboardMouse.mouseButtons.left ? "active" : ""
              }`}
            />
            <span
              className={`mouse-main-button mouse-right ${
                keyboardMouse.mouseButtons.right ? "active" : ""
              }`}
            />
            <span
              key={`wheel-${keyboardMouse.updatedAtMs}-${keyboardMouse.movement.wheelX}-${keyboardMouse.movement.wheelY}`}
              className={`mouse-wheel ${wheelActive ? "active" : ""}`}
              style={wheelStyle}
            />
            <span
              className={`mouse-side mouse-x1 ${
                keyboardMouse.mouseButtons.x1 ? "active" : ""
              }`}
            />
            <span
              className={`mouse-side mouse-x2 ${
                keyboardMouse.mouseButtons.x2 ? "active" : ""
              }`}
            />
          </div>
        </div>
        {!keyboardMouse.supported ? (
          <div className="keyboard-mouse-warning">
            {keyboardMouse.error ?? "键鼠采集不可用"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KeyboardKeyCell({
  keyboardKey,
  active
}: {
  keyboardKey: KeyboardKey;
  active: boolean;
}) {
  return (
    <span
      className={[
        "keyboard-key",
        active ? "active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-active={active ? "true" : "false"}
      style={{ width: `${keyboardKey.width}px` }}
    >
      {keyboardKey.topLabel ? (
        <span className="keyboard-key-top">{keyboardKey.topLabel}</span>
      ) : null}
      <span className="keyboard-key-label">{keyboardKey.label}</span>
      {keyboardKey.subLabel ? (
        <span className="keyboard-key-sub">{keyboardKey.subLabel}</span>
      ) : null}
    </span>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
