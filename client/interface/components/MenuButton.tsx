import { MenuButtonProps } from "../types";

export const MenuButton = ({
  label,
  active,
  onMouseDown,
  onMouseUp,
}: MenuButtonProps) => (
  <button
    className={`btn ${active ? "btn-primary" : "btn-ghost"}`}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    aria-pressed={active}
  >
    {label}
  </button>
);
