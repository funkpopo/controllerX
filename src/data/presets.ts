import type { ControllerSnapshot, OverlayPreset } from "../types/controller";

const INPUT_OVERLAY_ROOT = "/vendor/input-overlay";

export const OVERLAY_PRESETS: OverlayPreset[] = [
  {
    id: "xbox-controller",
    label: "Xbox",
    family: "xbox",
    profileIds: ["xbox-360", "xbox-series", "generic-xinput", "generic-gamepad"],
    image: `${INPUT_OVERLAY_ROOT}/xbox-controller/xbox-controller.png`,
    config: `${INPUT_OVERLAY_ROOT}/xbox-controller/xbox-controller.json`,
    source: "input-overlay/presets/xbox-controller"
  },
  {
    id: "xbox-one-controller",
    label: "Xbox One",
    family: "xbox",
    profileIds: ["xbox-one"],
    image: `${INPUT_OVERLAY_ROOT}/xbox-one-controller/xbox-one-controller.png`,
    config: `${INPUT_OVERLAY_ROOT}/xbox-one-controller/xbox-one-controller.json`,
    source: "input-overlay/presets/xbox-one-controller"
  },
  {
    id: "dualsense",
    label: "DualSense",
    family: "playStation",
    profileIds: ["dualsense", "dualshock-4"],
    image: `${INPUT_OVERLAY_ROOT}/dualsense/dualsense.png`,
    config: `${INPUT_OVERLAY_ROOT}/dualsense/dualsense.json`,
    source: "input-overlay/presets/dualsense"
  },
  {
    id: "ds3",
    label: "DualShock 3",
    family: "playStation",
    profileIds: ["dualshock-3"],
    image: `${INPUT_OVERLAY_ROOT}/ds3/ds3.png`,
    config: `${INPUT_OVERLAY_ROOT}/ds3/overlay.json`,
    source: "input-overlay/presets/ds3"
  }
];

export function selectPreset(
  controller: ControllerSnapshot,
  selectedPresetId: string | null
): OverlayPreset | null {
  if (selectedPresetId) {
    const selected = OVERLAY_PRESETS.find((preset) => preset.id === selectedPresetId);
    if (!selected) {
      throw new Error(`Configured preset '${selectedPresetId}' is not registered.`);
    }

    return selected;
  }

  const profilePresetId = controller.profile?.presetId;
  if (!profilePresetId) {
    return null;
  }

  const matched = OVERLAY_PRESETS.find((preset) => preset.id === profilePresetId);
  if (!matched) {
    throw new Error(`Profile preset '${profilePresetId}' is not registered.`);
  }

  return matched;
}

