import type {
  ControllerAxes,
  ControllerButtons,
  ControllerDeviceEvent,
  ControllerSnapshot,
  DeviceIdentity,
  ProfileInfo
} from "../types/controller";

export type ButtonInput = { key: keyof ControllerButtons; label: string };

export const STANDARD_BUTTON_INPUTS = [
  { key: "south", label: "South" },
  { key: "east", label: "East" },
  { key: "west", label: "West" },
  { key: "north", label: "North" },
  { key: "leftBumper", label: "Left bumper" },
  { key: "rightBumper", label: "Right bumper" },
  { key: "select", label: "Select / Share / Back" },
  { key: "start", label: "Start / Options / Menu" },
  { key: "mode", label: "Mode / Guide / PS" },
  { key: "leftThumb", label: "Left thumb" },
  { key: "rightThumb", label: "Right thumb" },
  { key: "dpadUp", label: "D-Pad up" },
  { key: "dpadDown", label: "D-Pad down" },
  { key: "dpadLeft", label: "D-Pad left" },
  { key: "dpadRight", label: "D-Pad right" }
] as const satisfies ReadonlyArray<ButtonInput>;

export const OPTIONAL_BUTTON_INPUTS = [
  { key: "leftTriggerButton", label: "Left trigger button" },
  { key: "rightTriggerButton", label: "Right trigger button" },
  { key: "misc1", label: "Misc 1 / DualSense mute" },
  { key: "paddle1", label: "Paddle 1" },
  { key: "paddle2", label: "Paddle 2" },
  { key: "paddle3", label: "Paddle 3" },
  { key: "paddle4", label: "Paddle 4" },
  { key: "touchpad", label: "Touchpad button" }
] as const satisfies ReadonlyArray<ButtonInput>;

export const BUTTON_INPUTS = [
  ...STANDARD_BUTTON_INPUTS,
  ...OPTIONAL_BUTTON_INPUTS
] as const satisfies ReadonlyArray<ButtonInput>;

export const AXIS_KEYS = [
  "leftStickX",
  "leftStickY",
  "rightStickX",
  "rightStickY",
  "leftTrigger",
  "rightTrigger",
  "dpadX",
  "dpadY"
] as const satisfies ReadonlyArray<keyof ControllerAxes>;

export const AXIS_REQUIREMENTS = [
  {
    id: "leftStickXNegative",
    axis: "leftStickX",
    label: "Left stick X negative",
    kind: "negative",
    threshold: 0.75
  },
  {
    id: "leftStickXPositive",
    axis: "leftStickX",
    label: "Left stick X positive",
    kind: "positive",
    threshold: 0.75
  },
  {
    id: "leftStickYNegative",
    axis: "leftStickY",
    label: "Left stick Y negative",
    kind: "negative",
    threshold: 0.75
  },
  {
    id: "leftStickYPositive",
    axis: "leftStickY",
    label: "Left stick Y positive",
    kind: "positive",
    threshold: 0.75
  },
  {
    id: "rightStickXNegative",
    axis: "rightStickX",
    label: "Right stick X negative",
    kind: "negative",
    threshold: 0.75
  },
  {
    id: "rightStickXPositive",
    axis: "rightStickX",
    label: "Right stick X positive",
    kind: "positive",
    threshold: 0.75
  },
  {
    id: "rightStickYNegative",
    axis: "rightStickY",
    label: "Right stick Y negative",
    kind: "negative",
    threshold: 0.75
  },
  {
    id: "rightStickYPositive",
    axis: "rightStickY",
    label: "Right stick Y positive",
    kind: "positive",
    threshold: 0.75
  },
  {
    id: "leftTriggerGradual",
    axis: "leftTrigger",
    label: "Left trigger gradual pressure",
    kind: "trigger",
    threshold: 0.9,
    partialMin: 0.12,
    partialMax: 0.85
  },
  {
    id: "rightTriggerGradual",
    axis: "rightTrigger",
    label: "Right trigger gradual pressure",
    kind: "trigger",
    threshold: 0.9,
    partialMin: 0.12,
    partialMax: 0.85
  },
  {
    id: "dpadXNegative",
    axis: "dpadX",
    label: "D-Pad axis left",
    kind: "negative",
    threshold: 0.75
  },
  {
    id: "dpadXPositive",
    axis: "dpadX",
    label: "D-Pad axis right",
    kind: "positive",
    threshold: 0.75
  },
  {
    id: "dpadYNegative",
    axis: "dpadY",
    label: "D-Pad axis up",
    kind: "negative",
    threshold: 0.75
  },
  {
    id: "dpadYPositive",
    axis: "dpadY",
    label: "D-Pad axis down",
    kind: "positive",
    threshold: 0.75
  }
] as const satisfies ReadonlyArray<{
  id: string;
  axis: keyof ControllerAxes;
  label: string;
  kind: "positive" | "negative" | "trigger";
  threshold: number;
  partialMin?: number;
  partialMax?: number;
}>;

