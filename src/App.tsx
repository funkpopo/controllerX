import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  Bug,
  ListChecks,
  Lock,
  Unlock,
  X
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ControllerOverlay } from "./components/ControllerOverlay";
import { DebugPanel } from "./components/DebugPanel";
import { HardwareVerificationPanel } from "./components/HardwareVerificationPanel";
import { SettingsPopover } from "./components/SettingsPopover";
import { StatePanel } from "./components/StatePanel";
import { KeyboardMouseOverlay } from "./components/KeyboardMouseOverlay";
import {
  BOTH_DISPLAY_VALUE,
  KEYBOARD_MOUSE_PRESET_VALUE,
  applyDeviceSelection,
  deviceSelectValue,
  resolveDisplayDevice
} from "./data/displayDevice";
import { OVERLAY_PRESETS, applyPresetSkin, selectPreset } from "./data/presets";
import { useAppSettings } from "./hooks/useAppSettings";
import { useControllerEvents } from "./hooks/useControllerEvents";
import { useControllerState } from "./hooks/useControllerState";
import { useKeyboardMouseState } from "./hooks/useKeyboardMouseState";
import { deviceCopyText, statusText, t, type Translation } from "./i18n";
import type {
  AppSettings,
  ControllerDeviceEvent,
  ControllerSnapshot,
  KeyboardMouseSnapshot,
  OverlayPreset,
  ProfileInfo
} from "./types/controller";

type StatusKind = ControllerSnapshot["status"] | "keyboardMouse" | "both";

const ERROR_TOAST_AUTO_DISMISS_MS = 6000;

