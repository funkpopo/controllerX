import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { KeyboardMouseSnapshot } from "../types/controller";

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

export function useKeyboardMouseState(): KeyboardMouseSnapshot {
  const [state, setState] = useState<KeyboardMouseSnapshot>(
    EMPTY_KEYBOARD_MOUSE_STATE
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<KeyboardMouseSnapshot>("keyboard-mouse-state", (event) => {
      if (disposed) {
        return;
      }

      setState(event.payload);
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return state;
}
