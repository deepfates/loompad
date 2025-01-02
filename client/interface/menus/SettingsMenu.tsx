import { SettingsMenuProps } from "../types";
import { MenuKnob } from "../components/MenuKnob";
import { MenuSelect } from "../components/MenuSelect";

const MODELS = ["mistral-7b", "llama-2-7b", "mixtral-8x7b"];

export const SettingsMenu = ({
  params,
  onParamChange,
  selectedParam = 0,
}: SettingsMenuProps) => (
  <div className="menu-content" role="menu">
    <MenuKnob
      label="Temperature"
      value={params.temperature}
      min={0.1}
      max={2.0}
      step={0.1}
      onChange={(value) => onParamChange("temperature", value)}
      selected={selectedParam === 0}
    />
    <MenuKnob
      label="Max Tokens"
      value={params.maxTokens}
      min={10}
      max={500}
      step={10}
      onChange={(value) => onParamChange("maxTokens", value)}
      selected={selectedParam === 1}
    />
    <MenuSelect
      label="Model"
      value={params.model}
      options={MODELS}
      onChange={(value) => onParamChange("model", value)}
      selected={selectedParam === 2}
    />
  </div>
);
