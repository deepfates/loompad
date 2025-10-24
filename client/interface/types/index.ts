import type { AvailableModels, ModelId } from "../../../shared/models";
import type { LengthMode } from "../../../shared/lengthPresets";
import type { Theme } from "../components/ThemeToggle";

export interface StoryNode {
  id: string;
  text: string;
  continuations?: StoryNode[];
  lastSelectedIndex?: number;
}

export interface MenuScreenProps {
  children: React.ReactNode;
}

export interface MenuKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  selected: boolean;
}

export interface MenuSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  selected: boolean;
}

export interface MenuToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  selected: boolean;
}

export interface SettingsMenuProps {
  params: {
    temperature: number;
    lengthMode: LengthMode;
    model: ModelId;
    textSplitting: boolean;
    autoModeIterations: number;
    theme: Theme;
  };
  onParamChange: (param: string, value: number | string | boolean) => void;
  selectedParam: number;
  isLoading?: boolean;
  models: AvailableModels | null;
  modelsLoading?: boolean;
  modelsError?: string | null;
  getModelName: (modelId: ModelId) => string;
  onManageModels?: () => void;
}

export interface TreeListProps {
  trees: { [key: string]: { root: StoryNode } };
  selectedIndex: number;
  onSelect: (key: string) => void;
  onDelete?: (key: string) => void;
  onNew?: () => void;
}

export interface GamepadButtonProps {
  label: string;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

export interface DPadProps {
  activeDirection: string | null;
  onControlPress: (key: string) => void;
  onControlRelease: (key: string) => void;
}

export interface MenuButtonProps {
  label: string;
  active: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

export type ModelSortOption = "name-asc" | "name-desc";

export type InFlight = Set<string>;

export interface GeneratingInfo {
  [nodeId: string]: {
    depth: number;
    index: number | null;
  };
}

export interface ActiveControls {
  direction: string | null;
  a: boolean;
  b: boolean;
  select: boolean;
  start: boolean;
}

export type MenuType =
  | "select"
  | "start"
  | "edit"
  | "map"
  | "models"
  | "model-editor"
  | null;
