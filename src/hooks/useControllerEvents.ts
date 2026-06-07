import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import type { ControllerDeviceEvent } from "../types/controller";

const MAX_DEVICE_EVENTS = 200;

export function useControllerEvents(): ControllerDeviceEvent[] {
  const [events, setEvents] = useState<ControllerDeviceEvent[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    listen<string>("controller-device-event", (event) => {
      if (disposed) {
        return;
      }

      const nextEvent: ControllerDeviceEvent = {
        id: nextId.current,
        message: event.payload,
        receivedAtMs: Date.now()
      };
      nextId.current += 1;

      setEvents((current) => [nextEvent, ...current].slice(0, MAX_DEVICE_EVENTS));
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

  return events;
}
