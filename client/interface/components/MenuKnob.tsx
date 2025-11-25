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
}: MenuKnobProps) => {
  const decimalPlaces = step.toString().split(".")[1]?.length || 0;
  const displayValue = Number(value.toFixed(decimalPlaces));

  return (
    <RowSpaceBetween
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={displayValue.toString()}
      tabIndex={selected ? 0 : -1}
      style={{ background: selected ? "var(--theme-focused-foreground-subdued)" : undefined }}
    >
      <span>{label}</span>
      <NumberRangeSlider
        defaultValue={value}
        min={min}
        max={max}
        step={step}
      />
    </RowSpaceBetween>
  );
};
