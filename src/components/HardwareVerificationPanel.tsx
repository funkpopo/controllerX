import { invoke } from "@tauri-apps/api/core";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AXIS_KEYS,
  AXIS_REQUIREMENTS,
  BUTTON_INPUTS,
  VISUAL_CHECKS,
  WINDOW_CHECKS,
  buildHardwareVerificationReport,
  buildReportFileName,
  createEmptyInputCoverage,
  createEmptyManualChecks,
  hasRealConnectEvent,
  hasRealDisconnectEvent,
  isAxisRequirementCovered,
  requiredButtonInputs,
  summarizeCoverage,
  updateInputCoverage,
  type HardwareObservation,
  type ManualCheckId,
  type ManualChecks
} from "../data/hardwareVerification";
import type {
  ControllerDeviceEvent,
  ControllerSnapshot,
  ProfileInfo
} from "../types/controller";

type HardwareVerificationPanelProps = {
  controller: ControllerSnapshot;
  deviceEvents: ControllerDeviceEvent[];
  profiles: ProfileInfo[];
  visible: boolean;
  setCommandError: (error: string | null) => void;
};

type SavedHardwareVerificationReport = {
  path: string;
};

const CONNECTION_OPTIONS = [
  { value: "usb", label: "USB" },
  { value: "bluetooth", label: "Bluetooth" },
  { value: "wireless-receiver", label: "Wireless receiver" },
  { value: "driver-supported-wireless", label: "Driver wireless" }
];

