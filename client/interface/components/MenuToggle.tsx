import { MenuToggleProps } from "../types";

export const MenuToggle = ({
  label,
  value,
  onChange,
  selected,
}: MenuToggleProps) => (
  <label
    className={`menu-item ${selected ? "selected" : ""}`}
    style={{
      background: selected
        ? "var(--theme-focused-foreground-subdued)"
        : undefined,
    }}
  >
    <div className="menu-item-body">
      <div className="menu-item-label">
        <input
          type="checkbox"
          name={label}
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="mr-2"
        />
        {label}
      </div>
    </div>
  </label>
);
