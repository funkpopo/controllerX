import { useMemo, type CSSProperties } from "react";
import {
  KEYBOARD_ROWS,
  MOUSE_BUTTONS,
  isKeyboardKeyActive,
  movementMagnitude,
  otherPressedKeyLabels,
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
  const extraKeys = useMemo(
    () => otherPressedKeyLabels(keyboardMouse.pressedKeys),
    [keyboardMouse.pressedKeys]
  );
  const movementActive = movementMagnitude(keyboardMouse.movement) > 0;
  const wheelActive = wheelMagnitude(keyboardMouse.movement) > 0;
  const motionStyle = {
    "--motion-x": `${clamp(keyboardMouse.movement.x, -32, 32)}px`,
    "--motion-y": `${clamp(keyboardMouse.movement.y, -22, 22)}px`
  } as CSSProperties;
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
        {extraKeys.length > 0 ? (
          <div className="keyboard-extra-row" aria-label="其他按键">
            {extraKeys.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mouse-panel" aria-label="鼠标输入">
        <div className="mouse-buttons">
          {MOUSE_BUTTONS.map((button) => (
            <span
              key={button.id}
              className={keyboardMouse.mouseButtons[button.id] ? "active" : ""}
            >
              {button.label}
            </span>
          ))}
        </div>
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
            {movementActive ? (
              <i
                key={`motion-${keyboardMouse.updatedAtMs}-${keyboardMouse.movement.x}-${keyboardMouse.movement.y}`}
                className="mouse-motion-dot"
                style={motionStyle}
              />
            ) : null}
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
        keyboardKey.width ? `keyboard-key-${keyboardKey.width}` : "",
        active ? "active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-active={active ? "true" : "false"}
    >
      {keyboardKey.label}
    </span>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