export function HardwareVerificationPanel({
  controller,
  deviceEvents,
  profiles,
  visible,
  setCommandError
}: HardwareVerificationPanelProps) {
  const [sessionStartedAtMs, setSessionStartedAtMs] = useState(() => Date.now());
  const [expectedProfileId, setExpectedProfileId] = useState("dualsense");
  const [connection, setConnection] = useState("usb");
  const [tester, setTester] = useState("");
  const [notes, setNotes] = useState("");
  const [coverage, setCoverage] = useState(createEmptyInputCoverage);
  const [manualChecks, setManualChecks] = useState<ManualChecks>(createEmptyManualChecks);
  const [observation, setObservation] = useState<HardwareObservation | null>(null);
  const [simulationSeen, setSimulationSeen] = useState(false);
  const [unsupportedReasons, setUnsupportedReasons] = useState<string[]>([]);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (controller.status === "simulated") {
      setSimulationSeen(true);
      return;
    }

    if (controller.status === "unsupported" && controller.unsupported?.reason) {
      setUnsupportedReasons((current) =>
        current.includes(controller.unsupported!.reason)
          ? current
          : [...current, controller.unsupported!.reason]
      );
      return;
    }

    if (controller.status !== "active") {
      return;
    }

    const now = Date.now();
    setCoverage((current) => updateInputCoverage(current, controller));
    setObservation((current) => {
      if (!current) {
        return {
          device: controller.device,
          profile: controller.profile,
          name: controller.name,
          firstSeenAtMs: now,
          lastSeenAtMs: now
        };
      }

      return {
        device: current.device ?? controller.device,
        profile: current.profile ?? controller.profile,
        name: current.name ?? controller.name,
        firstSeenAtMs: current.firstSeenAtMs,
        lastSeenAtMs: now
      };
    });
  }, [controller, visible]);

  const coverageSummary = useMemo(
    () => summarizeCoverage(coverage, expectedProfileId),
    [coverage, expectedProfileId]
  );
  const requiredButtons = useMemo(
    () => requiredButtonInputs(expectedProfileId),
    [expectedProfileId]
  );
  const sessionDeviceEvents = useMemo(
    () => deviceEvents.filter((event) => event.receivedAtMs >= sessionStartedAtMs),
    [deviceEvents, sessionStartedAtMs]
  );
  const manualTotal = VISUAL_CHECKS.length + WINDOW_CHECKS.length;
  const manualCovered = [...VISUAL_CHECKS, ...WINDOW_CHECKS].filter(
    (check) => manualChecks[check.id]
  ).length;
  const connectCaptured = hasRealConnectEvent(sessionDeviceEvents);
  const disconnectCaptured = hasRealDisconnectEvent(sessionDeviceEvents);
  const observedProfileId =
    observation?.profile?.id ?? controller.profile?.id ?? "not-detected";
  const profileMatches =
    expectedProfileId.length > 0 && observedProfileId === expectedProfileId;

  const resetSession = () => {
    setSessionStartedAtMs(Date.now());
    setCoverage(createEmptyInputCoverage());
    setManualChecks(createEmptyManualChecks());
    setObservation(null);
    setSimulationSeen(false);
    setUnsupportedReasons([]);
    setSavedPath(null);
    setCommandError(null);
  };

  const toggleManualCheck = (id: ManualCheckId) => {
    setManualChecks((current) => ({
      ...current,
      [id]: !current[id]
    }));
  };

  const saveReport = async () => {
    const endedAtMs = Date.now();
    const reportInput = {
      expectedProfileId,
      connection,
      tester,
      notes,
      startedAtMs: sessionStartedAtMs,
      endedAtMs,
      observation,
      latestController: controller,
      coverage,
      manualChecks,
      deviceEvents: sessionDeviceEvents,
      simulationSeen,
      unsupportedReasons
    };
    const content = buildHardwareVerificationReport(reportInput);
    const fileName = buildReportFileName(reportInput);

    setSaving(true);
    try {
      const saved = await invoke<SavedHardwareVerificationReport>(
        "save_hardware_verification_report",
        {
          fileName,
          content
        }
      );
      setSavedPath(saved.path);
      setCommandError(null);
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <aside className="verification-panel">
      <div className="verification-header">
        <div>
          <span>Hardware verification</span>
          <strong>{observedProfileId}</strong>
        </div>
        <div className="verification-actions">
          <button
            type="button"
            className="icon-button"
            title="重置验证会话"
            aria-label="重置验证会话"
            onClick={resetSession}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="保存验证报告"
            aria-label="保存验证报告"
            disabled={saving}
            onClick={() => void saveReport()}
          >
            <Save size={15} />
          </button>
        </div>
      </div>

      <div className="verification-config">
        <label>
          <span>Profile</span>
          <select
            value={expectedProfileId}
            onChange={(event) => setExpectedProfileId(event.target.value)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Link</span>
          <select value={connection} onChange={(event) => setConnection(event.target.value)}>
            {CONNECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tester</span>
          <input value={tester} onChange={(event) => setTester(event.target.value)} />
        </label>
      </div>

      <div className="verification-summary">
        <StatusPill active={profileMatches} label="Profile" />
        <StatusPill active={connectCaptured} label="Connect" />
        <StatusPill active={disconnectCaptured} label="Disconnect" />
        <StatusPill
          active={!simulationSeen}
          label={simulationSeen ? "Simulation seen" : "Hardware only"}
        />
      </div>

      <ProgressLine
        label="Buttons"
        value={coverageSummary.buttonCovered}
        total={coverageSummary.buttonTotal}
      />
      <ProgressLine
        label="Axes"
        value={coverageSummary.axisCovered}
        total={coverageSummary.axisTotal}
      />
      <ProgressLine label="Manual" value={manualCovered} total={manualTotal} />

      <section className="verification-section">
        <h2>Required buttons</h2>
        <div className="verification-grid">
          {requiredButtons.map((button) => (
            <span key={button.key} className={coverage.buttons[button.key] ? "complete" : ""}>
              {button.label}
            </span>
          ))}
        </div>
      </section>

      <section className="verification-section">
        <h2>All button fields</h2>
        <div className="verification-grid">
          {BUTTON_INPUTS.map((button) => (
            <span key={button.key} className={coverage.buttons[button.key] ? "complete" : ""}>
              {button.label}
            </span>
          ))}
        </div>
      </section>

      <section className="verification-section">
        <h2>Axes</h2>
        <div className="verification-grid">
          {AXIS_REQUIREMENTS.map((requirement) => (
            <span
              key={requirement.id}
              className={
                isAxisRequirementCovered(requirement, coverage.axes) ? "complete" : ""
              }
            >
              {requirement.label}
            </span>
          ))}
        </div>
      </section>

      <section className="verification-section">
        <h2>Ranges</h2>
        <div className="range-table">
          {AXIS_KEYS.map((axis) => {
            const stats = coverage.axes[axis];
            return (
              <div key={axis}>
                <span>{axis}</span>
                <strong>
                  {stats.min.toFixed(2)} / {stats.max.toFixed(2)}
                </strong>
              </div>
            );
          })}
        </div>
      </section>

      <ManualCheckGroup
        title="Visual"
        checks={VISUAL_CHECKS}
        values={manualChecks}
        onToggle={toggleManualCheck}
      />
      <ManualCheckGroup
        title="Window"
        checks={WINDOW_CHECKS}
        values={manualChecks}
        onToggle={toggleManualCheck}
      />

      <label className="verification-notes">
        <span>Notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>

      {savedPath ? <div className="verification-path">{savedPath}</div> : null}
    </aside>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return <span className={active ? "complete" : ""}>{label}</span>;
}

function ProgressLine({
  label,
  value,
  total
}: {
  label: string;
  value: number;
  total: number;
}) {
  const ratio = total === 0 ? 0 : value / total;

  return (
    <div className="verification-progress">
      <div>
        <span>{label}</span>
        <strong>
          {value}/{total}
        </strong>
      </div>
      <i style={{ transform: `scaleX(${ratio})` }} />
    </div>
  );
}

function ManualCheckGroup({
  title,
  checks,
  values,
  onToggle
}: {
  title: string;
  checks: readonly { id: ManualCheckId; label: string }[];
  values: ManualChecks;
  onToggle: (id: ManualCheckId) => void;
}) {
  return (
    <section className="verification-section">
      <h2>{title}</h2>
      <div className="manual-checks">
        {checks.map((check) => (
          <label key={check.id} className={values[check.id] ? "complete" : ""}>
            <input
              type="checkbox"
              checked={values[check.id]}
              onChange={() => onToggle(check.id)}
            />
            <span>{check.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
