import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  Bug,
  EyeOff,
  ListChecks,
  Lock,
  MousePointer2,
  PanelTopClose,
  Unlock,
  X
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControllerOverlay } from "./components/ControllerOverlay";
import { DebugPanel } from "./components/DebugPanel";
import { HardwareVerificationPanel } from "./components/HardwareVerificationPanel";
import { SettingsPopover } from "./components/SettingsPopover";
import { StatePanel } from "./components/StatePanel";
import { KeyboardMouseOverlay } from "./components/KeyboardMouseOverlay";
import {
  KEYBOARD_MOUSE_PRESET_VALUE,
  applyDeviceSelection,
  deviceSelectValue,
  resolveDisplayDevice,
  type DisplayDevice
} from "./data/displayDevice";
import { OVERLAY_PRESETS, selectPreset } from "./data/presets";
import { useAppSettings } from "./hooks/useAppSettings";
import { useControllerEvents } from "./hooks/useControllerEvents";
import { useControllerState } from "./hooks/useControllerState";
import { useKeyboardMouseState } from "./hooks/useKeyboardMouseState";
import type {
  AppSettings,
  ControllerDeviceEvent,
  ControllerSnapshot,
  KeyboardMouseSnapshot,
  ProfileInfo
} from "./types/controller";

type OverlaySizeName = "compact" | "standard" | "large";
type StatusKind = ControllerSnapshot["status"] | "keyboardMouse";

const ERROR_TOAST_AUTO_DISMISS_MS = 6000;
const POINTER_ACTIVITY_THROTTLE_MS = 400;

function App() {
  const controller = useControllerState();
  const keyboardMouse = useKeyboardMouseState();
  const deviceEvents = useControllerEvents();
  const settingsApi = useAppSettings();

  if (settingsApi.state.kind === "loading") {
    return (
      <main className="app">
        <StatePanel controller={controller} message="正在加载设置" />
      </main>
    );
  }

  if (settingsApi.state.kind === "error") {
    return (
      <main className="app">
        <StatePanel
          controller={controller}
          message={`设置加载失败:${settingsApi.state.error}`}
        />
      </main>
    );
  }

  const { settings, profiles } = settingsApi.state;

  return (
    <ReadyApp
      controller={controller}
      keyboardMouse={keyboardMouse}
      deviceEvents={deviceEvents}
      settings={settings}
      profiles={profiles}
      updateSettings={settingsApi.updateSettings}
      setClickThrough={settingsApi.setClickThrough}
      setLockPosition={settingsApi.setLockPosition}
      setOverlaySize={settingsApi.setOverlaySize}
      setDisplayDeviceWindowSize={settingsApi.setDisplayDeviceWindowSize}
    />
  );
}

