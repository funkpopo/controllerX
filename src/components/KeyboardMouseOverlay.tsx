import { useEffect, useMemo, useRef, useState } from "react";
import {
  KEYBOARD_ROWS,
  isKeyboardKeyActive,
  keyboardMouseNaturalSize,
  type KeyboardKey
} from "../data/keyboardMouse";
import type { KeyboardMouseSnapshot } from "../types/controller";
import type { Translation } from "../i18n";

type KeyboardMouseOverlayProps = {
  keyboardMouse: KeyboardMouseSnapshot;
  opacity: number;
  labels: Translation;
};

/** Keep a thin edge so drop-shadow / active key glow is not clipped. */
const FIT_SAFE_PADDING_PX = 4;
const WARNING_EXTRA_HEIGHT_PX = 22;
const BASE_NATURAL = keyboardMouseNaturalSize();

export function KeyboardMouseOverlay({
  keyboardMouse,
  opacity,
  labels
}: KeyboardMouseOverlayProps) {
  const fitRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const pressedKeys = useMemo(
    () => new Set(keyboardMouse.pressedKeys),
    [keyboardMouse.pressedKeys]
  );

  const natural = useMemo(() => {
    const extraHeight = keyboardMouse.supported ? 0 : WARNING_EXTRA_HEIGHT_PX;
    return {
      width: BASE_NATURAL.width,
      height: BASE_NATURAL.height + extraHeight
    };
  }, [keyboardMouse.supported]);

  useEffect(() => {
    const node = fitRef.current;
    if (!node) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setBox({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });

    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  const availableWidth = box.width || natural.width;
  const availableHeight = box.height || natural.height;
  const fitWidth = Math.max(1, availableWidth - FIT_SAFE_PADDING_PX * 2);
  const fitHeight = Math.max(1, availableHeight - FIT_SAFE_PADDING_PX * 2);
  const stageScale = Math.min(
    fitWidth / natural.width,
    fitHeight / natural.height
  );
  const viewportWidth = natural.width * stageScale;
  const viewportHeight = natural.height * stageScale;

  return (
    <div className="keyboard-mouse-overlay" ref={fitRef} style={{ opacity }}>
      <div
        className="keyboard-mouse-stage-viewport"
        style={{
          width: `${viewportWidth}px`,
          height: `${viewportHeight}px`
        }}
      >
        <div
          className="keyboard-mouse-stage"
          style={{
            width: `${natural.width}px`,
            height: `${natural.height}px`,
            transform: `scale(${stageScale})`
          }}
        >
          <div
            className="keyboard-panel"
            aria-label={labels.keyboardMouse.keyboardInput}
          >
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
      className={["keyboard-key", active ? "active" : ""].filter(Boolean).join(" ")}
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
