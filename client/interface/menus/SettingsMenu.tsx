import ActionListItem from "srcl/components/ActionListItem.tsx";
import { SettingsMenuProps } from "../types";
import { MenuKnob } from "../components/MenuKnob";
import { MenuSelect } from "../components/MenuSelect";
import { MenuToggle } from "../components/MenuToggle";
import type { ModelId } from "../../../shared/models";
import { LENGTH_PRESETS, type LengthMode } from "../../../shared/lengthPresets";
import { THEME_PRESETS } from "../components/ThemeToggle";

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
  fonts,
}: SettingsMenuProps) => {
  // Get model options
  const modelOptions = models ? (Object.keys(models) as ModelId[]) : [];
  const modelNames = modelOptions.map(getModelName);
  const isModelsLoading = modelsLoading && !models;

  const lengthModes: LengthMode[] = ["word", "sentence", "paragraph", "page"];
  const lengthModeLabels = lengthModes.map(
    (mode) => LENGTH_PRESETS[mode].label
  );
  const currentLengthLabel = LENGTH_PRESETS[params.lengthMode].label;
  const themeModeOptions = ["Light", "Dark", "System"];

  const themeOptionLabels: string[] = THEME_PRESETS.map(
    (preset) => preset.label
  );
  const themeOptionIds = THEME_PRESETS.map((preset) => preset.id);
  const getThemeLabel = (themeId: string) => {
    const preset = THEME_PRESETS.find((preset) => preset.id === themeId);
    return preset ? preset.label : themeId;
  };

  const lightThemePresets = THEME_PRESETS.filter(
    (preset) => preset.tone === "light"
  );
  const lightThemeLabels = lightThemePresets.map(
    (preset) => preset.label
  ) as string[];
  const lightThemeIds = lightThemePresets.map((preset) => preset.id);

  const darkThemePresets = THEME_PRESETS.filter(
    (preset) => preset.tone === "dark"
  );
  const darkThemeLabels = darkThemePresets.map(
    (preset) => preset.label
  ) as string[];
  const darkThemeIds = darkThemePresets.map((preset) => preset.id);
  const fontLabels = fonts.map((font) => font.label);
  const fontIds = fonts.map((font) => font.id);
  const currentFontLabel =
    fontLabels[fontIds.indexOf(params.font)] ?? params.font;

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
        label="Theme Mode"
        value={
          params.themeMode === "light"
            ? "Light"
            : params.themeMode === "dark"
            ? "Dark"
            : "System"
        }
        options={themeModeOptions}
        onChange={(value) => {
          const mode =
            value === "Light" ? "light" : value === "Dark" ? "dark" : "system";
          onParamChange("themeMode", mode);
        }}
        selected={selectedParam === 3}
      />
      <MenuSelect
        label="Light Theme"
        value={getThemeLabel(params.lightTheme)}
        options={lightThemeLabels}
        onChange={(value) => {
          const index = lightThemeLabels.indexOf(value);
          if (index >= 0) {
            onParamChange("lightTheme", lightThemeIds[index]);
          }
        }}
        selected={selectedParam === 4}
      />
      <MenuSelect
        label="Dark Theme"
        value={getThemeLabel(params.darkTheme)}
        options={darkThemeLabels}
        onChange={(value) => {
          const index = darkThemeLabels.indexOf(value);
          if (index >= 0) {
            onParamChange("darkTheme", darkThemeIds[index]);
          }
        }}
        selected={selectedParam === 5}
      />
      <MenuSelect
        label="Font"
        value={currentFontLabel}
        options={fontLabels}
        onChange={(value) => {
          const index = fontLabels.indexOf(value);
          if (index >= 0) {
            onParamChange("font", fontIds[index]);
          }
        }}
        selected={selectedParam === 6}
      />
      <MenuToggle
        label="Text Splitting"
        value={params.textSplitting}
        onChange={(value) => onParamChange("textSplitting", value)}
        selected={selectedParam === 7}
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
        selected={selectedParam === 8}
      />
      <ActionListItem
        icon={selectedParam === 9 ? "▸" : "⭢"}
        onClick={() => onManageModels?.()}
      >
        Manage Models
      </ActionListItem>
      {modelsError && (
        <output className="error-message">
          Failed to load models: {modelsError}
        </output>
      )}
      {isLoading && <output className="loading-message">Generating...</output>}
    </div>
  );
};
