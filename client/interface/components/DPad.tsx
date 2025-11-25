import { DPadProps } from "../types";

export const DPad = ({
  activeDirection,
  onControlPress,
  onControlRelease,
}: DPadProps) => (
  <div className="terminal-grid" role="group" aria-label="Direction Controls">
    {/* Up */}
    <button
      className={`terminal-grid-cell gamepad-btn ${
        activeDirection === "up" ? "active" : ""
      }`}
      onMouseDown={() => onControlPress("ArrowUp")}
      onMouseUp={() => onControlRelease("ArrowUp")}
      onMouseLeave={() => onControlRelease("ArrowUp")}
      aria-label="Up"
    >
      ▴
    </button>
    {/* Left */}
    <button
      className={`terminal-grid-cell gamepad-btn ${
        activeDirection === "left" ? "active" : ""
      }`}
      onMouseDown={() => onControlPress("ArrowLeft")}
      onMouseUp={() => onControlRelease("ArrowLeft")}
      onMouseLeave={() => onControlRelease("ArrowLeft")}
      aria-label="Left"
    >
      ◂
    </button>
    {/* Right */}
    <button
      className={`terminal-grid-cell gamepad-btn ${
        activeDirection === "right" ? "active" : ""
      }`}
      onMouseDown={() => onControlPress("ArrowRight")}
      onMouseUp={() => onControlRelease("ArrowRight")}
      onMouseLeave={() => onControlRelease("ArrowRight")}
      aria-label="Right"
    >
      ▸
    </button>
    {/* Down */}
    <button
      className={`terminal-grid-cell gamepad-btn ${
        activeDirection === "down" ? "active" : ""
      }`}
      onMouseDown={() => onControlPress("ArrowDown")}
      onMouseUp={() => onControlRelease("ArrowDown")}
      onMouseLeave={() => onControlRelease("ArrowDown")}
      aria-label="Down"
    >
      ▾
    </button>
  </div>
);
