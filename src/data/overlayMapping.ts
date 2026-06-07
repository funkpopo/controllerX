import type { ControllerSnapshot, OverlayElement } from "../types/controller";

export const BUTTON_THRESHOLD = 0.25;
export const STICK_DEADZONE = 0.05;
const SUPPORTED_ELEMENT_TYPES = new Set([0, 2, 5, 6, 7, 8]);

export const INPUT_OVERLAY_BUTTON_CODES = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  select: 4,
  mode: 5,
  start: 6,
  leftThumb: 7,
  rightThumb: 8,
  leftBumper: 9,
  rightBumper: 10,
  dpadUp: 11,
  dpadDown: 12,
  dpadLeft: 13,
  dpadRight: 14,
  misc1: 15,
  paddle1: 16,
  paddle2: 17,
  paddle3: 18,
  paddle4: 19,
  touchpad: 20
} as const;

const SUPPORTED_BUTTON_CODE_LABELS = new Map<number, string>(
  Object.entries(INPUT_OVERLAY_BUTTON_CODES).map(([label, code]) => [code, label])
);

export const DPAD_DIRECTIONS = ["up", "down", "left", "right"] as const;
export type DpadDirection = (typeof DPAD_DIRECTIONS)[number];

export type ElementRenderState = {
  value: number;
  x: number;
  y: number;
  clipRatio: number | null;
  analog: boolean;
};

export function validateOverlayPresetElements(
  presetId: string,
  elements: OverlayElement[]
) {
  const issues = elements.flatMap((element) => validateOverlayElement(element));

  if (issues.length > 0) {
    throw new Error(
      `Preset '${presetId}' contains unsupported input mappings: ${issues.join("; ")}.`
    );
  }
}

function validateOverlayElement(element: OverlayElement) {
  const issues: string[] = [];

  if (!SUPPORTED_ELEMENT_TYPES.has(element.type)) {
    issues.push(`${element.id}: unsupported element type ${element.type}`);
  }

  if (element.type === 2) {
    if (typeof element.code === "number") {
      if (!SUPPORTED_BUTTON_CODE_LABELS.has(element.code)) {
        issues.push(`${element.id}: unsupported button code ${element.code}`);
      }
    } else if (!canMapButtonElementById(element.id)) {
      issues.push(`${element.id}: no supported button code or recognized id`);
    }
  }

  if (element.type === 5 && element.side !== 0 && element.side !== 1) {
    issues.push(`${element.id}: analog stick is missing side 0 or 1`);
  }

  if (
    element.type === 6 &&
    element.side !== 0 &&
    element.side !== 1 &&
    !buttonIdIncludesLeft(element.id) &&
    !buttonIdIncludesRight(element.id)
  ) {
    issues.push(`${element.id}: trigger is missing side 0 or 1`);
  }

  return issues;
}

export function getElementRenderState(
  element: OverlayElement,
  controller: ControllerSnapshot
): ElementRenderState {
  if (element.type === 0) {
    return { value: 1, x: 0, y: 0, clipRatio: null, analog: false };
  }

  if (element.type === 5) {
    const isLeft = element.side !== 1;
    const x = deadzone(isLeft ? controller.axes.leftStickX : controller.axes.rightStickX);
    const y = deadzone(isLeft ? controller.axes.leftStickY : controller.axes.rightStickY);
    const radius = element.stick_radius ?? 28;
    const value = Math.max(Math.abs(x), Math.abs(y));

    return {
      value,
      x: x * radius,
      y: -y * radius,
      clipRatio: null,
      analog: true
    };
  }

  if (element.type === 6) {
    const value = triggerValue(element, controller);
    return { value, x: 0, y: 0, clipRatio: value, analog: true };
  }

  if (element.type === 8) {
    return {
      value: Math.max(
        ...DPAD_DIRECTIONS.map((direction) =>
          dpadDirectionValue(direction, controller)
        )
      ),
      x: 0,
      y: 0,
      clipRatio: null,
      analog: false
    };
  }

  if (element.type === 7) {
    return { value: controller.buttons.mode, x: 0, y: 0, clipRatio: null, analog: false };
  }

  if (!SUPPORTED_ELEMENT_TYPES.has(element.type)) {
    throw new Error(`Unsupported overlay element type ${element.type} on '${element.id}'.`);
  }

  return {
    value: buttonValue(element, controller),
    x: 0,
    y: 0,
    clipRatio: null,
    analog: false
  };
}

