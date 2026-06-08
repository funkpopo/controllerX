import {
  Eye,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";

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

type OverlayAdjustmentsProps = {
  opacity: number;
  onOpacityChange: (value: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OverlayAdjustments({
  opacity,
  onOpacityChange,
  open,
  onOpenChange
}: OverlayAdjustmentsProps) {
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

  const resetDefaults = () => {
    onOpacityChange(OPACITY.default);
  };

  return (
    <div className="adjust" ref={wrapperRef}>
      <button
        type="button"
        className={`icon-button adjust-trigger ${open ? "active" : ""}`}
        aria-label="调整透明度"
        aria-expanded={open}
        title="透明度"
        onClick={() => onOpenChange(!open)}
      >
        <SlidersHorizontal size={16} />
      </button>

      {open ? (
        <div className="adjust-popover" role="dialog" aria-label="调整">
          <SliderField
            icon={<Eye size={16} />}
            label="透明度"
            value={opacity}
            range={OPACITY}
            onChange={onOpacityChange}
          />
          <button type="button" className="adjust-reset" onClick={resetDefaults}>
            <RotateCcw size={14} />
            <span>重置默认</span>
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
  const [isDragging, setIsDragging] = useState(false);
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
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={() => setIsDragging(false)}
          onPointerCancel={() => setIsDragging(false)}
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