export const VISUAL_CHECKS = [
  { id: "autoProfile", label: "Auto profile selected expected profile" },
  { id: "visualPreset", label: "Visual preset matches sourced PNG state" },
  { id: "leftStickDirection", label: "Left stick visual direction verified" },
  { id: "rightStickDirection", label: "Right stick visual direction verified" },
  { id: "dpadVisual", label: "D-Pad visual state verified" },
  { id: "triggerVisual", label: "Trigger partial-pressure visual state verified" },
  { id: "noVisualFallback", label: "No replacement controller image used" }
] as const;

export const WINDOW_CHECKS = [
  { id: "transparent", label: "Transparent background visible" },
  { id: "alwaysOnTop", label: "Window stays always on top" },
  { id: "taskbar", label: "Taskbar entry exists" },
  { id: "tray", label: "Tray show/hide works" },
  { id: "clickThrough", label: "Click-through passes mouse events" },
  { id: "lockPosition", label: "Lock-position prevents resize/move changes" },
  { id: "persistence", label: "Position and size persist after restart" },
  { id: "idleToolbar", label: "Toolbar hides after idle when enabled" }
] as const;

export type ButtonCoverage = Record<keyof ControllerButtons, boolean>;
export type AxisStats = Record<
  keyof ControllerAxes,
  {
    min: number;
    max: number;
    samples: number;
    partialSamples: number;
  }
>;
export type ManualCheckId =
  | (typeof VISUAL_CHECKS)[number]["id"]
  | (typeof WINDOW_CHECKS)[number]["id"];
export type ManualChecks = Record<ManualCheckId, boolean>;

export type InputCoverage = {
  buttons: ButtonCoverage;
  axes: AxisStats;
};

export type HardwareObservation = {
  device: DeviceIdentity | null;
  profile: ProfileInfo | null;
  name: string | null;
  firstSeenAtMs: number;
  lastSeenAtMs: number;
};

export type HardwareReportInput = {
  expectedProfileId: string;
  connection: string;
  tester: string;
  notes: string;
  startedAtMs: number;
  endedAtMs: number;
  observation: HardwareObservation | null;
  latestController: ControllerSnapshot;
  coverage: InputCoverage;
  manualChecks: ManualChecks;
  deviceEvents: ControllerDeviceEvent[];
  simulationSeen: boolean;
  unsupportedReasons: string[];
};

export function createEmptyInputCoverage(): InputCoverage {
  return {
    buttons: Object.fromEntries(
      BUTTON_INPUTS.map((button) => [button.key, false])
    ) as ButtonCoverage,
    axes: Object.fromEntries(
      AXIS_KEYS.map((axis) => [
        axis,
        { min: 0, max: 0, samples: 0, partialSamples: 0 }
      ])
    ) as AxisStats
  };
}

export function createEmptyManualChecks(): ManualChecks {
  return Object.fromEntries(
    [...VISUAL_CHECKS, ...WINDOW_CHECKS].map((check) => [check.id, false])
  ) as ManualChecks;
}

export function updateInputCoverage(
  coverage: InputCoverage,
  controller: ControllerSnapshot
): InputCoverage {
  if (controller.status !== "active") {
    return coverage;
  }

  const buttons = { ...coverage.buttons };
  for (const button of BUTTON_INPUTS) {
    if (controller.buttons[button.key] >= 0.5) {
      buttons[button.key] = true;
    }
  }

  const axes = { ...coverage.axes };
  for (const axis of AXIS_KEYS) {
    const value = controller.axes[axis];
    const current = axes[axis];
    const triggerPartial =
      (axis === "leftTrigger" || axis === "rightTrigger") &&
      value > 0.12 &&
      value < 0.85;
    axes[axis] = {
      min: Math.min(current.min, value),
      max: Math.max(current.max, value),
      samples: current.samples + 1,
      partialSamples: current.partialSamples + (triggerPartial ? 1 : 0)
    };
  }

  return { buttons, axes };
}

export function isAxisRequirementCovered(
  requirement: (typeof AXIS_REQUIREMENTS)[number],
  stats: AxisStats
) {
  const axis = stats[requirement.axis];
  if (requirement.kind === "positive") {
    return axis.max >= requirement.threshold;
  }

  if (requirement.kind === "negative") {
    return axis.min <= -requirement.threshold;
  }

  return axis.max >= requirement.threshold && axis.partialSamples >= 2;
}

