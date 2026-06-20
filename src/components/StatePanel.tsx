import type { ControllerSnapshot } from "../types/controller";
import type { Translation } from "../i18n";

type StatePanelProps = {
  controller: ControllerSnapshot;
  labels: Translation;
  message?: string;
};

export function StatePanel({ controller, labels, message }: StatePanelProps) {
  const title = message ?? stateTitle(controller, labels);
  const details = message ? null : stateDetails(controller, labels);

  return (
    <div className="state-panel">
      <strong>{title}</strong>
      {details ? <span>{details}</span> : null}
    </div>
  );
}

function stateTitle(controller: ControllerSnapshot, labels: Translation) {
  if (controller.status === "noDevice") {
    return labels.status.noController;
  }

  if (controller.status === "unsupported") {
    return labels.status.unsupportedController;
  }

  if (controller.profile && !controller.profile.presetId) {
    return labels.status.missingPreset;
  }

  return labels.status.unavailable;
}

function stateDetails(controller: ControllerSnapshot, labels: Translation) {
  if (controller.status === "noDevice") {
    return labels.status.noControllerDetails;
  }

  if (controller.unsupported) {
    return controller.unsupported.reason;
  }

  if (controller.profile && !controller.profile.presetId) {
    return controller.profile.calibrationStatus.notes;
  }

  return controller.name ?? "";
}
