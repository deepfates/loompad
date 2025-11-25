import ActionListItem from "srcl/components/ActionListItem.tsx";
import { MenuSelectProps } from "../types";

export const MenuSelect = ({
  label,
  value,
  options,
  onChange,
  selected,
}: MenuSelectProps) => (
  <ActionListItem
    icon={selected ? "▸" : " "}
    onClick={() => {
      if (!options || options.length === 0) return;
      const i = options.indexOf(value);
      const next = i >= 0 ? options[(i + 1) % options.length] : options[0];
      onChange?.(next);
    }}
  >
    {label}: {value}
  </ActionListItem>
);
