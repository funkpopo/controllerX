import { keyLabel } from "../data/keyboardMouse";
import type {
  ControllerDeviceEvent,
  ControllerSnapshot,
  KeyboardMouseSnapshot
} from "../types/controller";

type DebugPanelProps = {
  controller: ControllerSnapshot;
  keyboardMouse: KeyboardMouseSnapshot;
  deviceEvents: ControllerDeviceEvent[];
};

export function DebugPanel({
  controller,
  keyboardMouse,
  deviceEvents
}: DebugPanelProps) {
  const pressedKeyLabels = keyboardMouse.pressedKeys.map(keyLabel);

  return (
    <aside className="debug-panel">
      <div className="debug-header">
        <span>{controller.status}</span>
        <span>{controller.profile?.id ?? "无配置"}</span>
      </div>
      <ValueGrid
        title="按键"
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
          right: controller.buttons.dpadRight,
          misc1: controller.buttons.misc1,
          p1: controller.buttons.paddle1,
          p2: controller.buttons.paddle2,
          p3: controller.buttons.paddle3,
          p4: controller.buttons.paddle4,
          touch: controller.buttons.touchpad
        }}
      />
      <ValueGrid
        title="摇杆/轴"
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
      <ValueGrid
        title="键鼠"
        values={{
          ml: keyboardMouse.mouseButtons.left ? 1 : 0,
          mr: keyboardMouse.mouseButtons.right ? 1 : 0,
          mm: keyboardMouse.mouseButtons.middle ? 1 : 0,
          x1: keyboardMouse.mouseButtons.x1 ? 1 : 0,
          x2: keyboardMouse.mouseButtons.x2 ? 1 : 0,
          dx: keyboardMouse.movement.x,
          dy: keyboardMouse.movement.y,
          wx: keyboardMouse.movement.wheelX,
          wy: keyboardMouse.movement.wheelY
        }}
      />
      <section className="debug-section">
        <h2>键盘</h2>
        <div className="debug-events">
          <p>
            {keyboardMouse.supported
              ? pressedKeyLabels.length > 0
                ? pressedKeyLabels.join(", ")
                : "无按键"
              : keyboardMouse.error ?? "键鼠采集不可用"}
          </p>
        </div>
      </section>
      {controller.device ? (
        <div className="debug-device">
          <span>VID {formatHex(controller.device.vendorId)}</span>
          <span>PID {formatHex(controller.device.productId)}</span>
          {controller.device.xinput ? (
            <span>
              XInput slot {controller.device.xinput.slot + 1} pkt{" "}
              {controller.device.xinput.packetNumber}
            </span>
          ) : null}
          {controller.device.xinputDriver ? (
            <span>
              XInput{" "}
              {controller.device.xinputDriver.service ??
                controller.device.xinputDriver.source}
            </span>
          ) : null}
        </div>
      ) : null}
      <section className="debug-section">
        <h2>设备事件</h2>
        <div className="debug-events">
          {deviceEvents.length > 0 ? (
            deviceEvents.map((event) => (
              <div key={event.id}>
                <span>{formatEventTime(event.receivedAtMs)}</span>
                <strong>{event.message}</strong>
              </div>
            ))
          ) : (
            <p>暂无设备事件。</p>
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