export function getDpadDirectionRenderState(
  direction: DpadDirection,
  controller: ControllerSnapshot
): ElementRenderState {
  return {
    value: dpadDirectionValue(direction, controller),
    x: 0,
    y: 0,
    clipRatio: null,
    analog: false
  };
}

export function dpadDirectionValue(
  direction: DpadDirection,
  controller: ControllerSnapshot
) {
  const x = dpadAxisX(controller);
  const y = dpadAxisY(controller);

  switch (direction) {
    case "up":
      return clampPositive(Math.max(controller.buttons.dpadUp, -y));
    case "down":
      return clampPositive(Math.max(controller.buttons.dpadDown, y));
    case "left":
      return clampPositive(Math.max(controller.buttons.dpadLeft, -x));
    case "right":
      return clampPositive(Math.max(controller.buttons.dpadRight, x));
  }
}

export function shouldRenderElement(element: OverlayElement, state: ElementRenderState) {
  if (element.type === 0 || element.type === 5) {
    return true;
  }

  return state.value > BUTTON_THRESHOLD;
}

export function isElementActive(element: OverlayElement, state: ElementRenderState) {
  if (element.type === 0) {
    return false;
  }

  if (element.type === 5) {
    return state.value > STICK_DEADZONE;
  }

  return state.value > BUTTON_THRESHOLD;
}

export function buttonValue(element: OverlayElement, controller: ControllerSnapshot) {
  const id = element.id.toLowerCase();

  if (typeof element.code === "number") {
    const byCode = buttonValueByCode(element.code, controller);
    return byCode;
  }

  if (id.includes("dpad_up")) return controller.buttons.dpadUp;
  if (id.includes("dpad_down")) return controller.buttons.dpadDown;
  if (id.includes("dpad_left")) return controller.buttons.dpadLeft;
  if (id.includes("dpad_right")) return controller.buttons.dpadRight;
  if (id.includes("select") || id.includes("share") || id.includes("back")) {
    return controller.buttons.select;
  }
  if (id.includes("start") || id.includes("option") || id.includes("menu")) {
    return controller.buttons.start;
  }
  if (id.includes("guide") || id.includes("ps button") || id === "ps") {
    return controller.buttons.mode;
  }
  if (id.includes("mute")) return controller.buttons.misc1;
  if (id.includes("touchpad") || id.includes("touch pad")) {
    return controller.buttons.touchpad;
  }
  if (id.includes("paddle 1") || id.includes("paddle1")) {
    return controller.buttons.paddle1;
  }
  if (id.includes("paddle 2") || id.includes("paddle2")) {
    return controller.buttons.paddle2;
  }
  if (id.includes("paddle 3") || id.includes("paddle3")) {
    return controller.buttons.paddle3;
  }
  if (id.includes("paddle 4") || id.includes("paddle4")) {
    return controller.buttons.paddle4;
  }
  if (id.includes("left bumper") || id.includes(" l1") || id === "ls") {
    return id === "ls" ? controller.buttons.leftThumb : controller.buttons.leftBumper;
  }
  if (id.includes("right bumper") || id.includes(" r1") || id === "rs") {
    return id === "rs"
      ? controller.buttons.rightThumb
      : controller.buttons.rightBumper;
  }

  throw new Error(`Overlay button '${element.id}' has no supported input mapping.`);
}

