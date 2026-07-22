import { Eye, Minus, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import type {
  AppSettings,
  PresetSkin,
  ProfileInfo,
  SimulationScenario
} from "../types/controller";
import type { Translation } from "../i18n";

type Range = {
  min: number;
  max: number;
  step: number;
  coarse: number;
  default: number;
};

// Ranges and defaults mirror the backend clamps/defaults in
// src-tauri/src/settings.rs so the UI never drifts from persisted values.
const OPACITY: Range = { min: 0.25, max: 1, step: 0.01, coarse: 0.05, default: 0.92 };

const NUMBER_COMMIT_DEBOUNCE_MS = 500;
const SLIDER_COMMIT_DEBOUNCE_MS = 150;

const SCENARIO_OPTIONS: SimulationScenario[] = ["sweep", "buttons", "triggers", "hotPlug"];
const SKIN_OPTIONS: PresetSkin[] = ["default", "black", "white"];

const DEFAULT_INPUT = {
  leftStickDeadzone: 0.08,
  rightStickDeadzone: 0.08,
  triggerDeadzone: 0.02,
  stickSensitivity: 1.0,
  triggerSensitivity: 1.0,
  invertLeftY: false,
  invertRightY: false,
  invertDpadY: false
};

type SettingsPopoverProps = {
  settings: AppSettings;
  profiles: ProfileInfo[];
  labels: Translation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (edit: (settings: AppSettings) => AppSettings) => void;
};

export function SettingsPopover({
  settings,
  profiles,
  labels,
  open,
  onOpenChange,
  onUpdate
}: SettingsPopoverProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    // Focus the dialog when opened so keyboard users land inside it.
    window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const setOpacity = (value: number) =>
    onUpdate((next) => {
      next.overlay.opacity = value;
      return next;
    });

  return (
    <div className="adjust" ref={wrapperRef}>
      <button
        type="button"
        className={`icon-button adjust-trigger ${open ? "active" : ""}`}
        aria-label={labels.settings.title}
        aria-expanded={open}
        title={labels.settings.title}
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={16} />
      </button>

      {open ? (
        <div
          className="adjust-popover"
          role="dialog"
          aria-modal="true"
          aria-label={labels.settings.title}
          ref={dialogRef}
        >
          <SliderField
            icon={<Eye size={16} />}
            label={labels.settings.opacity}
            value={settings.overlay.opacity}
            range={OPACITY}
            onChange={setOpacity}
            labels={labels}
          />

          <section className="adjust-section">
            <h3>{labels.settings.presetSkin}</h3>
            <label className="adjust-row">
              <span>{labels.settings.presetSkin}</span>
              <select
                className="adjust-select"
                value={settings.overlay.presetSkin}
                onChange={(event) =>
                  onUpdate((next) => {
                    next.overlay.presetSkin = event.target.value as PresetSkin;
                    return next;
                  })
                }
              >
                {SKIN_OPTIONS.map((skin) => (
                  <option key={skin} value={skin}>
                    {labels.settings.skins[skin]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="adjust-section">
            <h3>{labels.settings.input}</h3>
            <NumberField
              label={labels.settings.leftStickDeadzone}
              hint={labels.settings.leftStickDeadzoneHint}
              min={0}
              max={0.4}
              step={0.01}
              value={settings.input.leftStickDeadzone}
              onCommit={(value) =>
                onUpdate((next) => {
                  next.input.leftStickDeadzone = value;
                  return next;
                })
              }
            />
            <NumberField
              label={labels.settings.rightStickDeadzone}
              hint={labels.settings.rightStickDeadzoneHint}
              min={0}
              max={0.4}
              step={0.01}
              value={settings.input.rightStickDeadzone}
              onCommit={(value) =>
                onUpdate((next) => {
                  next.input.rightStickDeadzone = value;
                  return next;
                })
              }
            />
            <NumberField
              label={labels.settings.triggerDeadzone}
              hint={labels.settings.triggerDeadzoneHint}
              min={0}
              max={0.4}
              step={0.01}
              value={settings.input.triggerDeadzone}
              onCommit={(value) =>
                onUpdate((next) => {
                  next.input.triggerDeadzone = value;
                  return next;
                })
              }
            />
            <NumberField
              label={labels.settings.stickSensitivity}
              hint={labels.settings.stickSensitivityHint}
              min={0.25}
              max={2.5}
              step={0.05}
              value={settings.input.stickSensitivity}
              onCommit={(value) =>
                onUpdate((next) => {
                  next.input.stickSensitivity = value;
                  return next;
                })
              }
            />
            <NumberField
              label={labels.settings.triggerSensitivity}
              hint={labels.settings.triggerSensitivityHint}
              min={0.25}
              max={2.5}
              step={0.05}
              value={settings.input.triggerSensitivity}
              onCommit={(value) =>
                onUpdate((next) => {
                  next.input.triggerSensitivity = value;
                  return next;
                })
              }
            />
            <div className="adjust-check-row">
              <CheckField
                label={labels.settings.invertLeftY}
                checked={settings.input.invertLeftY}
                onChange={(checked) =>
                  onUpdate((next) => {
                    next.input.invertLeftY = checked;
                    return next;
                  })
                }
              />
              <CheckField
                label={labels.settings.invertRightY}
                checked={settings.input.invertRightY}
                onChange={(checked) =>
                  onUpdate((next) => {
                    next.input.invertRightY = checked;
                    return next;
                  })
                }
              />
              <CheckField
                label={labels.settings.invertDpadY}
                checked={settings.input.invertDpadY}
                onChange={(checked) =>
                  onUpdate((next) => {
                    next.input.invertDpadY = checked;
                    return next;
                  })
                }
              />
            </div>
          </section>

          <section className="adjust-section">
            <h3>{labels.settings.simulation}</h3>
            <CheckField
              label={labels.settings.enableSimulation}
              checked={settings.simulation.enabled}
              onChange={(checked) =>
                onUpdate((next) => {
                  next.simulation.enabled = checked;
                  return next;
                })
              }
            />
            {settings.simulation.enabled ? (
              <button
                type="button"
                className="adjust-reset"
                onClick={() =>
                  onUpdate((next) => {
                    next.simulation.enabled = false;
                    return next;
                  })
                }
              >
                <span>{labels.settings.disableSimulation}</span>
              </button>
            ) : null}
            <p className="adjust-note">{labels.settings.simulationPresetHint}</p>
            <label className="adjust-row">
              <span>{labels.settings.simulationDevice}</span>
              <select
                className="adjust-select"
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
            </label>
            <label className="adjust-row">
              <span>{labels.settings.simulationScenario}</span>
              <select
                className="adjust-select"
                value={settings.simulation.scenario}
                onChange={(event) =>
                  onUpdate((next) => {
                    next.simulation.scenario = event.target.value as SimulationScenario;
                    return next;
                  })
                }
              >
                {SCENARIO_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {labels.settings.scenarios[option]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <p className="adjust-note">{labels.settings.trayOnlyNote}</p>

          <button
            type="button"
            className="adjust-reset"
            onClick={() => setOpacity(OPACITY.default)}
          >
            <RotateCcw size={14} />
            <span>{labels.settings.resetOpacity}</span>
          </button>
          <button
            type="button"
            className="adjust-reset"
            onClick={() =>
              onUpdate((next) => {
                next.input = { ...DEFAULT_INPUT };
                return next;
              })
            }
          >
            <RotateCcw size={14} />
            <span>{labels.settings.resetInput}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundStep(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Number input with a local draft value: invalid/empty drafts are never sent
 * to the backend, and valid drafts are committed debounced (plus on blur) so
 * typing does not trigger a settings write per keystroke.
 */
function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onCommit
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(() => String(value));
  const editingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editingRef.current) {
      setText(String(value));
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) {
      return false;
    }

    onCommit(clamp(parsed, min, max));
    return true;
  };

  return (
    <label className="adjust-row" title={hint}>
      <span>{label}</span>
      <input
        className="adjust-number"
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onFocus={() => {
          editingRef.current = true;
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
          }
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            commit(raw);
          }, NUMBER_COMMIT_DEBOUNCE_MS);
        }}
        onBlur={() => {
          editingRef.current = false;
          if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (!commit(text)) {
            setText(String(value));
          }
        }}
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="adjust-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * Slider with local preview while dragging; commits to settings after a short
 * debounce (or immediately for stepper buttons) so continuous drag does not
 * spam update_settings.
 */
function SliderField({
  icon,
  label,
  value,
  range,
  onChange,
  labels
}: {
  icon: ReactNode;
  label: string;
  value: number;
  range: Range;
  onChange: (value: number) => void;
  labels: Translation;
}) {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) {
      setDraft(value);
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  const percent = Math.round(draft * 100);
  const fill = ((draft - range.min) / (range.max - range.min)) * 100;

  const commit = (next: number) => {
    const clamped = clamp(roundStep(next), range.min, range.max);
    setDraft(clamped);
    onChange(clamped);
  };

  const scheduleCommit = (next: number) => {
    const clamped = clamp(roundStep(next), range.min, range.max);
    setDraft(clamped);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onChange(clamped);
    }, SLIDER_COMMIT_DEBOUNCE_MS);
  };

  const step = (delta: number) => commit(draft + delta);

  return (
    <div className="adjust-field">
      <div className="adjust-field-head">
        <span className="adjust-field-label">
          {icon}
          {label}
        </span>
        <strong className="adjust-field-value">{percent}%</strong>
      </div>
      <div className="adjust-field-row">
        <button
          type="button"
          className="adjust-stepper"
          aria-label={labels.settings.decrease(label)}
          disabled={draft <= range.min}
          onClick={() => step(-range.coarse)}
          onPointerDown={(e) => e.preventDefault()}
        >
          <Minus size={15} />
        </button>
        <input
          className="adjust-slider"
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={draft}
          aria-label={label}
          aria-valuemin={range.min}
          aria-valuemax={range.max}
          aria-valuenow={draft}
          aria-valuetext={`${percent}%`}
          style={{ "--fill": `${fill}%` } as CSSProperties}
          onPointerDown={() => {
            draggingRef.current = true;
          }}
          onPointerUp={() => {
            draggingRef.current = false;
            if (timerRef.current !== null) {
              window.clearTimeout(timerRef.current);
              timerRef.current = null;
            }
            onChange(clamp(roundStep(draft), range.min, range.max));
          }}
          onChange={(event) => scheduleCommit(Number(event.target.value))}
        />
        <button
          type="button"
          className="adjust-stepper"
          aria-label={labels.settings.increase(label)}
          disabled={draft >= range.max}
          onClick={() => step(range.coarse)}
          onPointerDown={(e) => e.preventDefault()}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
