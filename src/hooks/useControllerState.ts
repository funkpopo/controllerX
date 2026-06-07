import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import type { ControllerSnapshot } from "../types/controller";

export const EMPTY_CONTROLLER_STATE: ControllerSnapshot = {
  status: "noDevice",
  connected: false,
  id: null,
  name: null,
  device: null,
  profile: null,
  unsupported: null,
  buttons: {
    south: 0,
    east: 0,
    west: 0,
    north: 0,
    leftBumper: 0,
    rightBumper: 0,
    leftTriggerButton: 0,
    rightTriggerButton: 0,
    select: 0,
    start: 0,
    mode: 0,
    leftThumb: 0,
    rightThumb: 0,
    dpadUp: 0,
    dpadDown: 0,
    dpadLeft: 0,
    dpadRight: 0,
    misc1: 0,
    paddle1: 0,
    paddle2: 0,
    paddle3: 0,
    paddle4: 0,
    touchpad: 0
  },
  axes: {
    leftStickX: 0,
    leftStickY: 0,
    rightStickX: 0,
    rightStickY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
    dpadX: 0,
    dpadY: 0
  },
  updatedAtMs: 0
};

export function useControllerState(): ControllerSnapshot {
  const [state, setState] = useState<ControllerSnapshot>(EMPTY_CONTROLLER_STATE);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<ControllerSnapshot>("controller-state", (event) => {
      if (!disposed) {
        setState(event.payload);
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
      unlisten?.();
    };
  }, []);

  return state;
}