export function buttonValueByCode(code: number, controller: ControllerSnapshot) {
  switch (code) {
    case 0:
      return controller.buttons.south;
    case 1:
      return controller.buttons.east;
    case 2:
      return controller.buttons.west;
    case 3:
      return controller.buttons.north;
    case 4:
      return controller.buttons.select;
    case 5:
      return controller.buttons.mode;
    case 6:
      return controller.buttons.start;
    case 7:
      return controller.buttons.leftThumb;
    case 8:
      return controller.buttons.rightThumb;
    case 9:
      return controller.buttons.leftBumper;
    case 10:
      return controller.buttons.rightBumper;
    case 11:
      return controller.buttons.dpadUp;
    case 12:
      return controller.buttons.dpadDown;
    case 13:
      return controller.buttons.dpadLeft;
    case 14:
      return controller.buttons.dpadRight;
    case 15:
      return controller.buttons.misc1;
    case 16:
      return controller.buttons.paddle1;
    case 17:
      return controller.buttons.paddle2;
    case 18:
      return controller.buttons.paddle3;
    case 19:
      return controller.buttons.paddle4;
    case 20:
      return controller.buttons.touchpad;
    default:
      throw new Error(`Unsupported input-overlay button code ${code}.`);
  }
}

export function triggerValue(element: OverlayElement, controller: ControllerSnapshot) {
  const id = element.id.toLowerCase();
  if (buttonIdIncludesLeft(id)) {
    return Math.max(controller.axes.leftTrigger, controller.buttons.leftTriggerButton);
  }

  if (buttonIdIncludesRight(id)) {
    return Math.max(controller.axes.rightTrigger, controller.buttons.rightTriggerButton);
  }

  return element.side === 1
    ? Math.max(controller.axes.rightTrigger, controller.buttons.rightTriggerButton)
    : Math.max(controller.axes.leftTrigger, controller.buttons.leftTriggerButton);
}

export function dpadAxisX(controller: ControllerSnapshot) {
  return clampSigned(
    controller.axes.dpadX ||
      controller.buttons.dpadRight - controller.buttons.dpadLeft
  );
}

export function dpadAxisY(controller: ControllerSnapshot) {
  return clampSigned(
    controller.buttons.dpadDown - controller.buttons.dpadUp - controller.axes.dpadY
  );
}

export function deadzone(value: number) {
  return Math.abs(value) < STICK_DEADZONE ? 0 : clampSigned(value);
}

export function clampSigned(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function clampPositive(value: number) {
  return Math.max(0, Math.min(1, value));
}

function canMapButtonElementById(id: string) {
  const normalized = id.toLowerCase();

  return (
    normalized.includes("dpad_up") ||
    normalized.includes("dpad_down") ||
    normalized.includes("dpad_left") ||
    normalized.includes("dpad_right") ||
    normalized.includes("select") ||
    normalized.includes("share") ||
    normalized.includes("back") ||
    normalized.includes("start") ||
    normalized.includes("option") ||
    normalized.includes("menu") ||
    normalized.includes("guide") ||
    normalized.includes("ps button") ||
    normalized === "ps" ||
    normalized.includes("mute") ||
    normalized.includes("touchpad") ||
    normalized.includes("touch pad") ||
    normalized.includes("paddle 1") ||
    normalized.includes("paddle1") ||
    normalized.includes("paddle 2") ||
    normalized.includes("paddle2") ||
    normalized.includes("paddle 3") ||
    normalized.includes("paddle3") ||
    normalized.includes("paddle 4") ||
    normalized.includes("paddle4") ||
    normalized.includes("left bumper") ||
    normalized.includes(" l1") ||
    normalized === "ls" ||
    normalized.includes("right bumper") ||
    normalized.includes(" r1") ||
    normalized === "rs"
  );
}

function buttonIdIncludesLeft(id: string) {
  const normalized = id.toLowerCase();
  return normalized.includes("left") || normalized.includes("lt") || normalized.includes("l2");
}

function buttonIdIncludesRight(id: string) {
  const normalized = id.toLowerCase();
  return normalized.includes("right") || normalized.includes("rt") || normalized.includes("r2");
}
