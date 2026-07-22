import type {
  ControllerSnapshot,
  OverlayPreset,
  PresetSkin
} from "../types/controller";

const INPUT_OVERLAY_ROOT = "/vendor/input-overlay";

type PresetDefinition = OverlayPreset & {
  skins: Partial<Record<PresetSkin, string>>;
};

const PRESET_DEFINITIONS: PresetDefinition[] = [
  {
    id: "xbox-controller",
    label: "Xbox",
    family: "xbox",
    profileIds: ["xbox-360", "xbox-series", "generic-xinput"],
    image: `${INPUT_OVERLAY_ROOT}/xbox-controller/xbox-controller.png`,
    config: `${INPUT_OVERLAY_ROOT}/xbox-controller/xbox-controller.json`,
    source: "input-overlay/presets/xbox-controller",
    skins: {
      default: `${INPUT_OVERLAY_ROOT}/xbox-controller/xbox-controller.png`,
      black: `${INPUT_OVERLAY_ROOT}/xbox-controller/xbox-controller-black.png`,
      white: `${INPUT_OVERLAY_ROOT}/xbox-controller/xbox-controller-white.png`
    }
  },
  {
    id: "xbox-one-controller",
    label: "Xbox One",
    family: "xbox",
    profileIds: ["xbox-one"],
    image: `${INPUT_OVERLAY_ROOT}/xbox-one-controller/xbox-one-controller.png`,
    config: `${INPUT_OVERLAY_ROOT}/xbox-one-controller/xbox-one-controller.json`,
    source: "input-overlay/presets/xbox-one-controller",
    skins: {
      default: `${INPUT_OVERLAY_ROOT}/xbox-one-controller/xbox-one-controller.png`
    }
  },
  {
    id: "dualsense",
    label: "DualSense",
    family: "playStation",
    profileIds: ["dualsense"],
    image: `${INPUT_OVERLAY_ROOT}/dualsense/dualsense.png`,
    config: `${INPUT_OVERLAY_ROOT}/dualsense/dualsense.json`,
    source: "input-overlay/presets/dualsense",
    skins: {
      default: `${INPUT_OVERLAY_ROOT}/dualsense/dualsense.png`,
      black: `${INPUT_OVERLAY_ROOT}/dualsense/dualsenseblack.png`,
      white: `${INPUT_OVERLAY_ROOT}/dualsense/dualsensewhite.png`
    }
  },
  {
    id: "ds3",
    label: "DualShock 3",
    family: "playStation",
    profileIds: ["dualshock-3"],
    image: `${INPUT_OVERLAY_ROOT}/ds3/ds3.png`,
    config: `${INPUT_OVERLAY_ROOT}/ds3/overlay.json`,
    source: "input-overlay/presets/ds3",
    skins: {
      default: `${INPUT_OVERLAY_ROOT}/ds3/ds3.png`,
      black: `${INPUT_OVERLAY_ROOT}/ds3/ds3_black.png`,
      white: `${INPUT_OVERLAY_ROOT}/ds3/ds3_white.png`
    }
  }
];

export const OVERLAY_PRESETS: OverlayPreset[] = PRESET_DEFINITIONS.map(
  ({ skins: _skins, ...preset }) => preset
);

export function applyPresetSkin(
  preset: OverlayPreset,
  skin: PresetSkin
): OverlayPreset {
  const definition = PRESET_DEFINITIONS.find((item) => item.id === preset.id);
  if (!definition) {
    return preset;
  }

  const image = definition.skins[skin] ?? definition.skins.default ?? preset.image;
  if (image === preset.image) {
    return preset;
  }

  return { ...preset, image };
}

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
