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
    className={`menu-item text-left ${selected ? "selected" : ""}`}
    onClick={() => {
      if (!options || options.length === 0) return;
      const i = options.indexOf(value);
      const next = i >= 0 ? options[(i + 1) % options.length] : options[0];
      onChange?.(next);
    }}
  >
    <div className="menu-item-body">
      <div className="menu-item-label">
        {selected ? "▸" : " "} {label}
      </div>
      <div className="menu-item-preview">{value}</div>
    </div>
  </button>
);