function App() {
  const controller = useControllerState();
  const keyboardMouse = useKeyboardMouseState();
  const deviceEvents = useControllerEvents();
  const settingsApi = useAppSettings();
  const fallbackLabels = t("zhCn");

  if (settingsApi.state.kind === "loading") {
    return (
      <main className="app">
        <StatePanel
          controller={controller}
          labels={fallbackLabels}
          message={fallbackLabels.app.loadingSettings}
        />
      </main>
    );
  }

  if (settingsApi.state.kind === "error") {
    return (
      <main className="app">
        <StatePanel
          controller={controller}
          labels={fallbackLabels}
          message={fallbackLabels.app.settingsLoadFailed(settingsApi.state.error)}
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
      setLockPosition={settingsApi.setLockPosition}
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
  setLockPosition
}: {
  controller: ControllerSnapshot;
  keyboardMouse: KeyboardMouseSnapshot;
  deviceEvents: ControllerDeviceEvent[];
  settings: AppSettings;
  profiles: ProfileInfo[];
  updateSettings: (edit: (settings: AppSettings) => AppSettings) => Promise<void>;
  setLockPosition: (enabled: boolean) => Promise<void>;
}) {
  const [debugVisible, setDebugVisible] = useState(false);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const labels = useMemo(() => t(settings.language), [settings.language]);

  const preset = useMemo(() => {
    try {
      const base = selectPreset(controller, settings.overlay.selectedPresetId);
      return {
        value: base ? applyPresetSkin(base, settings.overlay.presetSkin) : null,
        error: null
      };
    } catch (error) {
      return {
        value: null,
        error: formatError(error)
      };
    }
  }, [
    controller.profile?.presetId,
    settings.overlay.selectedPresetId,
    settings.overlay.presetSkin
  ]);

  const displayDevice = useMemo(
    () => resolveDisplayDevice(settings, controller),
    [
      controller.connected,
      settings.overlay.showController,
      settings.overlay.showKeyboardMouse,
      settings.overlay.simultaneousDisplay
    ]
  );
  const status = statusText(labels, displayDevice, controller, keyboardMouse);
  const statusKind: StatusKind =
    displayDevice === "keyboardMouse"
      ? "keyboardMouse"
      : displayDevice === "both"
        ? "both"
        : controller.status;
  const copyText = useMemo(
    () => deviceCopyText(controller, keyboardMouse, displayDevice),
    [
      controller.name,
      controller.device,
      controller.profile?.id,
      keyboardMouse.supported,
      displayDevice
    ]
  );

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

  const showControls = !settings.overlay.clickThrough && !settings.overlay.obsMode;
  const showOverlayMessages = !settings.overlay.obsMode;
  const showControllerOverlay =
    displayDevice === "controller" || displayDevice === "both";
  const showKeyboardMouseOverlay =
    displayDevice === "keyboardMouse" || displayDevice === "both";

  // Stable handlers so the memoized Toolbar does not re-render on every
  // controller snapshot; they only change when the settings they read change.
  const toggleLockPosition = useCallback(
    () => runCommand(setLockPosition(!settings.overlay.lockPosition)),
    [runCommand, setLockPosition, settings.overlay.lockPosition]
  );

  const toggleDebug = useCallback(() => setDebugVisible((value) => !value), []);
  const toggleVerification = useCallback(
    () => setVerificationVisible((value) => !value),
    []
  );

  const appClassName = [
    "app",
    showControls ? "" : "click-through-active",
    settings.overlay.obsMode ? "obs-mode-active" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const workspaceClassName = [
    "overlay-workspace",
    displayDevice === "both" ? "layout-both" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={appClassName}>
      {showControls ? (
        <Toolbar
          status={status}
          statusKind={statusKind}
          copyText={copyText}
          settings={settings}
          profiles={profiles}
          labels={labels}
          settingsOpen={settingsOpen}
          debugVisible={debugVisible}
          verificationVisible={verificationVisible}
          onUpdate={update}
          onToggleLockPosition={toggleLockPosition}
          onSettingsOpenChange={setSettingsOpen}
          onToggleDebug={toggleDebug}
          onToggleVerification={toggleVerification}
        />
      ) : null}

      <section className={workspaceClassName}>
        <OverlayLayers
          controller={controller}
          keyboardMouse={keyboardMouse}
          preset={preset}
          opacity={settings.overlay.opacity}
          debugVisible={debugVisible}
          labels={labels}
          showOverlayMessages={showOverlayMessages}
          showControllerOverlay={showControllerOverlay}
          showKeyboardMouseOverlay={showKeyboardMouseOverlay}
          layoutBoth={displayDevice === "both"}
        />
        {debugVisible && showControls ? (
          <DebugPanel
            controller={controller}
            keyboardMouse={keyboardMouse}
            deviceEvents={deviceEvents}
            inputSettings={settings.input}
            labels={labels}
          />
        ) : null}
        {showControls ? (
          <HardwareVerificationPanel
            controller={controller}
            deviceEvents={deviceEvents}
            profiles={profiles}
            visible={verificationVisible}
            setCommandError={setCommandError}
            labels={labels}
          />
        ) : null}
      </section>

      {commandError && showOverlayMessages ? (
        <div className="app-toast" role="alert">
          <span className="app-toast-message">{commandError}</span>
          <button
            type="button"
            className="app-toast-close"
            aria-label={labels.app.closeError}
            onClick={() => setCommandError(null)}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </main>
  );
}

/** Isolates high-frequency snapshot props so closed debug/verification panels
 *  do not sit under the same memo boundary as the live overlays. */
const OverlayLayers = memo(function OverlayLayers({
  controller,
  keyboardMouse,
  preset,
  opacity,
  debugVisible,
  labels,
  showOverlayMessages,
  showControllerOverlay,
  showKeyboardMouseOverlay,
  layoutBoth
}: {
  controller: ControllerSnapshot;
  keyboardMouse: KeyboardMouseSnapshot;
  preset: { value: OverlayPreset | null; error: string | null };
  opacity: number;
  debugVisible: boolean;
  labels: Translation;
  showOverlayMessages: boolean;
  showControllerOverlay: boolean;
  showKeyboardMouseOverlay: boolean;
  layoutBoth: boolean;
}) {
  return (
    <>
      {preset.error && showOverlayMessages ? (
        showControllerOverlay ? (
          <StatePanel
            controller={controller}
            labels={labels}
            message={labels.app.presetUnavailable(preset.error)}
          />
        ) : null
      ) : null}
      {preset.value && showControllerOverlay ? (
        <div className={layoutBoth ? "overlay-pane overlay-pane-controller" : undefined}>
          <ControllerOverlay
            controller={controller}
            preset={preset.value}
            opacity={opacity}
            debugVisible={debugVisible}
            labels={labels}
          />
        </div>
      ) : null}
      {showKeyboardMouseOverlay ? (
        <div className={layoutBoth ? "overlay-pane overlay-pane-keyboard" : undefined}>
          <KeyboardMouseOverlay
            keyboardMouse={keyboardMouse}
            opacity={opacity}
            labels={labels}
          />
        </div>
      ) : null}
      {!preset.error &&
      !preset.value &&
      showOverlayMessages &&
      showControllerOverlay &&
      !showKeyboardMouseOverlay ? (
        <StatePanel controller={controller} labels={labels} />
      ) : null}
    </>
  );
});

type ToolbarProps = {
  status: string;
  statusKind: StatusKind;
  copyText: string;
  settings: AppSettings;
  profiles: ProfileInfo[];
  labels: Translation;
  settingsOpen: boolean;
  debugVisible: boolean;
  verificationVisible: boolean;
  onUpdate: (edit: (settings: AppSettings) => AppSettings) => void;
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
  copyText,
  settings,
  profiles,
  labels,
  settingsOpen,
  debugVisible,
  verificationVisible,
  onUpdate,
  onToggleLockPosition,
  onSettingsOpenChange,
  onToggleDebug,
  onToggleVerification
}: ToolbarProps) {
  const toolbarTitle = settings.overlay.lockPosition
    ? labels.toolbar.lockedTitle
    : labels.toolbar.dragTitle;

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
      <button
        type="button"
        className="device-status"
        title={`${status}\n${labels.toolbar.copyStatus}`}
        onClick={() => {
          void navigator.clipboard?.writeText(copyText).catch(() => {
            // Clipboard can fail without focus; status remains visible via title.
          });
        }}
      >
        <span className={`status-dot status-${statusKind}`} />
        {statusKind === "simulated" ? (
          <span className="status-chip">{labels.toolbar.simulatedChip}</span>
        ) : null}
        <span className="status-text">{status}</span>
      </button>

      <select
        className="preset-select"
        value={deviceSelectValue(settings)}
        onChange={(event) =>
          void onUpdate((next) => {
            applyDeviceSelection(next, event.target.value);
            return next;
          })
        }
        title={labels.toolbar.displayDeviceTitle}
      >
        <option value="">{labels.toolbar.autoDevice}</option>
        <option value={BOTH_DISPLAY_VALUE}>{labels.toolbar.bothDevices}</option>
        {OVERLAY_PRESETS.map((overlayPreset) => (
          <option key={overlayPreset.id} value={overlayPreset.id}>
            {overlayPreset.label}
          </option>
        ))}
        <option value={KEYBOARD_MOUSE_PRESET_VALUE}>
          {labels.toolbar.keyboardMouseDevice}
        </option>
      </select>

      <SettingsPopover
        settings={settings}
        profiles={profiles}
        labels={labels}
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        onUpdate={onUpdate}
      />

      <button
        className={`icon-button ${settings.overlay.lockPosition ? "active" : ""}`}
        aria-label={labels.toolbar.lockPosition}
        title={labels.toolbar.lockPosition}
        onClick={onToggleLockPosition}
      >
        {settings.overlay.lockPosition ? <Lock size={16} /> : <Unlock size={16} />}
      </button>
      <button
        className={`icon-button ${debugVisible ? "active" : ""}`}
        aria-label={labels.toolbar.debugPanel}
        title={labels.toolbar.debugPanel}
        onClick={onToggleDebug}
      >
        <Bug size={16} />
      </button>
      <button
        className={`icon-button ${verificationVisible ? "active" : ""}`}
        aria-label={labels.toolbar.hardwareVerification}
        title={labels.toolbar.hardwareVerification}
        onClick={onToggleVerification}
      >
        <ListChecks size={16} />
      </button>
    </div>
  );
});

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
