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
        label="▴"
        active={activeDirection === "up"}
        onPressStart={() => onControlPress("ArrowUp")}
        onPressEnd={() => onControlRelease("ArrowUp")}
      />
    </div>
    <div className="terminal-grid-cell left-arrow">
      <GamepadButton
        label="◂"
        active={activeDirection === "left"}
        onPressStart={() => onControlPress("ArrowLeft")}
        onPressEnd={() => onControlRelease("ArrowLeft")}
      />
    </div>
    <div className="terminal-grid-cell">
      <div />
    </div>
    <div className="terminal-grid-cell right-arrow">
      <GamepadButton
        label="▸"
        active={activeDirection === "right"}
        onPressStart={() => onControlPress("ArrowRight")}
        onPressEnd={() => onControlRelease("ArrowRight")}
      />
    </div>
    <div className="terminal-grid-cell down-arrow">
      <GamepadButton
        label="▾"
        active={activeDirection === "down"}
        onPressStart={() => onControlPress("ArrowDown")}
        onPressEnd={() => onControlRelease("ArrowDown")}
      />
    </div>
  </div>
);
