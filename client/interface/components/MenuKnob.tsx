import { MenuKnobProps } from "../types";

export const MenuKnob = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  selected,
  formatValue,
}: MenuKnobProps) => {
  const decimalPlaces = step.toString().split(".")[1]?.length || 0;
  const displayValue = Number(value.toFixed(decimalPlaces));
  const displayText = formatValue
    ? formatValue(displayValue)
    : displayValue.toString();
  const fraction = max > min ? (value - min) / (max - min) : 0;

  return (
    <div
      className={`menu-item menu-item--knob ${selected ? "selected" : ""}`}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={displayText}
      tabIndex={selected ? 0 : -1}
    >
      <div className="menu-knob__meta">
        <span className="menu-knob__label">{label}</span>
        <span className="menu-knob__value">{displayText}</span>
      </div>
      <div className="menu-knob__bar" aria-hidden="true">
        <div
          className="menu-knob__bar-fill"
          style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        className="menu-knob__slider"
        onChange={(event) => onChange(Number(event.target.value))}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
};