export function requiredButtonInputs(profileId: string): ReadonlyArray<ButtonInput> {
  if (profileId === "dualsense") {
    return [
      ...STANDARD_BUTTON_INPUTS,
      buttonInput("misc1"),
      buttonInput("touchpad")
    ];
  }

  if (profileId === "dualshock-4") {
    return [...STANDARD_BUTTON_INPUTS, buttonInput("touchpad")];
  }

  return STANDARD_BUTTON_INPUTS;
}

export function summarizeCoverage(coverage: InputCoverage, profileId = "") {
  const requiredButtons = requiredButtonInputs(profileId);
  const buttonCovered = requiredButtons.filter(
    (button) => coverage.buttons[button.key]
  ).length;
  const axisCovered = AXIS_REQUIREMENTS.filter((requirement) =>
    isAxisRequirementCovered(requirement, coverage.axes)
  ).length;

  return {
    buttonCovered,
    buttonTotal: requiredButtons.length,
    axisCovered,
    axisTotal: AXIS_REQUIREMENTS.length
  };
}

export function isRealDeviceEvent(event: ControllerDeviceEvent) {
  return (
    !event.message.startsWith("Simulated") &&
    (event.message.includes("Connected") || event.message.includes("Disconnected"))
  );
}

export function hasRealConnectEvent(events: ControllerDeviceEvent[]) {
  return events.some(
    (event) =>
      isRealDeviceEvent(event) &&
      event.message.includes("Connected") &&
      !event.message.includes("Disconnected")
  );
}

export function hasRealDisconnectEvent(events: ControllerDeviceEvent[]) {
  return events.some(
    (event) => isRealDeviceEvent(event) && event.message.includes("Disconnected")
  );
}

export function buildReportFileName(input: HardwareReportInput) {
  const device = input.observation?.device ?? input.latestController.device;
  const profileId =
    input.expectedProfileId ||
    input.observation?.profile?.id ||
    input.latestController.profile?.id ||
    "unknown-profile";
  const deviceName =
    device?.name ?? input.observation?.name ?? input.latestController.name ?? "unknown-device";
  const timestamp = compactTimestamp(input.endedAtMs);
  const vid = formatHexPart(device?.vendorId, "novid");
  const pid = formatHexPart(device?.productId, "nopid");
  const prefix = `${timestamp}-${safeFilePart(profileId)}-${safeFilePart(input.connection)}-${vid}-${pid}-`;
  const suffix = ".md";
  const devicePart = safeFilePart(deviceName);
  const maxDevicePartLength = Math.max(1, 140 - prefix.length - suffix.length);

  return `${prefix}${devicePart.slice(0, maxDevicePartLength)}${suffix}`;
}

