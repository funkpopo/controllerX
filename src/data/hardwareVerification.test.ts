import { describe, expect, it } from "vitest";
import {
  AXIS_REQUIREMENTS,
  buildHardwareVerificationReport,
  buildReportFileName,
  createEmptyInputCoverage,
  createEmptyManualChecks,
  hasRealConnectEvent,
  hasRealDisconnectEvent,
  isAxisRequirementCovered,
  summarizeCoverage,
  updateInputCoverage,
  type HardwareReportInput
} from "./hardwareVerification";
import type { ControllerDeviceEvent, ControllerSnapshot, ProfileInfo } from "../types/controller";

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

const profile: ProfileInfo = {
  id: "dualsense",
  displayName: "DualSense",
  family: "playStation",
  presetId: "dualsense",
  matchKind: "vendorProduct",
  calibrationStatus: {
    presetCalibrated: false,
    inputMapCalibrated: false,
    hardwareVerified: false,
    notes: "test"
  }
};

function snapshot(overrides: Partial<ControllerSnapshot> = {}): ControllerSnapshot {
  return {
    status: "active",
    connected: true,
    id: "test",
    name: "DualSense Wireless Controller",
    device: {
      id: "test",
      name: "DualSense Wireless Controller",
      vendorId: 0x054c,
      productId: 0x0ce6,
      uuid: "test"
    },
    profile,
    unsupported: null,
    buttons: { ...emptyButtons },
    axes: { ...emptyAxes },
    updatedAtMs: 1,
    ...overrides
  };
}

function event(message: string, receivedAtMs = 1): ControllerDeviceEvent {
  return {
    id: receivedAtMs,
    message,
    receivedAtMs
  };
}

function reportInput(overrides: Partial<HardwareReportInput> = {}): HardwareReportInput {
  const latestController = snapshot();

  return {
    expectedProfileId: "dualsense",
    connection: "usb",
    tester: "tester",
    notes: "notes",
    startedAtMs: Date.UTC(2026, 5, 7, 5, 0, 0),
    endedAtMs: Date.UTC(2026, 5, 7, 5, 1, 0),
    observation: {
      device: latestController.device,
      profile,
      name: latestController.name,
      firstSeenAtMs: Date.UTC(2026, 5, 7, 5, 0, 3),
      lastSeenAtMs: Date.UTC(2026, 5, 7, 5, 0, 58)
    },
    latestController,
    coverage: createEmptyInputCoverage(),
    manualChecks: createEmptyManualChecks(),
    deviceEvents: [event("Connected", 1), event("Disconnected", 2)],
    simulationSeen: false,
    unsupportedReasons: [],
    ...overrides
  };
}

describe("hardware verification coverage", () => {
  it("counts active hardware input and ignores simulated snapshots", () => {
    let coverage = createEmptyInputCoverage();

    coverage = updateInputCoverage(
      coverage,
      snapshot({
        status: "simulated",
        buttons: { ...emptyButtons, south: 1 },
        axes: { ...emptyAxes, leftStickX: 1 }
      })
    );
    expect(summarizeCoverage(coverage).buttonCovered).toBe(0);
    expect(coverage.axes.leftStickX.samples).toBe(0);

    coverage = updateInputCoverage(
      coverage,
      snapshot({
        buttons: { ...emptyButtons, south: 1 },
        axes: { ...emptyAxes, leftStickX: 0.9, leftTrigger: 0.4 }
      })
    );
    coverage = updateInputCoverage(
      coverage,
      snapshot({
        axes: { ...emptyAxes, leftStickX: -0.91, leftTrigger: 0.5 }
      })
    );
    coverage = updateInputCoverage(
      coverage,
      snapshot({
        axes: { ...emptyAxes, leftTrigger: 1 }
      })
    );

    expect(coverage.buttons.south).toBe(true);
    expect(coverage.axes.leftStickX.max).toBeCloseTo(0.9);
    expect(coverage.axes.leftStickX.min).toBeCloseTo(-0.91);
    expect(
      isAxisRequirementCovered(
        AXIS_REQUIREMENTS.find((requirement) => requirement.id === "leftStickXPositive")!,
        coverage.axes
      )
    ).toBe(true);
    expect(
      isAxisRequirementCovered(
        AXIS_REQUIREMENTS.find((requirement) => requirement.id === "leftTriggerGradual")!,
        coverage.axes
      )
    ).toBe(true);
  });

  it("treats simulated hot-plug events as non-hardware evidence", () => {
    const events = [
      event("SimulatedConnected", 1),
      event("SimulatedDisconnected", 2),
      event("Connected", 3),
      event("Disconnected", 4)
    ];

    expect(hasRealConnectEvent(events.slice(0, 2))).toBe(false);
    expect(hasRealDisconnectEvent(events.slice(0, 2))).toBe(false);
    expect(hasRealConnectEvent(events)).toBe(true);
    expect(hasRealDisconnectEvent(events)).toBe(true);
  });
});

describe("hardware verification reports", () => {
  it("builds a safe markdown file name without losing the extension", () => {
    const fileName = buildReportFileName(
      reportInput({
        latestController: snapshot({
          name: "DualSense ".repeat(40)
        })
      })
    );

    expect(fileName).toMatch(/\.md$/);
    expect(fileName.length).toBeLessThanOrEqual(140);
    expect(fileName).not.toMatch(/[\\/\s]/);
  });

  it("records guardrails and incomplete status when simulation was seen", () => {
    const report = buildHardwareVerificationReport(
      reportInput({
        simulationSeen: true
      })
    );

    expect(report).toContain("# Hardware Verification Report");
    expect(report).toContain("Simulation observed during session: yes");
    expect(report).toContain("Simulated input is not counted as hardware verification evidence.");
    expect(report).toContain("Status: Incomplete evidence");
  });
});
