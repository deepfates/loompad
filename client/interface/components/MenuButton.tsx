import { MenuButtonProps } from "../types";

export const MenuButton = ({
  label,
  active,
  onMouseDown,
  onMouseUp,
}: MenuButtonProps) => (
  <button
    className={`gamepad-btn ${active ? "active" : ""}`}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseUp}
    aria-pressed={active}
  >
    {label}
  </button>
);
