import { SettingsMenuProps } from "../types";
import { MenuKnob } from "../components/MenuKnob";
import { MenuSelect } from "../components/MenuSelect";
import { MenuToggle } from "../components/MenuToggle";
import { useModels } from "../hooks/useModels";
import type { ModelId } from "../../../shared/models";

export const SettingsMenu = ({
  params,
  onParamChange,
  selectedParam = 0,
  isLoading = false,
}: SettingsMenuProps) => {
  const { models, loading: loadingModels, error, getModelName } = useModels();

  // Get model options
  const modelOptions = models ? (Object.keys(models) as ModelId[]) : [];
  const modelNames = modelOptions.map(getModelName);

  // Get current model config
  const currentModel = models?.[params.model];

  return (
    <div className="menu-content">
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
        max={currentModel?.maxTokens ?? 1024}
        step={10}
        onChange={(value) => onParamChange("maxTokens", value)}
        selected={selectedParam === 1}
      />
      <MenuSelect
        label={`Model${loadingModels && !models ? " (Loading...)" : ""}`}
        value={getModelName(params.model)}
        options={modelNames}
        onChange={(value) => {
          // Find the model ID that matches this display name
          const modelId = modelOptions.find((id) => getModelName(id) === value);
          if (modelId) {
            onParamChange("model", modelId);
            // Update maxTokens to model default if current value exceeds max
            const maxTokens = models[modelId].maxTokens;
            if (params.maxTokens > maxTokens) {
              onParamChange("maxTokens", maxTokens);
            }
          }
        }}
        selected={selectedParam === 2}
      />
      <MenuSelect
        label="Theme"
        value={
          params.theme === "matrix"
            ? "Dark"
            : params.theme === "light"
              ? "Light"
              : "System"
        }
        options={["Dark", "Light", "System"]}
        onChange={(value) => {
          const themeValue =
            value === "Dark"
              ? "matrix"
              : value === "Light"
                ? "light"
                : "system";
          onParamChange("theme", themeValue);
        }}
        selected={selectedParam === 3}
      />
      <MenuToggle
        label="Text Splitting"
        value={params.textSplitting}
        onChange={(value) => onParamChange("textSplitting", value)}
        selected={selectedParam === 4}
      />
      {error && (
        <output className="error-message">
          Failed to load models: {error}
        </output>
      )}
      {isLoading && <output className="loading-message">Generating...</output>}
    </div>
  );
};
