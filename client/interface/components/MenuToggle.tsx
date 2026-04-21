import { MenuToggleProps } from "../types";

export const MenuToggle = ({
  label,
  value,
  onChange,
  selected,
}: MenuToggleProps) => (
  <label
    className={`menu-item menu-item--inline ${selected ? "selected" : ""}`}
  >
    <span className="menu-toggle__box" aria-hidden="true">
      {value ? "×" : " "}
    </span>
    <span className="menu-item-label">{label}</span>
    <input
      type="checkbox"
      name={label}
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
      className="menu-toggle__input"
    />
  </label>
);
