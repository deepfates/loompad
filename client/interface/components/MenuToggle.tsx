import Checkbox from "srcl/components/Checkbox.tsx";
import { MenuToggleProps } from "../types";

export const MenuToggle = ({
  label,
  value,
  onChange,
  selected,
}: MenuToggleProps) => (
  <Checkbox
    name={label}
    defaultChecked={value}
    onChange={(e) => onChange(e.target.checked)}
    style={{ background: selected ? "var(--theme-focused-foreground-subdued)" : undefined }}
  >
    {label}
  </Checkbox>
);