function ReadyApp({
  controller,
  keyboardMouse,
  deviceEvents,
  settings,
  profiles,
  updateSettings,
  setClickThrough,
  setLockPosition,
  setOverlaySize,
  setDisplayDeviceWindowSize
}: {
  controller: ControllerSnapshot;
  keyboardMouse: KeyboardMouseSnapshot;
  deviceEvents: ControllerDeviceEvent[];
  settings: AppSettings;
  profiles: ProfileInfo[];
  updateSettings: (edit: (settings: AppSettings) => AppSettings) => Promise<void>;
  setClickThrough: (enabled: boolean) => Promise<void>;
  setLockPosition: (enabled: boolean) => Promise<void>;
  setOverlaySize: (size: OverlaySizeName) => Promise<void>;
  setDisplayDeviceWindowSize: (displayDevice: DisplayDevice) => Promise<void>;
}) {
  const [debugVisible, setDebugVisible] = useState(false);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [toolbarActivity, setToolbarActivity] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const lastPointerActivityRef = useRef(0);
  const lastAppliedWindowDeviceRef = useRef<DisplayDevice | null>(null);

  const preset = useMemo(() => {
    try {
      return {
        value: selectPreset(controller, settings.overlay.selectedPresetId),
        error: null
      };
    } catch (error) {
      return {
        value: null,
        error: formatError(error)
      };
    }
  }, [controller, settings.overlay.selectedPresetId]);

  useEffect(() => {
    if (
      !settings.overlay.hideToolbarWhenIdle ||
      settings.overlay.clickThrough ||
      settingsOpen
    ) {
      setToolbarVisible(true);
      return;
    }

    setToolbarVisible(true);
    const timeout = window.setTimeout(
      () => setToolbarVisible(false),
      settings.overlay.toolbarIdleMs
    );

    return () => window.clearTimeout(timeout);
  }, [
    toolbarActivity,
    settingsOpen,
    settings.overlay.clickThrough,
    settings.overlay.hideToolbarWhenIdle,
    settings.overlay.toolbarIdleMs
  ]);

  const displayDevice = useMemo(
    () => resolveDisplayDevice(settings, controller),
    [
      controller.connected,
      settings.overlay.showController,
      settings.overlay.showKeyboardMouse
    ]
  );
  const status = statusText(displayDevice, controller, keyboardMouse);
  const statusKind: StatusKind =
    displayDevice === "keyboardMouse" ? "keyboardMouse" : controller.status;

  useEffect(() => {
    let disposed = false;
    const listeners = Promise.all([
      listen<string>("app-command-error", (event) => {
        if (!disposed) {
          setCommandError(event.payload);
        }
      }),
      listen<string>("controller-error", (event) => {
        if (!disposed) {
          setCommandError(event.payload);
        }
      }),
      listen<string>("keyboard-mouse-error", (event) => {
        if (!disposed) {
          setCommandError(event.payload);
        }
      })
    ]);

    return () => {
      disposed = true;
      void listeners.then(([unlistenApp, unlistenController, unlistenKeyboardMouse]) => {
        unlistenApp();
        unlistenController();
        unlistenKeyboardMouse();
      });
    };
  }, []);

  // Errors surface as a dismissible toast and never block the overlay; clear
  // them automatically so a transient failure does not linger on screen.
  useEffect(() => {
    if (!commandError) {
      return;
    }

    const timeout = window.setTimeout(
      () => setCommandError(null),
      ERROR_TOAST_AUTO_DISMISS_MS
    );
    return () => window.clearTimeout(timeout);
  }, [commandError]);

  const update = useCallback(
    (edit: (settings: AppSettings) => AppSettings) =>
      updateSettings(edit).catch((error: unknown) => {
        setCommandError(formatError(error));
      }),
    [updateSettings]
  );

  const runCommand = useCallback(
    (command: Promise<void>) =>
      command.catch((error: unknown) => {
        setCommandError(formatError(error));
      }),
    []
  );

  useEffect(() => {
    if (lastAppliedWindowDeviceRef.current === displayDevice) {
      return;
    }

    lastAppliedWindowDeviceRef.current = displayDevice;
    setDisplayDeviceWindowSize(displayDevice).catch((error: unknown) => {
      lastAppliedWindowDeviceRef.current = null;
      setCommandError(formatError(error));
    });
  }, [displayDevice, setDisplayDeviceWindowSize]);

  useEffect(() => {
    if (settings.overlay.clickThrough) {
      setToolbarVisible(false);
    }
  }, [settings.overlay.clickThrough]);

  const showControls = !settings.overlay.clickThrough && !settings.overlay.obsMode;
  const showOverlayMessages = !settings.overlay.obsMode;
  const showControllerOverlay = displayDevice === "controller";
  const showKeyboardMouseOverlay = displayDevice === "keyboardMouse";

  // Stable handlers so the memoized Toolbar does not re-render on every
  // controller snapshot; they only change when the settings they read change.
  const toggleClickThrough = useCallback(
    () => runCommand(setClickThrough(!settings.overlay.clickThrough)),
    [runCommand, setClickThrough, settings.overlay.clickThrough]
  );

  const toggleLockPosition = useCallback(
    () => runCommand(setLockPosition(!settings.overlay.lockPosition)),
    [runCommand, setLockPosition, settings.overlay.lockPosition]
  );

  const handleSetSize = useCallback(
    (size: OverlaySizeName) => runCommand(setOverlaySize(size)),
    [runCommand, setOverlaySize]
  );

  const toggleDebug = useCallback(() => setDebugVisible((value) => !value), []);
  const toggleVerification = useCallback(
    () => setVerificationVisible((value) => !value),
    []
  );

  const appClassName = [
    "app",
    showControls ? "" : "click-through-active",
    settings.overlay.obsMode ? "obs-mode-active" : "",
    toolbarVisible ? "" : "toolbar-hidden"
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className={appClassName}
      onPointerMove={() => {
        if (
          !settings.overlay.hideToolbarWhenIdle ||
          settings.overlay.clickThrough ||
          settings.overlay.obsMode
        ) {
          return;
        }

        const now = performance.now();
        if (now - lastPointerActivityRef.current < POINTER_ACTIVITY_THROTTLE_MS) {
          return;
        }

        lastPointerActivityRef.current = now;
        setToolbarVisible(true);
        setToolbarActivity((value) => value + 1);
      }}
    >
      {showControls ? (
        <Toolbar
          status={status}
          statusKind={statusKind}
          settings={settings}
          profiles={profiles}
          settingsOpen={settingsOpen}
          debugVisible={debugVisible}
          verificationVisible={verificationVisible}
          onUpdate={update}
          onSetSize={handleSetSize}
          onToggleClickThrough={toggleClickThrough}
          onToggleLockPosition={toggleLockPosition}
          onSettingsOpenChange={setSettingsOpen}
          onToggleDebug={toggleDebug}
          onToggleVerification={toggleVerification}
        />
      ) : null}

      <section className="overlay-workspace">
        {preset.error && showOverlayMessages ? (
          showControllerOverlay ? (
            <StatePanel controller={controller} message={`预设不可用:${preset.error}`} />
          ) : null
        ) : null}
        {preset.value && showControllerOverlay ? (
          <ControllerOverlay
            controller={controller}
            preset={preset.value}
            opacity={settings.overlay.opacity}
            debugVisible={debugVisible}
          />
        ) : null}
        {showKeyboardMouseOverlay ? (
          <KeyboardMouseOverlay
            keyboardMouse={keyboardMouse}
            opacity={settings.overlay.opacity}
          />
        ) : null}
        {!preset.error &&
        !preset.value &&
        showOverlayMessages &&
        showControllerOverlay &&
        !showKeyboardMouseOverlay ? (
          <StatePanel controller={controller} />
        ) : null}
        {debugVisible && showControls ? (
          <DebugPanel
            controller={controller}
            keyboardMouse={keyboardMouse}
            deviceEvents={deviceEvents}
          />
        ) : null}
        {showControls ? (
          <HardwareVerificationPanel
            controller={controller}
            deviceEvents={deviceEvents}
            profiles={profiles}
            visible={verificationVisible}
            setCommandError={setCommandError}
          />
        ) : null}
      </section>

      {commandError && showOverlayMessages ? (
        <div className="app-toast" role="alert">
          <span className="app-toast-message">{commandError}</span>
          <button
            type="button"
            className="app-toast-close"
            aria-label="关闭错误提示"
            onClick={() => setCommandError(null)}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {settings.overlay.clickThrough && !settings.overlay.obsMode ? (
        <div className="click-through-badge" aria-hidden="true">
          鼠标穿透中 · 通过托盘菜单恢复
        </div>
      ) : null}
    </main>
  );
}

type ToolbarProps = {
  status: string;
  statusKind: StatusKind;
  settings: AppSettings;
  profiles: ProfileInfo[];
  settingsOpen: boolean;
  debugVisible: boolean;
  verificationVisible: boolean;
  onUpdate: (edit: (settings: AppSettings) => AppSettings) => void;
  onSetSize: (size: OverlaySizeName) => void;
  onToggleClickThrough: () => void;
  onToggleLockPosition: () => void;
  onSettingsOpenChange: (open: boolean) => void;
  onToggleDebug: () => void;
  onToggleVerification: () => void;
};

// Memoized so controller snapshots (up to ~60/s) don't re-render the toolbar:
// none of its props depend on the live controller state except the already-
// stable status string.
const Toolbar = memo(function Toolbar({
  status,
  statusKind,
  settings,
  profiles,
  settingsOpen,
  debugVisible,
  verificationVisible,
  onUpdate,
  onSetSize,
  onToggleClickThrough,
  onToggleLockPosition,
  onSettingsOpenChange,
  onToggleDebug,
  onToggleVerification
}: ToolbarProps) {
  const toolbarTitle = settings.overlay.lockPosition ? "位置已锁定" : "拖动工具栏移动窗口";

  return (
    <div
      className="toolbar"
      title={toolbarTitle}
      onPointerDown={(event) => {
        if (
          settings.overlay.lockPosition ||
          event.button !== 0 ||
          isInteractiveToolbarTarget(event.target)
        ) {
          return;
        }

        void getCurrentWindow().startDragging();
      }}
    >
      <div className="device-status" title={status}>
        <span className={`status-dot status-${statusKind}`} />
        {statusKind === "simulated" ? <span className="status-chip">模拟</span> : null}
        <span className="status-text">{status}</span>
      </div>

      <select
        className="preset-select"
        value={deviceSelectValue(settings)}
        onChange={(event) =>
          void onUpdate((next) => {
            applyDeviceSelection(next, event.target.value);
            return next;
          })
        }
        title="显示设备"
      >
        <option value="">自动识别设备</option>
        {OVERLAY_PRESETS.map((overlayPreset) => (
          <option key={overlayPreset.id} value={overlayPreset.id}>
            {overlayPreset.label}
          </option>
        ))}
        <option value={KEYBOARD_MOUSE_PRESET_VALUE}>键盘鼠标 64 键</option>
      </select>

      <SettingsPopover
        settings={settings}
        profiles={profiles}
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        onUpdate={onUpdate}
        onSetSize={onSetSize}
      />

      <button
        className={`icon-button ${settings.overlay.clickThrough ? "active" : ""}`}
        aria-label="鼠标穿透"
        title="鼠标穿透(开启后通过托盘菜单恢复)"
        onClick={onToggleClickThrough}
      >
        <MousePointer2 size={16} />
      </button>
      <button
        className={`icon-button ${settings.overlay.lockPosition ? "active" : ""}`}
        aria-label="锁定位置"
        title="锁定位置"
        onClick={onToggleLockPosition}
      >
        {settings.overlay.lockPosition ? <Lock size={16} /> : <Unlock size={16} />}
      </button>
      <button
        className={`icon-button ${settings.overlay.hideToolbarWhenIdle ? "active" : ""}`}
        aria-label="闲置隐藏工具条"
        title="闲置隐藏工具条"
        onClick={() =>
          void onUpdate((next) => {
            next.overlay.hideToolbarWhenIdle = !next.overlay.hideToolbarWhenIdle;
            return next;
          })
        }
      >
        {settings.overlay.hideToolbarWhenIdle ? (
          <EyeOff size={16} />
        ) : (
          <PanelTopClose size={16} />
        )}
      </button>
      <button
        className={`icon-button ${debugVisible ? "active" : ""}`}
        aria-label="调试面板"
        title="调试面板"
        onClick={onToggleDebug}
      >
        <Bug size={16} />
      </button>
      <button
        className={`icon-button ${verificationVisible ? "active" : ""}`}
        aria-label="硬件验证"
        title="硬件验证"
        onClick={onToggleVerification}
      >
        <ListChecks size={16} />
      </button>
    </div>
  );
});

function statusText(
  displayDevice: DisplayDevice,
  controller: ControllerSnapshot,
  keyboardMouse: KeyboardMouseSnapshot
) {
  if (displayDevice === "keyboardMouse") {
    return keyboardMouse.supported ? "键盘鼠标" : "键鼠采集不可用";
  }

  if (controller.status === "simulated") {
    return controller.name ?? "模拟手柄";
  }

  if (controller.status === "unsupported") {
    return controller.name ? `不支持:${controller.name}` : "不支持的手柄";
  }

  if (controller.connected) {
    return controller.name ?? controller.profile?.displayName ?? "手柄";
  }

  return "未连接手柄";
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isInteractiveToolbarTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, select, input, textarea, label, [role='dialog'], .adjust-popover"
      )
    )
  );
}

export default App;
