import type { ControllerSnapshot } from "../types/controller";

type StatePanelProps = {
  controller: ControllerSnapshot;
  message?: string;
};

export function StatePanel({ controller, message }: StatePanelProps) {
  const title = message ?? stateTitle(controller);
  const details = stateDetails(controller);

  return (
    <div className="state-panel">
      <strong>{title}</strong>
      {details ? <span>{details}</span> : null}
    </div>
  );
}

function stateTitle(controller: ControllerSnapshot) {
  if (controller.status === "noDevice") {
    return "No controller connected";
  }

  if (controller.status === "unsupported") {
    return "Unsupported controller";
  }

  if (controller.profile && !controller.profile.presetId) {
    return "Profile has no visual preset";
  }

  return "Controller state unavailable";
}

function stateDetails(controller: ControllerSnapshot) {
  if (controller.unsupported) {
    return controller.unsupported.reason;
  }

  if (controller.profile && !controller.profile.presetId) {
    return controller.profile.calibrationStatus.notes;
  }

  return controller.name ?? "";
}

