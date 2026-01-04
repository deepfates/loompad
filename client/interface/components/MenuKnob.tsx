import RowSpaceBetween from "srcl/components/RowSpaceBetween.tsx";
import NumberRangeSlider from "srcl/components/NumberRangeSlider.tsx";
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
    <RowSpaceBetween
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={displayText}
      tabIndex={selected ? 0 : -1}
      style={{ background: selected ? "var(--theme-focused-foreground-subdued)" : undefined }}
    >
      <div className="menu-knob__meta">
        <span className="menu-knob__label">{label}</span>
        <span className="menu-knob__value">{displayText}</span>
      </div>
      <NumberRangeSlider
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        className="menu-knob__slider"
      />
    </RowSpaceBetween>
  );
};
