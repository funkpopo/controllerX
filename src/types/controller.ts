export type ControllerFamily = "xbox" | "playStation" | "xInput";
export type ControllerStatus = "noDevice" | "active" | "unsupported" | "simulated";

export type CalibrationStatus = {
  presetCalibrated: boolean;
  inputMapCalibrated: boolean;
  hardwareVerified: boolean;
  notes: string;
};

export type DeviceIdentity = {
  id: string;
  name: string;
  vendorId: number | null;
  productId: number | null;
  uuid: string;
  xinputDriver: XInputDriverEvidence | null;
  xinput: XInputDevice | null;
};

export type XInputDriverEvidence = {
  source: string;
  deviceInstanceId: string;
  className: string | null;
  service: string | null;
  compatibleIds: string[];
};

export type XInputDevice = {
  slot: number;
  packetNumber: number;
};

export type ProfileInfo = {
  id: string;
  displayName: string;
  family: ControllerFamily;
  presetId: string | null;
  matchKind:
    | "vendorProduct"
    | "xInputName"
    | "xInputDriver"
    | "xInputApi";
  calibrationStatus: CalibrationStatus;
};

export type UnsupportedDevice = {
  reason: string;
  identity: DeviceIdentity;
};

export type ControllerButtons = {
  south: number;
  east: number;
  west: number;
  north: number;
  leftBumper: number;
  rightBumper: number;
  leftTriggerButton: number;
  rightTriggerButton: number;
  select: number;
  start: number;
  mode: number;
  leftThumb: number;
  rightThumb: number;
  dpadUp: number;
  dpadDown: number;
  dpadLeft: number;
  dpadRight: number;
  misc1: number;
  paddle1: number;
  paddle2: number;
  paddle3: number;
  paddle4: number;
  touchpad: number;
};

export type ControllerAxes = {
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  leftTrigger: number;
  rightTrigger: number;
  dpadX: number;
  dpadY: number;
};

export type ControllerSnapshot = {
  status: ControllerStatus;
  connected: boolean;
  id: string | null;
  name: string | null;
  device: DeviceIdentity | null;
  profile: ProfileInfo | null;
  unsupported: UnsupportedDevice | null;
  buttons: ControllerButtons;
  axes: ControllerAxes;
  updatedAtMs: number;
};

export type OverlayElement = {
  id: string;
  type: number;
  pos: [number, number];
  mapping: [number, number, number, number];
  z_level?: number | string;
  code?: number;
  side?: number;
  stick_radius?: number;
  direction?: number;
};

export type OverlayPresetFile = {
  overlay_width?: number;
  overlay_height?: number;
  elements: OverlayElement[];
};

export type OverlayPreset = {
  id: string;
  label: string;
  family: ControllerFamily;
  profileIds: string[];
  image: string;
  config: string;
  source: string;
};

export type LoadedOverlayPreset = OverlayPreset & {
  overlayWidth: number;
  overlayHeight: number;
  elements: OverlayElement[];
};

export type WindowSettings = {
  x: number | null;
  y: number | null;
  width: number;
  height: number;
};

export type OverlaySettings = {
  selectedPresetId: string | null;
  opacity: number;
  clickThrough: boolean;
  lockPosition: boolean;
  hideToolbarWhenIdle: boolean;
  toolbarIdleMs: number;
  obsMode: boolean;
  window: WindowSettings;
};

export type InputSettings = {
  leftStickDeadzone: number;
  rightStickDeadzone: number;
  triggerDeadzone: number;
  stickSensitivity: number;
  triggerSensitivity: number;
  invertLeftY: boolean;
  invertRightY: boolean;
  invertDpadY: boolean;
};

export type SimulationScenario = "sweep" | "buttons" | "triggers" | "hotPlug";

export type SimulationSettings = {
  enabled: boolean;
  scenario: SimulationScenario;
  profileId: string;
};

export type AppSettings = {
  schemaVersion: number;
  overlay: OverlaySettings;
  input: InputSettings;
  simulation: SimulationSettings;
};

export type ControllerDeviceEvent = {
  id: number;
  message: string;
  receivedAtMs: number;
};
