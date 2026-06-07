import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  Bug,
  Eye,
  EyeOff,
  GripHorizontal,
  ListChecks,
  Lock,
  MousePointer2,
  PanelTopClose,
  SlidersHorizontal,
  Unlock
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ControllerOverlay } from "./components/ControllerOverlay";
import { DebugPanel } from "./components/DebugPanel";
import { HardwareVerificationPanel } from "./components/HardwareVerificationPanel";
import { StatePanel } from "./components/StatePanel";
import { OVERLAY_PRESETS, selectPreset } from "./data/presets";
import { useAppSettings } from "./hooks/useAppSettings";
import { useControllerEvents } from "./hooks/useControllerEvents";
import { useControllerState } from "./hooks/useControllerState";
import type {
  AppSettings,
  ControllerDeviceEvent,
  ControllerSnapshot,
  ProfileInfo,
  SimulationScenario
} from "./types/controller";

type OverlaySizeName = "compact" | "standard" | "large";

function App() {
  const controller = useControllerState();
  const deviceEvents = useControllerEvents();
  const settingsApi = useAppSettings();

  if (settingsApi.state.kind === "loading") {
    return (
      <main className="app">
        <StatePanel controller={controller} message="Loading settings" />
      </main>
    );
  }

  if (settingsApi.state.kind === "error") {
    return (
      <main className="app">
        <StatePanel
          controller={controller}
          message={`Settings error: ${settingsApi.state.error}`}
        />
      </main>
    );
  }

  const { settings, profiles } = settingsApi.state;

  return (
    <ReadyApp
      controller={controller}
      deviceEvents={deviceEvents}
      settings={settings}
      profiles={profiles}
      updateSettings={settingsApi.updateSettings}
      setClickThrough={settingsApi.setClickThrough}
      setLockPosition={settingsApi.setLockPosition}
      setOverlaySize={settingsApi.setOverlaySize}
    />
  );
}

