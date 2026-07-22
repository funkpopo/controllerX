import { useMemo } from "react";
import {
  KEYBOARD_ROWS,
  isKeyboardKeyActive,
  type KeyboardKey
} from "../data/keyboardMouse";
import type { KeyboardMouseSnapshot } from "../types/controller";
import type { Translation } from "../i18n";

type KeyboardMouseOverlayProps = {
  keyboardMouse: KeyboardMouseSnapshot;
  opacity: number;
  labels: Translation;
};

export function KeyboardMouseOverlay({
  keyboardMouse,
  opacity,
  labels
}: KeyboardMouseOverlayProps) {
  const pressedKeys = useMemo(
    () => new Set(keyboardMouse.pressedKeys),
    [keyboardMouse.pressedKeys]
  );

  return (
    <div className="keyboard-mouse-overlay" style={{ opacity }}>
      <div className="keyboard-panel" aria-label={labels.keyboardMouse.keyboardInput}>
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

      <div className="mouse-panel" aria-label={labels.keyboardMouse.mouseInput}>
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
              className={`mouse-wheel ${
                keyboardMouse.mouseButtons.middle ? "active" : ""
              }`}
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
            {keyboardMouse.error ?? labels.keyboardMouse.unavailable}
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
