import type {
  AppLanguage,
  ControllerSnapshot,
  KeyboardMouseSnapshot
} from "./types/controller";

type WidenTranslation<T> = T extends (...args: infer Args) => string
  ? (...args: Args) => string
  : T extends string
    ? string
    : { [Key in keyof T]: WidenTranslation<T[Key]> };

export const translations = {
  zhCn: {
    language: "zhCn",
    app: {
      loadingSettings: "正在加载设置",
      settingsLoadFailed: (error: string) => `设置加载失败:${error}`,
      presetUnavailable: (error: string) => `预设不可用:${error}`,
      closeError: "关闭错误提示"
    },
    toolbar: {
      lockedTitle: "位置已锁定",
      dragTitle: "拖动工具栏移动窗口",
      simulatedChip: "模拟",
      displayDeviceTitle: "显示设备",
      autoDevice: "自动识别设备",
      bothDevices: "同时显示",
      keyboardMouseDevice: "键盘鼠标 64 键",
      lockPosition: "锁定位置",
      debugPanel: "调试面板",
      hardwareVerification: "硬件验证",
      copyStatus: "点击复制设备信息"
    },
    status: {
      keyboardMouse: "键盘鼠标",
      keyboardMouseUnavailable: "键鼠采集不可用",
      bothLayers: "手柄 + 键鼠",
      simulatedController: "模拟手柄",
      unsupportedWithName: (name: string) => `不支持:${name}`,
      unsupportedController: "不支持的手柄",
      controller: "手柄",
      noController: "未连接手柄",
      missingPreset: "该手柄没有可用的视觉预设",
      unavailable: "手柄状态不可用",
      noControllerDetails:
        "请连接手柄;或打开工具栏的“叠加层设置”,在“模拟”中开启模拟数据预览效果。",
      dualshock4NoPreset:
        "DualShock 4 按键映射已接入，但尚未提供专用视觉预设，因此暂不渲染外观。"
    },
    settings: {
      title: "叠加层设置",
      opacity: "透明度",
      decrease: (label: string) => `减小${label}`,
      increase: (label: string) => `增大${label}`,
      input: "输入",
      leftStickDeadzone: "左摇杆死区",
      leftStickDeadzoneHint: "低于该幅度的左摇杆输入会被忽略(0-0.4)",
      rightStickDeadzone: "右摇杆死区",
      rightStickDeadzoneHint: "低于该幅度的右摇杆输入会被忽略(0-0.4)",
      triggerDeadzone: "扳机死区",
      triggerDeadzoneHint: "低于该幅度的扳机输入会被忽略(0-0.4)",
      stickSensitivity: "摇杆灵敏度",
      stickSensitivityHint: "大于 1 更灵敏,小于 1 更平缓(0.25-2.5)",
      triggerSensitivity: "扳机灵敏度",
      triggerSensitivityHint: "大于 1 更灵敏,小于 1 更平缓(0.25-2.5)",
      invertLeftY: "反转左摇杆 Y",
      invertRightY: "反转右摇杆 Y",
      invertDpadY: "反转十字键 Y",
      simulation: "模拟",
      enableSimulation: "启用模拟数据(无需手柄即可预览)",
      simulationDevice: "模拟设备",
      simulationScenario: "模拟场景",
      simulationPresetHint:
        "模拟会按所选 profile 输出输入;外观仍由工具栏的显示设备/预设决定。",
      disableSimulation: "关闭模拟",
      resetOpacity: "重置透明度",
      resetInput: "重置输入设置",
      presetSkin: "皮肤/配色",
      skins: {
        default: "默认",
        black: "黑色",
        white: "白色"
      },
      trayOnlyNote:
        "点击穿透、OBS 模式与语言请在系统托盘菜单中修改。",
      scenarios: {
        sweep: "扫掠",
        buttons: "按键",
        triggers: "扳机",
        hotPlug: "热插拔"
      }
    },
    controllerOverlay: {
      presetLoadFailed: (error: string) => `预设加载失败:${error}`,
      loadingPreset: "正在加载预设"
    },
    keyboardMouse: {
      keyboardInput: "键盘输入",
      mouseInput: "鼠标输入",
      unavailable: "键鼠采集不可用"
    },
    debug: {
      noProfile: "无配置",
      buttons: "按键",
      axes: "摇杆/轴",
      keyboardMouse: "键鼠",
      keyboard: "键盘",
      noKeys: "无按键",
      deviceEvents: "设备事件",
      noDeviceEvents: "暂无设备事件。",
      calibration: "校准状态",
      presetCalibrated: "预设校准",
      inputMapCalibrated: "输入映射校准",
      hardwareVerified: "硬件验证",
      stickVisualizer: "摇杆可视化",
      yes: "是",
      no: "否"
    },
    verification: {
      title: "硬件验证",
      resetSession: "重置验证会话",
      saveReport: "保存验证报告",
      profile: "配置",
      connection: "连接方式",
      tester: "测试者",
      notDetected: "未检测到",
      profileMatches: "配置匹配",
      connected: "连接",
      disconnected: "断开",
      simulationSeen: "检测到模拟",
      realHardwareOnly: "仅真实硬件",
      buttons: "按键",
      axes: "摇杆/轴",
      manualChecks: "人工检查",
      requiredButtons: "必测按键",
      allButtonFields: "全部按键字段",
      axisRange: "量程",
      visuals: "视觉",
      window: "窗口",
      notes: "备注",
      connections: {
        usb: "USB",
        bluetooth: "蓝牙",
        wirelessReceiver: "无线接收器",
        driverSupportedWireless: "驱动无线"
      }
    }
  },
  en: {
    language: "en",
    app: {
      loadingSettings: "Loading settings",
      settingsLoadFailed: (error: string) => `Failed to load settings: ${error}`,
      presetUnavailable: (error: string) => `Preset unavailable: ${error}`,
      closeError: "Close error"
    },
    toolbar: {
      lockedTitle: "Position locked",
      dragTitle: "Drag the toolbar to move the window",
      simulatedChip: "Sim",
      displayDeviceTitle: "Display device",
      autoDevice: "Auto-detect device",
      bothDevices: "Show both",
      keyboardMouseDevice: "Keyboard/mouse 64-key",
      lockPosition: "Lock position",
      debugPanel: "Debug panel",
      hardwareVerification: "Hardware verification",
      copyStatus: "Click to copy device info"
    },
    status: {
      keyboardMouse: "Keyboard/mouse",
      keyboardMouseUnavailable: "Keyboard/mouse capture unavailable",
      bothLayers: "Controller + keyboard/mouse",
      simulatedController: "Simulated controller",
      unsupportedWithName: (name: string) => `Unsupported: ${name}`,
      unsupportedController: "Unsupported controller",
      controller: "Controller",
      noController: "No controller connected",
      missingPreset: "This controller has no visual preset",
      unavailable: "Controller status unavailable",
      noControllerDetails:
        "Connect a controller, or open Overlay Settings in the toolbar and enable simulation preview.",
      dualshock4NoPreset:
        "DualShock 4 input mapping is available, but no dedicated visual preset is shipped yet."
    },
    settings: {
      title: "Overlay settings",
      opacity: "Opacity",
      decrease: (label: string) => `Decrease ${label}`,
      increase: (label: string) => `Increase ${label}`,
      input: "Input",
      leftStickDeadzone: "Left stick deadzone",
      leftStickDeadzoneHint: "Left stick input below this value is ignored (0-0.4)",
      rightStickDeadzone: "Right stick deadzone",
      rightStickDeadzoneHint: "Right stick input below this value is ignored (0-0.4)",
      triggerDeadzone: "Trigger deadzone",
      triggerDeadzoneHint: "Trigger input below this value is ignored (0-0.4)",
      stickSensitivity: "Stick sensitivity",
      stickSensitivityHint: "Above 1 is more responsive; below 1 is smoother (0.25-2.5)",
      triggerSensitivity: "Trigger sensitivity",
      triggerSensitivityHint:
        "Above 1 is more responsive; below 1 is smoother (0.25-2.5)",
      invertLeftY: "Invert left stick Y",
      invertRightY: "Invert right stick Y",
      invertDpadY: "Invert D-pad Y",
      simulation: "Simulation",
      enableSimulation: "Enable simulated data preview without a controller",
      simulationDevice: "Simulation device",
      simulationScenario: "Simulation scenario",
      simulationPresetHint:
        "Simulation drives input for the selected profile; appearance still follows the toolbar display device/preset.",
      disableSimulation: "Disable simulation",
      resetOpacity: "Reset opacity",
      resetInput: "Reset input settings",
      presetSkin: "Skin / color",
      skins: {
        default: "Default",
        black: "Black",
        white: "White"
      },
      trayOnlyNote:
        "Click-through, OBS mode, and language can only be changed from the system tray menu.",
      scenarios: {
        sweep: "Sweep",
        buttons: "Buttons",
        triggers: "Triggers",
        hotPlug: "Hot-plug"
      }
    },
    controllerOverlay: {
      presetLoadFailed: (error: string) => `Failed to load preset: ${error}`,
      loadingPreset: "Loading preset"
    },
    keyboardMouse: {
      keyboardInput: "Keyboard input",
      mouseInput: "Mouse input",
      unavailable: "Keyboard/mouse capture unavailable"
    },
    debug: {
      noProfile: "No profile",
      buttons: "Buttons",
      axes: "Sticks/axes",
      keyboardMouse: "Keyboard/mouse",
      keyboard: "Keyboard",
      noKeys: "No keys",
      deviceEvents: "Device events",
      noDeviceEvents: "No device events.",
      calibration: "Calibration",
      presetCalibrated: "Preset calibrated",
      inputMapCalibrated: "Input map calibrated",
      hardwareVerified: "Hardware verified",
      stickVisualizer: "Stick visualizer",
      yes: "Yes",
      no: "No"
    },
    verification: {
      title: "Hardware verification",
      resetSession: "Reset verification session",
      saveReport: "Save verification report",
      profile: "Profile",
      connection: "Connection",
      tester: "Tester",
      notDetected: "Not detected",
      profileMatches: "Profile match",
      connected: "Connected",
      disconnected: "Disconnected",
      simulationSeen: "Simulation detected",
      realHardwareOnly: "Real hardware only",
      buttons: "Buttons",
      axes: "Sticks/axes",
      manualChecks: "Manual checks",
      requiredButtons: "Required buttons",
      allButtonFields: "All button fields",
      axisRange: "Range",
      visuals: "Visuals",
      window: "Window",
      notes: "Notes",
      connections: {
        usb: "USB",
        bluetooth: "Bluetooth",
        wirelessReceiver: "Wireless receiver",
        driverSupportedWireless: "Driver-supported wireless"
      }
    }
  }
} as const;