export function buildHardwareVerificationReport(input: HardwareReportInput) {
  const observation = input.observation;
  const expectedProfile = input.expectedProfileId || "not-selected";
  const observedProfile =
    observation?.profile?.id ?? input.latestController.profile?.id ?? "not-detected";
  const coverage = summarizeCoverage(input.coverage, expectedProfile);
  const profileMatched =
    input.expectedProfileId.length > 0 && observedProfile === input.expectedProfileId;
  const realConnect = hasRealConnectEvent(input.deviceEvents);
  const realDisconnect = hasRealDisconnectEvent(input.deviceEvents);
  const manualChecks = [...VISUAL_CHECKS, ...WINDOW_CHECKS];
  const manualCompleted = manualChecks.filter((check) => input.manualChecks[check.id]).length;
  const allAutomaticChecksComplete =
    profileMatched &&
    coverage.buttonCovered === coverage.buttonTotal &&
    coverage.axisCovered === coverage.axisTotal &&
    realConnect &&
    realDisconnect &&
    !input.simulationSeen &&
    observation !== null;
  const allManualChecksComplete = manualCompleted === manualChecks.length;
  const result =
    allAutomaticChecksComplete && allManualChecksComplete
      ? "Ready for tester signoff"
      : "Incomplete evidence";

  return [
    "# Hardware Verification Report",
    "",
    `Created: ${new Date(input.endedAtMs).toISOString()}`,
    `Session started: ${new Date(input.startedAtMs).toISOString()}`,
    `Session ended: ${new Date(input.endedAtMs).toISOString()}`,
    "",
    "## Device",
    "",
    `- Expected profile: \`${expectedProfile}\``,
    `- Observed profile: \`${observedProfile}\``,
    `- Profile match: ${profileMatched ? "yes" : "no"}`,
    `- Connection: \`${input.connection}\``,
    `- Device name: \`${observation?.device?.name ?? input.latestController.name ?? "not-detected"}\``,
    `- VID: \`${formatHexDisplay(observation?.device?.vendorId ?? null)}\``,
    `- PID: \`${formatHexDisplay(observation?.device?.productId ?? null)}\``,
    `- XInput driver evidence: \`${formatXInputDriverEvidence(observation?.device ?? input.latestController.device)}\``,
    `- XInput API state: \`${formatXInputApiState(observation?.device ?? input.latestController.device)}\``,
    `- Tester: ${input.tester.trim() || "not-recorded"}`,
    "",
    "## Evidence Guardrails",
    "",
    `- Hardware device observed: ${observation ? "yes" : "no"}`,
    `- Simulation observed during session: ${input.simulationSeen ? "yes" : "no"}`,
    "- Simulated input is not counted as hardware verification evidence.",
    "- Unsupported devices and missing required inputs must remain explicit errors.",
    "- DS4 visual verification remains blocked unless a DS4 PNG/JSON preset is sourced from input-overlay.",
    "",
    "## Hot-Plug",
    "",
    checkboxLine(realConnect, "Real connect event captured"),
    checkboxLine(realDisconnect, "Real disconnect event captured"),
    "",
    "## Buttons",
    "",
    ...requiredButtonInputs(expectedProfile).map((button) =>
      checkboxLine(input.coverage.buttons[button.key], button.label)
    ),
    "",
    "## Optional Button Fields",
    "",
    ...OPTIONAL_BUTTON_INPUTS.map((button) =>
      checkboxLine(input.coverage.buttons[button.key], button.label)
    ),
    "",
    "## Axes",
    "",
    ...AXIS_REQUIREMENTS.map((requirement) =>
      checkboxLine(isAxisRequirementCovered(requirement, input.coverage.axes), requirement.label)
    ),
    "",
    "## Axis Ranges",
    "",
    ...AXIS_KEYS.map((axis) => {
      const stats = input.coverage.axes[axis];
      return `- ${axis}: min ${stats.min.toFixed(2)}, max ${stats.max.toFixed(2)}, partial samples ${stats.partialSamples}, samples ${stats.samples}`;
    }),
    "",
    "## Visual Calibration",
    "",
    ...VISUAL_CHECKS.map((check) => checkboxLine(input.manualChecks[check.id], check.label)),
    "",
    "## Window And Tray",
    "",
    ...WINDOW_CHECKS.map((check) => checkboxLine(input.manualChecks[check.id], check.label)),
    "",
    "## Device Events",
    "",
    ...(input.deviceEvents.length > 0
      ? input.deviceEvents.map(
          (event) => `- ${new Date(event.receivedAtMs).toISOString()} ${event.message}`
        )
      : ["- No device events captured."]),
    "",
    "## Unsupported States",
    "",
    ...(input.unsupportedReasons.length > 0
      ? input.unsupportedReasons.map((reason) => `- ${reason}`)
      : ["- None recorded."]),
    "",
    "## Notes",
    "",
    input.notes.trim() || "No notes.",
    "",
    "## Result",
    "",
    `- Status: ${result}`,
    `- Button coverage: ${coverage.buttonCovered}/${coverage.buttonTotal}`,
    `- Axis coverage: ${coverage.axisCovered}/${coverage.axisTotal}`,
    `- Manual checks: ${manualCompleted}/${manualChecks.length}`,
    "- Mark the related todo.md hardware rows complete only after this report is reviewed against the physical device and connection type."
  ].join("\n");
}

function checkboxLine(checked: boolean, label: string) {
  return `- [${checked ? "x" : " "}] ${label}`;
}

function buttonInput(key: keyof ControllerButtons) {
  const input = BUTTON_INPUTS.find((button) => button.key === key);
  if (!input) {
    throw new Error(`Button input '${key}' is not registered.`);
  }

  return input;
}

function compactTimestamp(value: number) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function safeFilePart(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "unknown";
}

function formatHexPart(value: number | null | undefined, empty: string) {
  if (value === null || value === undefined) {
    return empty;
  }

  return value.toString(16).padStart(4, "0");
}

function formatHexDisplay(value: number | null) {
  if (value === null) {
    return "not-detected";
  }

  return `0x${value.toString(16).padStart(4, "0")}`;
}

function formatXInputDriverEvidence(device: DeviceIdentity | null) {
  const evidence = device?.xinputDriver;
  if (!evidence) {
    return "not-detected";
  }

  const details = [
    evidence.source,
    evidence.className,
    evidence.service,
    ...evidence.compatibleIds
  ].filter((value): value is string => Boolean(value));

  return details.join(", ");
}

function formatXInputApiState(device: DeviceIdentity | null) {
  const xinput = device?.xinput;
  if (!xinput) {
    return "not-detected";
  }

  return `slot ${xinput.slot + 1}, packet ${xinput.packetNumber}`;
}
