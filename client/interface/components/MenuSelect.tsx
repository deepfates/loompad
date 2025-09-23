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
    <div
      className="menu-item-value"
      onClick={() => {
        if (!options || options.length === 0) return;
        const i = options.indexOf(value);
        const next = i >= 0 ? options[(i + 1) % options.length] : options[0];
        onChange?.(next);
      }}
    >
      {value}
    </div>
  </div>
);