function ReadyApp({
  controller,
  deviceEvents,
  settings,
  profiles,
  updateSettings,
  setClickThrough,
  setLockPosition,
  setOverlaySize
}: {
  controller: ControllerSnapshot;
  deviceEvents: ControllerDeviceEvent[];
  settings: AppSettings;
  profiles: ProfileInfo[];
  updateSettings: (edit: (settings: AppSettings) => AppSettings) => Promise<void>;
  setClickThrough: (enabled: boolean) => Promise<void>;
  setLockPosition: (enabled: boolean) => Promise<void>;
  setOverlaySize: (size: OverlaySizeName) => Promise<void>;
}) {
  const [debugVisible, setDebugVisible] = useState(false);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [toolbarActivity, setToolbarActivity] = useState(0);
  const [commandError, setCommandError] = useState<string | null>(null);

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
    if (!settings.overlay.hideToolbarWhenIdle || settings.overlay.clickThrough) {
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
    settings.overlay.clickThrough,
    settings.overlay.hideToolbarWhenIdle,
    settings.overlay.toolbarIdleMs
  ]);

  const status = statusText(controller);
  const activeError = commandError ?? preset.error;

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
      })
    ]);

    return () => {
      disposed = true;
      void listeners.then(([unlistenApp, unlistenController]) => {
        unlistenApp();
        unlistenController();
      });
    };
  }, []);

  const update = (edit: (settings: AppSettings) => AppSettings) =>
    updateSettings(edit)
      .then(() => setCommandError(null))
      .catch((error: unknown) => {
        setCommandError(formatError(error));
      });

  const runCommand = (command: Promise<void>) =>
    command
      .then(() => setCommandError(null))
      .catch((error: unknown) => {
        setCommandError(formatError(error));
      });

  useEffect(() => {
    if (settings.overlay.clickThrough) {
      setToolbarVisible(false);
    }
  }, [settings.overlay.clickThrough]);

  const lockTitle = settings.overlay.lockPosition ? "位置已锁定" : "拖动窗口";
  const showControls = !settings.overlay.clickThrough;

  const toggleClickThrough = () =>
    runCommand(setClickThrough(!settings.overlay.clickThrough));

  const toggleLockPosition = () =>
    runCommand(setLockPosition(!settings.overlay.lockPosition));

  const appClassName = [
    "app",
    showControls ? "" : "click-through-active",
    toolbarVisible ? "" : "toolbar-hidden"
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className={appClassName}
      onPointerMove={() => {
        if (settings.overlay.hideToolbarWhenIdle && !settings.overlay.clickThrough) {
          setToolbarVisible(true);
          setToolbarActivity((value) => value + 1);
        }
      }}
    >
      {showControls ? (
        <div
          className="toolbar"
          data-tauri-drag-region
        >
          <button
            className="icon-button drag-handle"
            aria-label="拖动窗口"
            title={lockTitle}
            disabled={settings.overlay.lockPosition}
            onPointerDown={() => {
              if (!settings.overlay.lockPosition) {
                void getCurrentWindow().startDragging();
              }
            }}
          >
            <GripHorizontal size={17} />
          </button>

          <div className="device-status" title={status}>
            <span className={`status-dot status-${controller.status}`} />
            <span className="status-text">{status}</span>
          </div>

          <select
            className="preset-select"
            value={settings.overlay.selectedPresetId ?? ""}
            onChange={(event) =>
              void update((next) => {
                next.overlay.selectedPresetId = event.target.value || null;
                return next;
              })
            }
            title="预设"
          >
            <option value="">Auto profile</option>
            {OVERLAY_PRESETS.map((overlayPreset) => (
              <option key={overlayPreset.id} value={overlayPreset.id}>
                {overlayPreset.label}
              </option>
            ))}
          </select>

          <label className="range-control" title="透明度">
            <Eye size={15} />
            <input
              type="range"
              min="0.25"
              max="1"
              step="0.01"
              value={settings.overlay.opacity}
              onChange={(event) =>
                void update((next) => {
                  next.overlay.opacity = Number(event.target.value);
                  return next;
                })
              }
            />
          </label>

          <label className="range-control" title="大小">
            <SlidersHorizontal size={15} />
            <input
              type="range"
              min="0.45"
              max="1.2"
              step="0.01"
              value={settings.overlay.scale}
              onChange={(event) =>
                void update((next) => {
                  next.overlay.scale = Number(event.target.value);
                  return next;
                })
              }
            />
          </label>

          <button
            className={`icon-button ${settings.overlay.clickThrough ? "active" : ""}`}
            aria-label="鼠标穿透"
            title="鼠标穿透"
            onClick={toggleClickThrough}
          >
            <MousePointer2 size={16} />
          </button>
          <button
            className={`icon-button ${settings.overlay.lockPosition ? "active" : ""}`}
            aria-label="锁定位置"
            title="锁定位置"
            onClick={toggleLockPosition}
          >
            {settings.overlay.lockPosition ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          <button
            className={`icon-button ${settings.overlay.hideToolbarWhenIdle ? "active" : ""}`}
            aria-label="闲置隐藏工具条"
            title="闲置隐藏工具条"
            onClick={() =>
              void update((next) => {
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
            onClick={() => setDebugVisible((value) => !value)}
          >
            <Bug size={16} />
          </button>
          <button
            className={`icon-button ${verificationVisible ? "active" : ""}`}
            aria-label="硬件验证"
            title="硬件验证"
            onClick={() => setVerificationVisible((value) => !value)}
          >
            <ListChecks size={16} />
          </button>
        </div>
      ) : null}

      <section className="overlay-workspace">
        {activeError ? <StatePanel controller={controller} message={activeError} /> : null}
        {!activeError && preset.value ? (
          <ControllerOverlay
            controller={controller}
            preset={preset.value}
            opacity={settings.overlay.opacity}
            scale={settings.overlay.scale}
            debugVisible={debugVisible}
          />
        ) : null}
        {!activeError && !preset.value ? <StatePanel controller={controller} /> : null}
        {debugVisible && showControls ? (
          <DebugPanel controller={controller} deviceEvents={deviceEvents} />
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

      {showControls ? (
        <SettingsDock
          settings={settings}
          profiles={profiles}
          onUpdate={update}
          setOverlaySize={setOverlaySize}
          setCommandError={setCommandError}
        />
      ) : null}

      {settings.overlay.clickThrough ? (
        <div className="click-through-badge" aria-hidden="true">
          Click-through
        </div>
      ) : null}
    </main>
  );
}

function statusText(controller: ControllerSnapshot) {
  if (controller.status === "simulated") {
    return controller.name ?? "Simulated controller";
  }

  if (controller.status === "unsupported") {
    return controller.name ? `Unsupported: ${controller.name}` : "Unsupported controller";
  }

  if (controller.connected) {
    return controller.name ?? controller.profile?.displayName ?? "Controller";
  }

  return "No controller";
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function updateNumber(
  onUpdate: (edit: (settings: AppSettings) => AppSettings) => void,
  edit: (settings: AppSettings, value: number) => void
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    onUpdate((next) => {
      edit(next, value);
      return next;
    });
  };
}

function SettingsDock({
  settings,
  profiles,
  onUpdate,
  setOverlaySize,
  setCommandError
}: {
  settings: AppSettings;
  profiles: ProfileInfo[];
  onUpdate: (edit: (settings: AppSettings) => AppSettings) => void;
  setOverlaySize: (size: OverlaySizeName) => Promise<void>;
  setCommandError: (error: string | null) => void;
}) {
  const runSizeCommand = (size: OverlaySizeName) =>
    setOverlaySize(size)
      .then(() => setCommandError(null))
      .catch((error: unknown) => setCommandError(formatError(error)));

  return (
    <div className="settings-dock">
      <label className="dock-check">
        <span>Sim</span>
        <input
          type="checkbox"
          checked={settings.simulation.enabled}
          onChange={(event) =>
            onUpdate((next) => {
              next.simulation.enabled = event.target.checked;
              return next;
            })
          }
        />
      </label>
      <select
        className="dock-select"
        value={settings.simulation.profileId}
        onChange={(event) =>
          onUpdate((next) => {
            next.simulation.profileId = event.target.value;
            return next;
          })
        }
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.displayName}
          </option>
        ))}
      </select>
      <select
        className="dock-select compact"
        value={settings.simulation.scenario}
        onChange={(event) =>
          onUpdate((next) => {
            next.simulation.scenario = event.target.value as SimulationScenario;
            return next;
          })
        }
      >
        <option value="sweep">Sweep</option>
        <option value="buttons">Buttons</option>
        <option value="triggers">Triggers</option>
        <option value="hotPlug">Hot plug</option>
      </select>
      <label className="dock-number">
        <span>L DZ</span>
        <input
          type="number"
          min="0"
          max="0.4"
          step="0.01"
          value={settings.input.leftStickDeadzone}
          onChange={updateNumber(onUpdate, (next, value) => {
            next.input.leftStickDeadzone = value;
          })}
        />
      </label>
      <label className="dock-number">
        <span>R DZ</span>
        <input
          type="number"
          min="0"
          max="0.4"
          step="0.01"
          value={settings.input.rightStickDeadzone}
          onChange={updateNumber(onUpdate, (next, value) => {
            next.input.rightStickDeadzone = value;
          })}
        />
      </label>
      <label className="dock-number">
        <span>T DZ</span>
        <input
          type="number"
          min="0"
          max="0.4"
          step="0.01"
          value={settings.input.triggerDeadzone}
          onChange={updateNumber(onUpdate, (next, value) => {
            next.input.triggerDeadzone = value;
          })}
        />
      </label>
      <label className="dock-number">
        <span>Stick</span>
        <input
          type="number"
          min="0.25"
          max="2.5"
          step="0.05"
          value={settings.input.stickSensitivity}
          onChange={updateNumber(onUpdate, (next, value) => {
            next.input.stickSensitivity = value;
          })}
        />
      </label>
      <label className="dock-number">
        <span>Trig</span>
        <input
          type="number"
          min="0.25"
          max="2.5"
          step="0.05"
          value={settings.input.triggerSensitivity}
          onChange={updateNumber(onUpdate, (next, value) => {
            next.input.triggerSensitivity = value;
          })}
        />
      </label>
      <label className="dock-number">
        <span>Idle</span>
        <input
          type="number"
          min="600"
          max="8000"
          step="100"
          value={settings.overlay.toolbarIdleMs}
          onChange={updateNumber(onUpdate, (next, value) => {
            next.overlay.toolbarIdleMs = value;
          })}
        />
      </label>
      <label className="dock-check">
        <span>L-Y</span>
        <input
          type="checkbox"
          checked={settings.input.invertLeftY}
          onChange={(event) =>
            onUpdate((next) => {
              next.input.invertLeftY = event.target.checked;
              return next;
            })
          }
        />
      </label>
      <label className="dock-check">
        <span>R-Y</span>
        <input
          type="checkbox"
          checked={settings.input.invertRightY}
          onChange={(event) =>
            onUpdate((next) => {
              next.input.invertRightY = event.target.checked;
              return next;
            })
          }
        />
      </label>
      <label className="dock-check">
        <span>D-Y</span>
        <input
          type="checkbox"
          checked={settings.input.invertDpadY}
          onChange={(event) =>
            onUpdate((next) => {
              next.input.invertDpadY = event.target.checked;
              return next;
            })
          }
        />
      </label>
      <button
        className="dock-button"
        type="button"
        onClick={() => void runSizeCommand("compact")}
      >
        520
      </button>
      <button
        className="dock-button"
        type="button"
        onClick={() => void runSizeCommand("standard")}
      >
        720
      </button>
      <button
        className="dock-button"
        type="button"
        onClick={() => void runSizeCommand("large")}
      >
        980
      </button>
    </div>
  );
}

export default App;
