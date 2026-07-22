import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { KeyboardMouseSnapshot, MouseButtons } from "../types/controller";

export const EMPTY_KEYBOARD_MOUSE_STATE: KeyboardMouseSnapshot = {
  supported: true,
  error: null,
  pressedKeys: [],
  mouseButtons: {
    left: false,
    right: false,
    middle: false,
    x1: false,
    x2: false
  },
  updatedAtMs: 0
};

/** Pure helper: whether a new snapshot should trigger a React update. */
export function shouldCommitKeyboardMouseSnapshot(
  previous: KeyboardMouseSnapshot | null,
  next: KeyboardMouseSnapshot
): boolean {
  if (!previous) {
    return true;
  }

  if (
    previous.supported !== next.supported ||
    previous.error !== next.error ||
    !sameMouseButtons(previous.mouseButtons, next.mouseButtons)
  ) {
    return true;
  }

  return !samePressedKeys(previous.pressedKeys, next.pressedKeys);
}

function sameMouseButtons(left: MouseButtons, right: MouseButtons): boolean {
  return (
    left.left === right.left &&
    left.right === right.right &&
    left.middle === right.middle &&
    left.x1 === right.x1 &&
    left.x2 === right.x2
  );
}

function samePressedKeys(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function useKeyboardMouseState(): KeyboardMouseSnapshot {
  const [state, setState] = useState<KeyboardMouseSnapshot>(
    EMPTY_KEYBOARD_MOUSE_STATE
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let frame: number | null = null;
    let latest: KeyboardMouseSnapshot | null = null;
    let committed: KeyboardMouseSnapshot | null = null;

    // Snapshots can arrive faster than the display refreshes; coalesce them to
    // one React state update per animation frame, and skip no-op payloads.
    listen<KeyboardMouseSnapshot>("keyboard-mouse-state", (event) => {
      if (disposed) {
        return;
      }

      latest = event.payload;
      if (frame === null) {
        frame = window.requestAnimationFrame(() => {
          frame = null;
          if (!disposed && latest && shouldCommitKeyboardMouseSnapshot(committed, latest)) {
            committed = latest;
            setState(latest);
          }
        });
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      disposed = true;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      unlisten?.();
    };
  }, []);

  return state;
}
