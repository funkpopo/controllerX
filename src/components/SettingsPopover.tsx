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
  ProfileInfo,
  SimulationScenario
} from "../types/controller";

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

const SCENARIO_OPTIONS: { value: SimulationScenario; label: string }[] = [
  { value: "sweep", label: "扫掠" },
  { value: "buttons", label: "按键" },
  { value: "triggers", label: "扳机" },
  { value: "hotPlug", label: "热插拔" }
];

type SettingsPopoverProps = {
  settings: AppSettings;
  profiles: ProfileInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (edit: (settings: AppSettings) => AppSettings) => void;
};

export function SettingsPopover({
  settings,
  profiles,
  open,
  onOpenChange,
  onUpdate
}: SettingsPopoverProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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
        aria-label="叠加层设置"
        aria-expanded={open}
        title="叠加层设置"
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={16} />
      </button>

      {open ? (
        <div className="adjust-popover" role="dialog" aria-label="叠加层设置">
          <SliderField
            icon={<Eye size={16} />}
            label="透明度"
            value={settings.overlay.opacity}
            range={OPACITY}
            onChange={setOpacity}
          />

          <section className="adjust-section">
            <h3>输入</h3>
            <NumberField
              label="左摇杆死区"
              hint="低于该幅度的左摇杆输入会被忽略(0–0.4)"
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
              label="右摇杆死区"
              hint="低于该幅度的右摇杆输入会被忽略(0–0.4)"
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
              label="扳机死区"
              hint="低于该幅度的扳机输入会被忽略(0–0.4)"
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
              label="摇杆灵敏度"
              hint="大于 1 更灵敏,小于 1 更平缓(0.25–2.5)"
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
              label="扳机灵敏度"
              hint="大于 1 更灵敏,小于 1 更平缓(0.25–2.5)"
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
                label="反转左摇杆 Y"
                checked={settings.input.invertLeftY}
                onChange={(checked) =>
                  onUpdate((next) => {
                    next.input.invertLeftY = checked;
                    return next;
                  })
                }
              />
              <CheckField
                label="反转右摇杆 Y"
                checked={settings.input.invertRightY}
                onChange={(checked) =>
                  onUpdate((next) => {
                    next.input.invertRightY = checked;
                    return next;
                  })
                }
              />
              <CheckField
                label="反转十字键 Y"
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
            <h3>模拟</h3>
            <CheckField
              label="启用模拟数据(无需手柄即可预览)"
              checked={settings.simulation.enabled}
              onChange={(checked) =>
                onUpdate((next) => {
                  next.simulation.enabled = checked;
                  return next;
                })
              }
            />
            <label className="adjust-row">
              <span>模拟设备</span>
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
              <span>模拟场景</span>
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
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <button
            type="button"
            className="adjust-reset"
            onClick={() => setOpacity(OPACITY.default)}
          >
            <RotateCcw size={14} />
            <span>重置透明度</span>
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

function SliderField({
  icon,
  label,
  value,
  range,
  onChange
}: {
  icon: ReactNode;
  label: string;
  value: number;
  range: Range;
  onChange: (value: number) => void;
}) {
  const percent = Math.round(value * 100);
  const fill = ((value - range.min) / (range.max - range.min)) * 100;

  const step = (delta: number) =>
    onChange(clamp(roundStep(value + delta), range.min, range.max));

  const handleChange = (newValue: number) => {
    onChange(clamp(roundStep(newValue), range.min, range.max));
  };

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
          aria-label={`减小${label}`}
          disabled={value <= range.min}
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
          value={value}
          aria-label={label}
          aria-valuemin={range.min}
          aria-valuemax={range.max}
          aria-valuenow={value}
          aria-valuetext={`${percent}%`}
          style={{ "--fill": `${fill}%` } as CSSProperties}
          onChange={(event) => handleChange(Number(event.target.value))}
        />
        <button
          type="button"
          className="adjust-stepper"
          aria-label={`增大${label}`}
          disabled={value >= range.max}
          onClick={() => step(range.coarse)}
          onPointerDown={(e) => e.preventDefault()}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
