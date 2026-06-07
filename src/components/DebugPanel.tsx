import type { ControllerDeviceEvent, ControllerSnapshot } from "../types/controller";

type DebugPanelProps = {
  controller: ControllerSnapshot;
  deviceEvents: ControllerDeviceEvent[];
};

export function DebugPanel({ controller, deviceEvents }: DebugPanelProps) {
  return (
    <aside className="debug-panel">
      <div className="debug-header">
        <span>{controller.status}</span>
        <span>{controller.profile?.id ?? "no-profile"}</span>
      </div>
      <ValueGrid
        title="Buttons"
        values={{
          south: controller.buttons.south,
          east: controller.buttons.east,
          west: controller.buttons.west,
          north: controller.buttons.north,
          l1: controller.buttons.leftBumper,
          r1: controller.buttons.rightBumper,
          l2b: controller.buttons.leftTriggerButton,
          r2b: controller.buttons.rightTriggerButton,
          select: controller.buttons.select,
          start: controller.buttons.start,
          mode: controller.buttons.mode,
          ls: controller.buttons.leftThumb,
          rs: controller.buttons.rightThumb,
          up: controller.buttons.dpadUp,
          down: controller.buttons.dpadDown,
          left: controller.buttons.dpadLeft,
          right: controller.buttons.dpadRight
        }}
      />
      <ValueGrid
        title="Axes"
        values={{
          lx: controller.axes.leftStickX,
          ly: controller.axes.leftStickY,
          rx: controller.axes.rightStickX,
          ry: controller.axes.rightStickY,
          lt: controller.axes.leftTrigger,
          rt: controller.axes.rightTrigger,
          dx: controller.axes.dpadX,
          dy: controller.axes.dpadY
        }}
      />
      {controller.device ? (
        <div className="debug-device">
          <span>VID {formatHex(controller.device.vendorId)}</span>
          <span>PID {formatHex(controller.device.productId)}</span>
        </div>
      ) : null}
      <section className="debug-section">
        <h2>Device events</h2>
        <div className="debug-events">
          {deviceEvents.length > 0 ? (
            deviceEvents.map((event) => (
              <div key={event.id}>
                <span>{formatEventTime(event.receivedAtMs)}</span>
                <strong>{event.message}</strong>
              </div>
            ))
          ) : (
            <p>No device events received.</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function ValueGrid({
  title,
  values
}: {
  title: string;
  values: Record<string, number>;
}) {
  return (
    <section className="debug-section">
      <h2>{title}</h2>
      <div className="debug-grid">
        {Object.entries(values).map(([label, value]) => (
          <div key={label} className={Math.abs(value) > 0.01 ? "active" : ""}>
            <span>{label}</span>
            <strong>{value.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatHex(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `0x${value.toString(16).padStart(4, "0")}`;
}

function formatEventTime(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
