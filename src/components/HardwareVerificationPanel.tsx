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
import type { Translation } from "../i18n";

type HardwareVerificationPanelProps = {
  controller: ControllerSnapshot;
  deviceEvents: ControllerDeviceEvent[];
  profiles: ProfileInfo[];
  visible: boolean;
  setCommandError: (error: string | null) => void;
  labels: Translation;
};

type SavedHardwareVerificationReport = {
  path: string;
};

const CONNECTION_OPTIONS = [
  "usb",
  "bluetooth",
  "wireless-receiver",
  "driver-supported-wireless"
] as const;

export function HardwareVerificationPanel({
  controller,
  deviceEvents,
  profiles,
  visible,
  setCommandError,
  labels
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
    observation?.profile?.id ?? controller.profile?.id ?? labels.verification.notDetected;
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
          <span>{labels.verification.title}</span>
          <strong>{observedProfileId}</strong>
        </div>
        <div className="verification-actions">
          <button
            type="button"
            className="icon-button"
            title={labels.verification.resetSession}
            aria-label={labels.verification.resetSession}
            onClick={resetSession}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            title={labels.verification.saveReport}
            aria-label={labels.verification.saveReport}
            disabled={saving}
            onClick={() => void saveReport()}
          >
            <Save size={15} />
          </button>
        </div>
      </div>

      <div className="verification-config">
        <label>
          <span>{labels.verification.profile}</span>
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
          <span>{labels.verification.connection}</span>
          <select value={connection} onChange={(event) => setConnection(event.target.value)}>
            {CONNECTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {connectionLabel(option, labels)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{labels.verification.tester}</span>
          <input value={tester} onChange={(event) => setTester(event.target.value)} />
        </label>
      </div>

      <div className="verification-summary">
        <StatusPill active={profileMatches} label={labels.verification.profileMatches} />
        <StatusPill active={connectCaptured} label={labels.verification.connected} />
        <StatusPill active={disconnectCaptured} label={labels.verification.disconnected} />
        <StatusPill
          active={!simulationSeen}
          label={
            simulationSeen
              ? labels.verification.simulationSeen
              : labels.verification.realHardwareOnly
          }
        />
      </div>

      <ProgressLine
        label={labels.verification.buttons}
        value={coverageSummary.buttonCovered}
        total={coverageSummary.buttonTotal}
      />
      <ProgressLine
        label={labels.verification.axes}
        value={coverageSummary.axisCovered}
        total={coverageSummary.axisTotal}
      />
      <ProgressLine
        label={labels.verification.manualChecks}
        value={manualCovered}
        total={manualTotal}
      />

      <section className="verification-section">
        <h2>{labels.verification.requiredButtons}</h2>
        <div className="verification-grid">
          {requiredButtons.map((button) => (
            <span key={button.key} className={coverage.buttons[button.key] ? "complete" : ""}>
              {fieldLabel(button, labels)}
            </span>
          ))}
        </div>
      </section>

      <section className="verification-section">
        <h2>{labels.verification.allButtonFields}</h2>
        <div className="verification-grid">
          {BUTTON_INPUTS.map((button) => (
            <span key={button.key} className={coverage.buttons[button.key] ? "complete" : ""}>
              {fieldLabel(button, labels)}
            </span>
          ))}
        </div>
      </section>

      <section className="verification-section">
        <h2>{labels.verification.axes}</h2>
        <div className="verification-grid">
          {AXIS_REQUIREMENTS.map((requirement) => (
            <span
              key={requirement.id}
              className={
                isAxisRequirementCovered(requirement, coverage.axes) ? "complete" : ""
              }
            >
              {fieldLabel(requirement, labels)}
            </span>
          ))}
        </div>
      </section>

      <section className="verification-section">
        <h2>{labels.verification.axisRange}</h2>
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
        title={labels.verification.visuals}
        checks={VISUAL_CHECKS}
        values={manualChecks}
        onToggle={toggleManualCheck}
        labels={labels}
      />
      <ManualCheckGroup
        title={labels.verification.window}
        checks={WINDOW_CHECKS}
        values={manualChecks}
        onToggle={toggleManualCheck}
        labels={labels}
      />

      <label className="verification-notes">
        <span>{labels.verification.notes}</span>
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
  onToggle,
  labels
}: {
  title: string;
  checks: readonly { id: ManualCheckId; label: string; cn: string }[];
  values: ManualChecks;
  onToggle: (id: ManualCheckId) => void;
  labels: Translation;
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
            <span>{fieldLabel(check, labels)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function connectionLabel(
  value: (typeof CONNECTION_OPTIONS)[number],
  labels: Translation
) {
  switch (value) {
    case "usb":
      return labels.verification.connections.usb;
    case "bluetooth":
      return labels.verification.connections.bluetooth;
    case "wireless-receiver":
      return labels.verification.connections.wirelessReceiver;
    case "driver-supported-wireless":
      return labels.verification.connections.driverSupportedWireless;
  }
}

function fieldLabel(
  field: { label: string; cn: string },
  labels: Translation
) {
  return labels.language === "en" ? field.label : field.cn;
}
