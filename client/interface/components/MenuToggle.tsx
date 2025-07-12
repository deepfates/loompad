import { MenuToggleProps } from "../types";

export const MenuToggle = ({
  label,
  value,
  onChange,
  selected,
}: MenuToggleProps) => (
  <div
    className={`menu-item ${selected ? "selected" : ""}`}
    role="switch"
    aria-label={label}
    aria-checked={value}
    tabIndex={selected ? 0 : -1}
  >
    <div className="menu-item-label">{label}</div>
    <div className="menu-item-value">
      <div className="menu-checkbox">
        <span className="menu-checkbox-box">
          {value ? "✓" : " "}
        </span>
        <span className="menu-checkbox-label">
          {value ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  </div>
);