export type Translation = WidenTranslation<typeof translations.zhCn>;

export function t(language: AppLanguage): Translation {
  return translations[language] ?? translations.zhCn;
}

export function statusText(
  labels: Translation,
  displayDevice: "controller" | "keyboardMouse" | "both",
  controller: ControllerSnapshot,
  keyboardMouse: KeyboardMouseSnapshot
) {
  if (displayDevice === "keyboardMouse") {
    return keyboardMouse.supported
      ? labels.status.keyboardMouse
      : labels.status.keyboardMouseUnavailable;
  }

  if (displayDevice === "both") {
    const controllerPart = controllerStatusText(labels, controller);
    const keyboardPart = keyboardMouse.supported
      ? labels.status.keyboardMouse
      : labels.status.keyboardMouseUnavailable;
    return `${controllerPart} · ${keyboardPart}`;
  }

  return controllerStatusText(labels, controller);
}

function controllerStatusText(
  labels: Translation,
  controller: ControllerSnapshot
) {
  if (controller.status === "simulated") {
    return controller.name ?? labels.status.simulatedController;
  }

  if (controller.status === "unsupported") {
    return controller.name
      ? labels.status.unsupportedWithName(controller.name)
      : labels.status.unsupportedController;
  }

  if (controller.connected) {
    return controller.name ?? controller.profile?.displayName ?? labels.status.controller;
  }

  return labels.status.noController;
}

/** Build a clipboard-friendly device summary for the status bar. */
export function deviceCopyText(
  controller: ControllerSnapshot,
  keyboardMouse: KeyboardMouseSnapshot,
  displayDevice: "controller" | "keyboardMouse" | "both"
) {
  const parts: string[] = [];

  if (displayDevice !== "keyboardMouse") {
    if (controller.name) {
      parts.push(controller.name);
    }
    if (controller.device) {
      const vid = controller.device.vendorId;
      const pid = controller.device.productId;
      if (vid != null || pid != null) {
        parts.push(
          `VID:${vid != null ? vid.toString(16).padStart(4, "0") : "----"} PID:${
            pid != null ? pid.toString(16).padStart(4, "0") : "----"
          }`
        );
      }
      if (controller.device.xinput) {
        parts.push(`XInput slot ${controller.device.xinput.slot + 1}`);
      }
    }
    if (controller.profile) {
      parts.push(`profile:${controller.profile.id}`);
    }
  }

  if (displayDevice !== "controller") {
    parts.push(
      keyboardMouse.supported ? "keyboard/mouse" : "keyboard/mouse unavailable"
    );
  }

  return parts.join(" | ") || "controllerX";
}
