import { SettingsMenuProps } from "../types";
import { Row } from "../components/Row";
import type { ModelId } from "../../../shared/models";
import { LENGTH_PRESETS, type LengthMode } from "../../../shared/lengthPresets";
import { THEME_PRESETS } from "../components/ThemeToggle";

const LENGTH_MODES: LengthMode[] = ["word", "sentence", "paragraph", "page"];
const THEME_MODE_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} as const;

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
  const modelOptions = models ? (Object.keys(models) as ModelId[]) : [];
  const isModelsLoading = modelsLoading && !models;

  const cycle = <T,>(list: T[], current: T, delta: 1 | -1): T => {
    if (!list.length) return current;
    const idx = list.indexOf(current);
    const next = ((idx === -1 ? 0 : idx) + delta + list.length) % list.length;
    return list[next];
  };

  const lightThemes = THEME_PRESETS.filter((p) => p.tone === "light");
  const darkThemes = THEME_PRESETS.filter((p) => p.tone === "dark");
  const themeLabel = (id: string) =>
    THEME_PRESETS.find((p) => p.id === id)?.label ?? id;
  const fontLabel = (id: string) =>
    fonts.find((f) => f.id === id)?.label ?? id;

  return (
    <div className="menu-content">
      <Row
        kind="knob"
        label="Temperature"
        value={params.temperature}
        min={0.1}
        max={2.0}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        selected={selectedParam === 0}
        onActivate={() =>
          onParamChange(
            "temperature",
            Math.min(2.0, Math.round((params.temperature + 0.1) * 10) / 10),
          )
        }
        onSetValue={(v) =>
          onParamChange(
            "temperature",
            Math.round(v * 10) / 10,
          )
        }
      />
      <Row
        kind="pick"
        label="Length"
        value={LENGTH_PRESETS[params.lengthMode].label}
        selected={selectedParam === 1}
        onActivate={() =>
          onParamChange("lengthMode", cycle(LENGTH_MODES, params.lengthMode, 1))
        }
      />
      <Row
        kind="pick"
        label={`Model${isModelsLoading ? " (loading…)" : ""}`}
        value={getModelName(params.model)}
        selected={selectedParam === 2}
        onActivate={() => {
          if (!modelOptions.length) return;
          onParamChange("model", cycle(modelOptions, params.model, 1));
        }}
      />
      <Row
        kind="pick"
        label="Theme Mode"
        value={THEME_MODE_LABELS[params.themeMode]}
        selected={selectedParam === 3}
        onActivate={() => {
          const modes = ["light", "dark", "system"] as const;
          onParamChange("themeMode", cycle(modes as unknown as string[], params.themeMode, 1));
        }}
      />
      <Row
        kind="pick"
        label="Light Theme"
        value={themeLabel(params.lightTheme)}
        selected={selectedParam === 4}
        onActivate={() => {
          const ids = lightThemes.map((p) => p.id);
          onParamChange("lightTheme", cycle(ids, params.lightTheme, 1));
        }}
      />
      <Row
        kind="pick"
        label="Dark Theme"
        value={themeLabel(params.darkTheme)}
        selected={selectedParam === 5}
        onActivate={() => {
          const ids = darkThemes.map((p) => p.id);
          onParamChange("darkTheme", cycle(ids, params.darkTheme, 1));
        }}
      />
      <Row
        kind="pick"
        label="Font"
        value={fontLabel(params.font)}
        selected={selectedParam === 6}
        onActivate={() => {
          const ids = fonts.map((f) => f.id);
          onParamChange("font", cycle(ids, params.font, 1));
        }}
      />
      <Row
        kind="toggle"
        label="Text Splitting"
        value={params.textSplitting}
        selected={selectedParam === 7}
        onActivate={() => onParamChange("textSplitting", !params.textSplitting)}
      />
      <Row
        kind="knob"
        label="Auto Mode"
        value={params.autoModeIterations}
        min={0}
        max={4}
        step={1}
        formatValue={(v) => (v >= 4 ? "∞" : String(v))}
        selected={selectedParam === 8}
        onActivate={() =>
          onParamChange(
            "autoModeIterations",
            Math.min(4, params.autoModeIterations + 1),
          )
        }
        onSetValue={(v) =>
          onParamChange("autoModeIterations", Math.round(v))
        }
      />
      <Row
        kind="action"
        label="Manage Models"
        glyph="→"
        selected={selectedParam === 9}
        onActivate={() => onManageModels?.()}
      />
      {modelsError && (
        <output className="error-message">
          Failed to load models: {modelsError}
        </output>
      )}
      {isLoading && <output className="loading-message">Generating…</output>}
    </div>
  );
};
