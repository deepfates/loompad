import { GamepadButtonProps } from "../types";

export const GamepadButton = ({
  label,
  className = "",
  active = false,
  onMouseDown,
  onMouseUp,
}: GamepadButtonProps) => (
  <button
    className={`btn ${active ? "btn-primary" : "btn-ghost"} ${className}`}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    aria-pressed={active}
  >
    {label}
  </button>
);
