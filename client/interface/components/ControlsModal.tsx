import { useState, useEffect } from "react";
import { DPad } from "./DPad";
import { GamepadButton, ShoulderButton } from "./GamepadButton";
import { MenuButton } from "./MenuButton";

interface ControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ControlMapping {
  button: string;
  keys: string[];
  description: string;
}

const CONTROL_MAPPINGS: ControlMapping[] = [
  {
    button: "D-Pad Up",
    keys: ["↑", "W"],
    description: "Navigate up in story tree"
  },
  {
    button: "D-Pad Down", 
    keys: ["↓", "S"],
    description: "Navigate down in story tree"
  },
  {
    button: "D-Pad Left",
    keys: ["←", "A"],
    description: "Navigate to previous branch"
  },
  {
    button: "D-Pad Right",
    keys: ["→", "D"],
    description: "Navigate to next branch"
  },
  {
    button: "A Button",
    keys: ["Enter"],
    description: "Generate new continuation"
  },
  {
    button: "B Button",
    keys: ["Backspace"],
    description: "Edit current text"
  },
  {
    button: "Select",
    keys: ["`", "Z"],
    description: "Open settings menu"
  },
  {
    button: "Start",
    keys: ["Escape", "M"],
    description: "Switch between stories"
  },
  {
    button: "L Shoulder",
    keys: ["Q"],
    description: "Switch to previous model"
  },
  {
    button: "R Shoulder",
    keys: ["E", "R", "P"],
    description: "Switch to next model"
  }
];

export const ControlsModal = ({ isOpen, onClose }: ControlsModalProps) => {
  const [activeButton, setActiveButton] = useState<string | null>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "`") {
      onClose();
    }
  };

  // Add event listener when modal opens
  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content controls-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Controls</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="controls-layout controls-layout-vertical">
          {/* GameBoy Controller Visual */}
          <div className="gameboy-controller">
            <div className="controller-body">
              {/* Top row - Shoulder buttons and model display */}
              <div className="controller-shoulders">
                <ShoulderButton
                  label="L"
                  active={false}
                  onMouseDown={() => {}}
                  onMouseUp={() => {}}
                />
                <div className="model-display">MODEL</div>
                <ShoulderButton
                  label="R"
                  active={false}
                  onMouseDown={() => {}}
                  onMouseUp={() => {}}
                />
              </div>
              {/* Middle row - D-Pad and Action buttons */}
              <div className="controller-middle">
                {/* D-Pad (reuse main interface component) */}
                <div className="dpad-section">
                  <DPad
                    activeDirection={null}
                    onControlPress={() => {}}
                    onControlRelease={() => {}}
                  />
                  <div className="dpad-label">D-Pad</div>
                </div>
                {/* Action Buttons (use GamepadButton) */}
                <div className="action-buttons">
                  <div className="button-group">
                    <GamepadButton
                      label="B"
                      active={false}
                      onMouseDown={() => {}}
                      onMouseUp={() => {}}
                    />
                    <GamepadButton
                      label="A"
                      active={false}
                      onMouseDown={() => {}}
                      onMouseUp={() => {}}
                    />
                  </div>
                  <div className="buttons-label">Action</div>
                </div>
              </div>
              {/* Bottom row - Menu buttons (use MenuButton) */}
              <div className="terminal-menu">
                <MenuButton
                  label="SELECT"
                  active={false}
                  onMouseDown={() => {}}
                  onMouseUp={() => {}}
                />
                <MenuButton
                  label="START"
                  active={false}
                  onMouseDown={() => {}}
                  onMouseUp={() => {}}
                />
                <MenuButton
                  label="HELP"
                  active={false}
                  onMouseDown={() => {}}
                  onMouseUp={() => {}}
                />
              </div>
            </div>
          </div>
          {/* Keyboard Mappings below controller */}
          <div className="keyboard-mappings keyboard-mappings-grid">
            <h3>Keyboard Mappings</h3>
            <div className="mappings-list mappings-list-grid">
              {CONTROL_MAPPINGS.map((mapping) => (
                <div 
                  key={mapping.button}
                  className="mapping-item"
                  onMouseEnter={() => setActiveButton(mapping.button)}
                  onMouseLeave={() => setActiveButton(null)}
                >
                  <div className="mapping-button">{mapping.button}</div>
                  <div className="mapping-keys">
                    {mapping.keys.map((key, index) => (
                      <span key={key} className="key">
                        {key}{index < mapping.keys.length - 1 ? " / " : ""}
                      </span>
                    ))}
                  </div>
                  <div className="mapping-description">{mapping.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Remove modal footer with close instructions */}
      </div>
    </div>
  );
}; 