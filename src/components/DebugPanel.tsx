import { keyLabel } from "../data/keyboardMouse";
import type {
  ControllerDeviceEvent,
  ControllerSnapshot,
  InputSettings,
  KeyboardMouseSnapshot
} from "../types/controller";
import type { Translation } from "../i18n";

type DebugPanelProps = {
  controller: ControllerSnapshot;
  keyboardMouse: KeyboardMouseSnapshot;
  deviceEvents: ControllerDeviceEvent[];
  inputSettings: InputSettings;
  labels: Translation;
};

export function DebugPanel({
  controller,
  keyboardMouse,
  deviceEvents,
  inputSettings,
  labels
}: DebugPanelProps) {
  const pressedKeyLabels = keyboardMouse.pressedKeys.map(keyLabel);
  const calibration = controller.profile?.calibrationStatus;

  return (
    <aside className="debug-panel">
      <div className="debug-header">
        <span>{controller.status}</span>
        <span>{controller.profile?.id ?? labels.debug.noProfile}</span>
      </div>
      {calibration ? (
        <section className="debug-section">
          <h2>{labels.debug.calibration}</h2>
          <div className="debug-grid">
            <div className={calibration.presetCalibrated ? "active" : ""}>
              <span>{labels.debug.presetCalibrated}</span>
              <strong>
                {calibration.presetCalibrated ? labels.debug.yes : labels.debug.no}
              </strong>
            </div>
            <div className={calibration.inputMapCalibrated ? "active" : ""}>
              <span>{labels.debug.inputMapCalibrated}</span>
              <strong>
                {calibration.inputMapCalibrated ? labels.debug.yes : labels.debug.no}
              </strong>
            </div>
            <div className={calibration.hardwareVerified ? "active" : ""}>
              <span>{labels.debug.hardwareVerified}</span>
              <strong>
                {calibration.hardwareVerified ? labels.debug.yes : labels.debug.no}
              </strong>
            </div>
          </div>
          {calibration.notes ? (
            <p className="debug-notes">
              {calibration.notes === "dualshock4_no_preset"
                ? labels.status.dualshock4NoPreset
                : calibration.notes}
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="debug-section">
        <h2>{labels.debug.stickVisualizer}</h2>
        <div className="stick-visualizers">
          <StickPad
            label="L"
            x={controller.axes.leftStickX}
            y={controller.axes.leftStickY}
            deadzone={inputSettings.leftStickDeadzone}
          />
          <StickPad
            label="R"
            x={controller.axes.rightStickX}
            y={controller.axes.rightStickY}
            deadzone={inputSettings.rightStickDeadzone}
          />
        </div>
      </section>
      <ValueGrid
        title={labels.debug.buttons}
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
        title={labels.debug.axes}
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
        title={labels.debug.keyboardMouse}
        values={{
          ml: keyboardMouse.mouseButtons.left ? 1 : 0,
          mr: keyboardMouse.mouseButtons.right ? 1 : 0,
          mm: keyboardMouse.mouseButtons.middle ? 1 : 0,
          x1: keyboardMouse.mouseButtons.x1 ? 1 : 0,
          x2: keyboardMouse.mouseButtons.x2 ? 1 : 0
        }}
      />
      <section className="debug-section">
        <h2>{labels.debug.keyboard}</h2>
        <div className="debug-events">
          <p>
            {keyboardMouse.supported
              ? pressedKeyLabels.length > 0
                ? pressedKeyLabels.join(", ")
                : labels.debug.noKeys
              : keyboardMouse.error ?? labels.keyboardMouse.unavailable}
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
        <h2>{labels.debug.deviceEvents}</h2>
        <div className="debug-events">
          {deviceEvents.length > 0 ? (
            deviceEvents.map((event) => (
              <div key={event.id}>
                <span>{formatEventTime(event.receivedAtMs)}</span>
                <strong>{event.message}</strong>
              </div>
            ))
          ) : (
            <p>{labels.debug.noDeviceEvents}</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function StickPad({
  label,
  x,
  y,
  deadzone
}: {
  label: string;
  x: number;
  y: number;
  deadzone: number;
}) {
  const size = 72;
  const center = size / 2;
  const radius = center - 4;
  const deadzoneRadius = Math.min(radius, deadzone * radius);
  const dotX = center + x * radius;
  const dotY = center + y * radius;

  return (
    <div className="stick-pad" aria-label={`${label} stick`}>
      <span className="stick-pad-label">{label}</span>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stick-pad-ring"
        />
        <circle
          cx={center}
          cy={center}
          r={deadzoneRadius}
          className="stick-pad-deadzone"
        />
        <line
          x1={center}
          y1={4}
          x2={center}
          y2={size - 4}
          className="stick-pad-cross"
        />
        <line
          x1={4}
          y1={center}
          x2={size - 4}
          y2={center}
          className="stick-pad-cross"
        />
        <circle cx={dotX} cy={dotY} r={3.5} className="stick-pad-dot" />
      </svg>
      <span className="stick-pad-coords">
        {x.toFixed(2)}, {y.toFixed(2)}
      </span>
    </div>
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
