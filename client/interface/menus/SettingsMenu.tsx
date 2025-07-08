import { SettingsMenuProps } from "../types";
import { MenuKnob } from "../components/MenuKnob";
import { MenuSelect } from "../components/MenuSelect";
import { useModels } from "../hooks/useModels";
import type { ModelId } from "../../../server/apis/generation";

export const SettingsMenu = ({
  params,
  onParamChange,
  selectedParam = 0,
  isLoading = false,
  onManageModels,
  onExportData,
  onImportData,
}: SettingsMenuProps) => {
  const { models, loading: loadingModels, error, getModelName } = useModels();

  // Get model options
  const modelOptions = models ? (Object.keys(models) as ModelId[]) : [];
  const modelNames = modelOptions.map(getModelName);

  // Get current model config
  const currentModel = models?.[params.model];

  return (
    <menu className="menu-content">
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
        min={1}
        max={currentModel?.maxTokens ?? 500}
        step={10}
        onChange={(value) => onParamChange("maxTokens", value)}
        selected={selectedParam === 1}
      />
      <MenuSelect
        label={`Model${loadingModels ? " (Loading...)" : ""}`}
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
      <MenuKnob
        label="Generation Count"
        value={params.generationCount}
        min={1}
        max={10}
        step={1}
        onChange={(value) => onParamChange("generationCount", value)}
        selected={selectedParam === 3}
      />
      <div
        className={`menu-item ${selectedParam === 4 ? "selected" : ""}`}
      >
        <div className="menu-item-label">Manage Models</div>
        <div className="menu-item-preview">Add, edit, or delete model configurations</div>
      </div>
      <div
        className={`menu-item ${selectedParam === 5 ? "selected" : ""}`}
        onClick={() => onExportData?.()}
      >
        <div className="menu-item-label">Export Data</div>
        <div className="menu-item-preview">Download all story trees as JSON</div>
      </div>
      <div
        className={`menu-item ${selectedParam === 6 ? "selected" : ""}`}
        onClick={() => onImportData?.()}
      >
        <div className="menu-item-label">Import Data</div>
        <div className="menu-item-preview">Load story trees from JSON file</div>
      </div>
      {error && (
        <output className="error-message">
          Failed to load models: {error}
        </output>
      )}
      {isLoading && <output className="loading-message">Generating...</output>}
    </menu>
  );
};
