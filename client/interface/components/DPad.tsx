import { DPadProps } from "../types";
import { GamepadButton } from "./GamepadButton";

export const DPad = ({
  activeDirection,
  onControlPress,
  onControlRelease,
}: DPadProps) => (
  <div className="terminal-grid" role="group" aria-label="Direction Controls">
    <div className="terminal-grid-cell up-arrow">
      <GamepadButton
        label="▲"
        active={activeDirection === "up"}
        onMouseDown={() => onControlPress("ArrowUp")}
        onMouseUp={() => onControlRelease("ArrowUp")}
      />
    </div>
    <div className="terminal-grid-cell left-arrow">
      <GamepadButton
        label="◀"
        active={activeDirection === "left"}
        onMouseDown={() => onControlPress("ArrowLeft")}
        onMouseUp={() => onControlRelease("ArrowLeft")}
      />
    </div>
    <div className="terminal-grid-cell">
      <div />
    </div>
    <div className="terminal-grid-cell right-arrow">
      <GamepadButton
        label="▶"
        active={activeDirection === "right"}
        onMouseDown={() => onControlPress("ArrowRight")}
        onMouseUp={() => onControlRelease("ArrowRight")}
      />
    </div>
    <div className="terminal-grid-cell down-arrow">
      <GamepadButton
        label="▼"
        active={activeDirection === "down"}
        onMouseDown={() => onControlPress("ArrowDown")}
        onMouseUp={() => onControlRelease("ArrowDown")}
      />
    </div>
  </div>
);
