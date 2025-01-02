import { useRef } from "react";
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
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newValue = min + (max - min) * percentage;
    const steppedValue = Math.round(newValue / step) * step;
    const decimalPlaces = step.toString().split(".")[1]?.length || 0;
    const roundedValue = Number(
      Math.max(min, Math.min(max, steppedValue)).toFixed(decimalPlaces)
    );
    onChange(roundedValue);
  };

  const handleTrackDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return; // Only handle left mouse button
    handleTrackClick(e);
  };

  const decimalPlaces = step.toString().split(".")[1]?.length || 0;
  const displayValue = Number(value.toFixed(decimalPlaces));

  return (
    <div
      className={`menu-item ${selected ? "selected" : ""}`}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={displayValue.toString()}
      tabIndex={selected ? 0 : -1}
    >
      <div className="menu-item-label">{label}</div>
      <div className="menu-item-value">
        <div className="menu-knob">
          <div
            ref={trackRef}
            className="menu-knob-track"
            onClick={handleTrackClick}
            onMouseMove={handleTrackDrag}
          >
            <div
              className="menu-knob-handle"
              style={{
                left: `${((value - min) / (max - min)) * 100}%`,
              }}
            />
          </div>
          <div className="menu-knob-value">{displayValue}</div>
        </div>
      </div>
    </div>
  );
};
