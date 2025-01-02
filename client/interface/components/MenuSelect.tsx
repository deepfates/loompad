import { MenuSelectProps } from "../types";

export const MenuSelect = ({
  label,
  value,
  options,
  onChange,
  selected,
}: MenuSelectProps) => (
  <div
    className={`menu-item ${selected ? "selected" : ""}`}
    role="combobox"
    aria-label={label}
    aria-expanded={selected}
    aria-haspopup="listbox"
  >
    <div className="menu-item-label">{label}</div>
    <div className="menu-item-value">{value}</div>
  </div>
);
