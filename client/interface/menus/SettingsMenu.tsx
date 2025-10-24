import { SettingsMenuProps } from "../types";
import { MenuKnob } from "../components/MenuKnob";
import { MenuSelect } from "../components/MenuSelect";
import { MenuToggle } from "../components/MenuToggle";
import type { ModelId } from "../../../shared/models";
import {
  LENGTH_PRESETS,
  type LengthMode,
} from "../../../shared/lengthPresets";

export const SettingsMenu = ({
  params,
  onParamChange,
  selectedParam = 0,
  isLoading = false,
  models,
  modelsLoading = false,
  modelsError,
  getModelName,
  onManageModels,
}: SettingsMenuProps) => {

  // Get model options
  const modelOptions = models ? (Object.keys(models) as ModelId[]) : [];
  const modelNames = modelOptions.map(getModelName);
  const isModelsLoading = modelsLoading && !models;

  const lengthModes: LengthMode[] = ["word", "sentence", "paragraph", "page"];
  const lengthModeLabels = lengthModes.map(
    (mode) => LENGTH_PRESETS[mode].label,
  );
  const currentLengthLabel = LENGTH_PRESETS[params.lengthMode].label;

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
      <MenuSelect
        label="Length"
        value={currentLengthLabel}
        options={lengthModeLabels}
        onChange={(value) => {
          const index = lengthModeLabels.indexOf(value);
          if (index >= 0) {
            onParamChange("lengthMode", lengthModes[index]);
          }
        }}
        selected={selectedParam === 1}
      />
      <MenuSelect
        label={`Model${isModelsLoading ? " (Loading...)" : ""}`}
        value={getModelName(params.model)}
        options={modelNames}
        onChange={(value) => {
          // Find the model ID that matches this display name
          const modelId = modelOptions.find((id) => getModelName(id) === value);
          if (modelId) {
            onParamChange("model", modelId);
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
      <MenuKnob
        label="Auto Mode"
        value={params.autoModeIterations}
        min={0}
        max={3}
        step={1}
        onChange={(value) =>
          onParamChange("autoModeIterations", Math.round(value))
        }
        selected={selectedParam === 5}
      />
      <div
        className={`menu-item ${selectedParam === 6 ? "selected" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => onManageModels?.()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onManageModels?.();
          }
        }}
      >
        <div className="menu-item-label">Manage Models</div>
        <div className="menu-item-preview">
          Add, edit, or remove OpenRouter models
        </div>
      </div>
      {modelsError && (
        <output className="error-message">
          Failed to load models: {modelsError}
        </output>
      )}
      {isLoading && <output className="loading-message">Generating...</output>}
    </div>
  );
};
