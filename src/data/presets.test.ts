import { describe, expect, it } from "vitest";
import { selectPreset } from "./presets";
import type { ControllerSnapshot, ProfileInfo } from "../types/controller";

const emptyButtons = {
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
  dpadRight: 0
};

const emptyAxes = {
  leftStickX: 0,
  leftStickY: 0,
  rightStickX: 0,
  rightStickY: 0,
  leftTrigger: 0,
  rightTrigger: 0,
  dpadX: 0,
  dpadY: 0
};

function profile(id: string, presetId: string | null): ProfileInfo {
  return {
    id,
    displayName: id,
    family: id.includes("xbox") ? "xbox" : "playStation",
    presetId,
    matchKind: "vendorProduct",
    calibrationStatus: {
      presetCalibrated: presetId !== null,
      inputMapCalibrated: true,
      hardwareVerified: false,
      notes: "test"
    }
  };
}

function snapshot(profileInfo: ProfileInfo | null): ControllerSnapshot {
  return {
    status: profileInfo ? "active" : "noDevice",
    connected: profileInfo !== null,
    id: profileInfo?.id ?? null,
    name: profileInfo?.displayName ?? null,
    device: null,
    profile: profileInfo,
    unsupported: null,
    buttons: emptyButtons,
    axes: emptyAxes,
    updatedAtMs: 1
  };
}

describe("selectPreset", () => {
  it("uses the explicit configured preset when it is registered", () => {
    const selected = selectPreset(snapshot(profile("dualsense", "dualsense")), "ds3");

    expect(selected?.id).toBe("ds3");
  });

  it("uses the active profile preset for auto profile mode", () => {
    const selected = selectPreset(snapshot(profile("xbox-one", "xbox-one-controller")), null);

    expect(selected?.id).toBe("xbox-one-controller");
  });

  it("returns no preset when the profile has no sourced PNG preset", () => {
    const selected = selectPreset(snapshot(profile("dualshock-4", null)), null);

    expect(selected).toBeNull();
  });

  it("throws when configured preset id is not registered", () => {
    expect(() => selectPreset(snapshot(profile("dualsense", "dualsense")), "missing")).toThrow(
      "missing"
    );
  });

  it("throws when profile points to a preset that is not registered", () => {
    expect(() => selectPreset(snapshot(profile("custom", "not-registered")), null)).toThrow(
      "not-registered"
    );
  });
});
