import { GamepadButtonProps } from "../types";

export const GamepadButton = ({
  label,
  className = "",
  active = false,
  disabled = false,
  onMouseDown,
  onMouseUp,
}: GamepadButtonProps) => (
  <button
    className={`btn ${active ? "btn-primary" : "btn-ghost"} ${className}`}
    disabled={disabled}
    onMouseDown={disabled ? undefined : onMouseDown}
    onMouseUp={disabled ? undefined : onMouseUp}
    aria-pressed={active}
  >
    {label}
  </button>
);
