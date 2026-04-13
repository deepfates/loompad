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

  return (
    <div
      className={`menu-item ${selected ? "selected" : ""}`}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={displayText}
      tabIndex={selected ? 0 : -1}
      style={{
        background: selected
          ? "var(--theme-focused-foreground-subdued)"
          : undefined,
      }}
    >
      <div className="menu-knob__meta">
        <span className="menu-knob__label">{label}</span>
        <span className="menu-knob__value">{displayText}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        className="menu-knob__slider"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
};
