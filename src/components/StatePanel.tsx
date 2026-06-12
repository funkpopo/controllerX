import type { ControllerSnapshot } from "../types/controller";

type StatePanelProps = {
  controller: ControllerSnapshot;
  message?: string;
};

export function StatePanel({ controller, message }: StatePanelProps) {
  const title = message ?? stateTitle(controller);
  const details = message ? null : stateDetails(controller);

  return (
    <div className="state-panel">
      <strong>{title}</strong>
      {details ? <span>{details}</span> : null}
    </div>
  );
}

function stateTitle(controller: ControllerSnapshot) {
  if (controller.status === "noDevice") {
    return "未连接手柄";
  }

  if (controller.status === "unsupported") {
    return "不支持的手柄";
  }

  if (controller.profile && !controller.profile.presetId) {
    return "该手柄没有可用的视觉预设";
  }

  return "手柄状态不可用";
}

function stateDetails(controller: ControllerSnapshot) {
  if (controller.status === "noDevice") {
    return "请连接手柄;或打开工具栏的“叠加层设置”,在“模拟”中开启模拟数据预览效果。";
  }

  if (controller.unsupported) {
    return controller.unsupported.reason;
  }

  if (controller.profile && !controller.profile.presetId) {
    return controller.profile.calibrationStatus.notes;
  }

  return controller.name ?? "";
}
