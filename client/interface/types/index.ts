export interface StoryNode {
  id: string;
  text: string;
  continuations?: StoryNode[];
}

export interface MenuScreenProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  showCloseInstructions?: boolean;
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

export interface SettingsMenuProps {
  params: {
    temperature: number;
    maxTokens: number;
    model: string;
  };
  onParamChange: (param: string, value: number | string) => void;
  selectedParam: number;
}

export interface TreeListProps {
  trees: { [key: string]: { root: StoryNode } };
  selectedIndex: number;
  onSelect: (key: string) => void;
}

export interface GamepadButtonProps {
  label: string;
  className?: string;
  active?: boolean;
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

export interface GeneratingState {
  depth: number;
  index: number | null;
}

export interface ActiveControls {
  direction: string | null;
  a: boolean;
  b: boolean;
  select: boolean;
  start: boolean;
}

export type MenuType = "select" | "start" | "edit" | null;