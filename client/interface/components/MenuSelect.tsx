import { MenuSelectProps } from "../types";

export const MenuSelect = ({
  label,
  value,
  options,
  onChange,
  selected,
}: MenuSelectProps) => (
  <button
    type="button"
    className={`menu-item menu-item--inline text-left ${selected ? "selected" : ""}`}
    onClick={() => {
      if (!options || options.length === 0) return;
      const i = options.indexOf(value);
      const next = i >= 0 ? options[(i + 1) % options.length] : options[0];
      onChange?.(next);
    }}
  >
    <span className="menu-item-label">{label}:</span>
    <span className="menu-item-preview">{value}</span>
  </button>
);
