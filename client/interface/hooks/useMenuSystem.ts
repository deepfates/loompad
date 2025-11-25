import { useState, useCallback } from "react";
import { MenuType } from "../types";
import type { ModelId } from "../../../shared/models";
import type { LengthMode } from "../../../shared/lengthPresets";
import { scrollMenuItemElIntoView } from "../utils/scrolling";
import {
  THEME_PRESETS,
  type ThemeClass,
  type ThemeMode,
  type FontOption,
} from "../components/ThemeToggle";
import {
  orderKeysReverseChronological,
  touchStoryActive,
} from "../utils/storyMeta";

interface MenuParams {
  temperature: number;
  lengthMode: LengthMode;
  model: ModelId;
  textSplitting: boolean;
  autoModeIterations: number;
}

interface MenuCallbacks {
  onNewTree?: () => void;
  onSelectTree?: (key: string) => void;
  onDeleteTree?: (key: string) => void;
  onExportTreeJson?: (key: string) => void;
  onExportTreeThread?: (key: string) => void;
  // Settings menu (themes)
  currentThemeMode?: ThemeMode;
  currentLightTheme?: ThemeClass;
  currentDarkTheme?: ThemeClass;
  onThemeModeChange?: (mode: ThemeMode) => void;
  onLightThemeChange?: (theme: ThemeClass) => void;
  onDarkThemeChange?: (theme: ThemeClass) => void;
  currentFont?: FontOption;
  onFontChange?: (font: FontOption) => void;
  fontOptions?: FontOption[];
  onManageModels?: () => void;
  modelOrder?: ModelId[];
  onNewModel?: () => void;
  onEditModel?: (modelId: ModelId) => void;
  onDeleteModel?: (modelId: ModelId) => void;
  onToggleModelSort?: (delta: -1 | 1) => void;
  modelEditorFields?: string[];
  onModelEditorEnter?: (field: string) => void;
  onModelEditorAdjust?: (field: string, delta: number) => void;
  onModelEditorBack?: () => void;
  onModelEditorHighlight?: (field: string) => void;
}

// Story ordering and active tracking handled by utils/storyMeta

export function useMenuSystem(defaultParams: MenuParams) {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [selectedParam, setSelectedParam] = useState(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
  const [selectedTreeColumn, setSelectedTreeColumn] = useState(0);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedModelField, setSelectedModelField] = useState(0);
  const [menuParams, setMenuParams] = useState<MenuParams>(defaultParams);
  const lengthModes: LengthMode[] = ["word", "sentence", "paragraph", "page"];
  const themeModes: ThemeMode[] = ["light", "dark", "system"];
  const themeOptions = THEME_PRESETS.map((preset) => preset.id);
  const lightThemeOptions = THEME_PRESETS.filter(
    (preset) => preset.tone === "light"
  ).map((preset) => preset.id);
  const darkThemeOptions = THEME_PRESETS.filter(
    (preset) => preset.tone === "dark"
  ).map((preset) => preset.id);
  const cycleOption = <T>(
    list: T[],
    current: T | undefined,
    delta: number
  ): T => {
    if (!list.length) {
      throw new Error("cycleOption requires at least one option");
    }
    const idx = current ? list.indexOf(current) : -1;
    const normalized = idx === -1 ? 0 : idx;
    const nextIndex = (normalized + delta + list.length) % list.length;
    return list[nextIndex];
  };

  const cycleLengthMode = (current: LengthMode, delta: number): LengthMode => {
    const index = lengthModes.indexOf(current);
    const nextIndex = (index + delta + lengthModes.length) % lengthModes.length;
    return lengthModes[nextIndex];
  };

  const cycleThemeClass = (
    current: ThemeClass | undefined,
    delta: number,
    options: ThemeClass[] = themeOptions
  ): ThemeClass => {
    const list = options.length ? options : themeOptions;
    const currentIndex = current ? list.indexOf(current) : 0;
    const fallbackIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (fallbackIndex + delta + list.length) % list.length;
    return list[nextIndex] ?? themeOptions[0];
  };

  const handleMenuNavigation = useCallback(
    (
      key: string,
      trees: Record<string, unknown> = {},
      callbacks: MenuCallbacks = {}
    ) => {
      if (activeMenu === "select") {
        const params: (
          | "temperature"
          | "lengthMode"
          | "model"
          | "themeMode"
          | "lightTheme"
          | "darkTheme"
          | "font"
          | "textSplitting"
          | "autoModeIterations"
          | "manageModels"
        )[] = [
          "temperature",
          "lengthMode",
          "model",
          "themeMode",
          "lightTheme",
          "darkTheme",
          "font",
          "textSplitting",
          "autoModeIterations",
          "manageModels",
        ];

        switch (key) {
          case "ArrowUp":
            setSelectedParam((prev) => {
              const count = params.length;
              const newIndex = (prev - 1 + count) % count;
              const menuContent = document.querySelector(".menu-content");
              if (menuContent) {
                const container = menuContent as HTMLElement;
                const items = container.querySelectorAll(".menu-item");
                const el = items[newIndex] as HTMLElement | null;
                if (el) {
                  scrollMenuItemElIntoView(container, el);
                }
              }
              return newIndex;
            });
            break;
          case "ArrowDown":
            setSelectedParam((prev) => {
              const count = params.length;
              const newIndex = (prev + 1) % count;
              const menuContent = document.querySelector(".menu-content");
              if (menuContent) {
                const container = menuContent as HTMLElement;
                const items = container.querySelectorAll(".menu-item");
                const el = items[newIndex] as HTMLElement | null;
                if (el) {
                  scrollMenuItemElIntoView(container, el);
                }
              }
              return newIndex;
            });
            break;
          case "ArrowLeft": {
            const param = params[selectedParam];
            if (param === "temperature") {
              setMenuParams((prev) => ({
                ...prev,
                temperature: Math.max(0.1, prev.temperature - 0.1),
              }));
            } else if (param === "lengthMode") {
              setMenuParams((prev) => ({
                ...prev,
                lengthMode: cycleLengthMode(prev.lengthMode, -1),
              }));
            } else if (param === "model") {
              const modelIds = callbacks.modelOrder ?? [];
              if (modelIds.length) {
                const currentIndex = modelIds.indexOf(menuParams.model);
                if (currentIndex > 0) {
                  const newModel = modelIds[currentIndex - 1];
                  setMenuParams((prev) => ({
                    ...prev,
                    model: newModel,
                  }));
                } else if (currentIndex === -1) {
                  const fallback = modelIds[0];
                  if (fallback) {
                    setMenuParams((prev) => ({
                      ...prev,
                      model: fallback,
                    }));
                  }
                }
              }
            } else if (param === "themeMode") {
              const currentMode = callbacks.currentThemeMode ?? "system";
              const idx = themeModes.indexOf(currentMode);
              const nextMode =
                themeModes[(idx - 1 + themeModes.length) % themeModes.length];
              callbacks.onThemeModeChange?.(nextMode);
            } else if (param === "lightTheme") {
              const nextTheme = cycleThemeClass(
                callbacks.currentLightTheme,
                -1,
                lightThemeOptions
              );
              callbacks.onLightThemeChange?.(nextTheme);
            } else if (param === "darkTheme") {
              const nextTheme = cycleThemeClass(
                callbacks.currentDarkTheme,
                -1,
                darkThemeOptions
              );
              callbacks.onDarkThemeChange?.(nextTheme);
            } else if (param === "font") {
              const options = callbacks.fontOptions ?? [];
              if (options.length) {
                const nextFont = cycleOption(
                  options,
                  callbacks.currentFont,
                  -1
                );
                callbacks.onFontChange?.(nextFont);
              }
            } else if (param === "textSplitting") {
              setMenuParams((prev) => ({
                ...prev,
                textSplitting: !prev.textSplitting,
              }));
            } else if (param === "autoModeIterations") {
              setMenuParams((prev) => ({
                ...prev,
                autoModeIterations: Math.max(0, prev.autoModeIterations - 1),
              }));
            } else if (param === "manageModels") {
              callbacks.onManageModels?.();
            }
            break;
          }
          case "ArrowRight": {
            const param = params[selectedParam];
            if (param === "temperature") {
              setMenuParams((prev) => ({
                ...prev,
                temperature: Math.min(2.0, prev.temperature + 0.1),
              }));
            } else if (param === "lengthMode") {
              setMenuParams((prev) => ({
                ...prev,
                lengthMode: cycleLengthMode(prev.lengthMode, +1),
              }));
            } else if (param === "model") {
              const modelIds = callbacks.modelOrder ?? [];
              if (modelIds.length) {
                const currentIndex = modelIds.indexOf(menuParams.model);
                if (currentIndex >= 0 && currentIndex < modelIds.length - 1) {
                  const newModel = modelIds[currentIndex + 1];
                  setMenuParams((prev) => ({
                    ...prev,
                    model: newModel,
                  }));
                } else if (currentIndex === -1) {
                  const fallback = modelIds[0];
                  if (fallback) {
                    setMenuParams((prev) => ({
                      ...prev,
                      model: fallback,
                    }));
                  }
                }
              }
            } else if (param === "themeMode") {
              const currentMode = callbacks.currentThemeMode ?? "system";
              const idx = themeModes.indexOf(currentMode);
              const nextMode = themeModes[(idx + 1) % themeModes.length];
              callbacks.onThemeModeChange?.(nextMode);
            } else if (param === "lightTheme") {
              const nextTheme = cycleThemeClass(
                callbacks.currentLightTheme,
                +1,
                lightThemeOptions
              );
              callbacks.onLightThemeChange?.(nextTheme);
            } else if (param === "darkTheme") {
              const nextTheme = cycleThemeClass(
                callbacks.currentDarkTheme,
                +1,
                darkThemeOptions
              );
              callbacks.onDarkThemeChange?.(nextTheme);
            } else if (param === "font") {
              const options = callbacks.fontOptions ?? [];
              if (options.length) {
                const nextFont = cycleOption(
                  options,
                  callbacks.currentFont,
                  +1
                );
                callbacks.onFontChange?.(nextFont);
              }
            } else if (param === "textSplitting") {
              setMenuParams((prev) => ({
                ...prev,
                textSplitting: !prev.textSplitting,
              }));
            } else if (param === "autoModeIterations") {
              setMenuParams((prev) => ({
                ...prev,
                autoModeIterations: Math.min(3, prev.autoModeIterations + 1),
              }));
            } else if (param === "manageModels") {
              callbacks.onManageModels?.();
            }
            break;
          }
          case "Enter": {
            // Enter acts on cyclers/toggles in Settings
            const param = params[selectedParam];
            if (param === "model") {
              const modelIds = callbacks.modelOrder ?? [];
              if (modelIds.length) {
                const currentIndex = modelIds.indexOf(menuParams.model);
                const nextIndex =
                  currentIndex >= 0 ? (currentIndex + 1) % modelIds.length : 0;
                const newModel = modelIds[nextIndex];
                if (newModel) {
                  setMenuParams((prev) => ({
                    ...prev,
                    model: newModel,
                  }));
                }
              }
            } else if (param === "manageModels") {
              callbacks.onManageModels?.();
            } else if (param === "lengthMode") {
              setMenuParams((prev) => ({
                ...prev,
                lengthMode: cycleLengthMode(prev.lengthMode, +1),
              }));
            } else if (param === "themeMode") {
              const currentMode = callbacks.currentThemeMode ?? "system";
              const idx = themeModes.indexOf(currentMode);
              const nextMode = themeModes[(idx + 1) % themeModes.length];
              callbacks.onThemeModeChange?.(nextMode);
            } else if (param === "lightTheme") {
              const nextTheme = cycleThemeClass(
                callbacks.currentLightTheme,
                +1,
                lightThemeOptions
              );
              callbacks.onLightThemeChange?.(nextTheme);
            } else if (param === "darkTheme") {
              const nextTheme = cycleThemeClass(
                callbacks.currentDarkTheme,
                +1,
                darkThemeOptions
              );
              callbacks.onDarkThemeChange?.(nextTheme);
            } else if (param === "font") {
              const options = callbacks.fontOptions ?? [];
              if (options.length) {
                const nextFont = cycleOption(
                  options,
                  callbacks.currentFont,
                  +1
                );
                callbacks.onFontChange?.(nextFont);
              }
            } else if (param === "textSplitting") {
              setMenuParams((prev) => ({
                ...prev,
                textSplitting: !prev.textSplitting,
              }));
            }
            break;
          }
          case "Escape":
            // START closes settings
            setActiveMenu(null);
            break;
        }
      } else if (activeMenu === "start") {
        const orderedKeys = orderKeysReverseChronological(trees);
        const totalItems = orderedKeys.length + 1; // +1 for New Story
        const columnTypes: Array<"story" | "json" | "thread"> = ["story"];
        if (callbacks.onExportTreeJson) {
          columnTypes.push("json");
        }
        if (callbacks.onExportTreeThread) {
          columnTypes.push("thread");
        }

        const getMaxColumnForIndex = (index: number) => {
          if (index === 0) return 0;
          return columnTypes.length - 1;
        };

        switch (key) {
          case "ArrowUp":
            setSelectedTreeIndex((prev) => {
              const newIndex = (prev - 1 + totalItems) % totalItems;
              // Scroll menu item into view
              const menuContent = document.querySelector(".menu-content");
              if (menuContent) {
                const container = menuContent as HTMLElement;
                const items = container.querySelectorAll(".menu-item");
                const el = items[newIndex] as HTMLElement | null;
                if (el) {
                  scrollMenuItemElIntoView(container, el);
                }
              }
              setSelectedTreeColumn((column) =>
                Math.min(column, getMaxColumnForIndex(newIndex))
              );
              return newIndex;
            });
            break;
          case "ArrowDown":
            setSelectedTreeIndex((prev) => {
              const newIndex = (prev + 1) % totalItems;
              // Scroll menu item into view
              const menuContent = document.querySelector(".menu-content");
              if (menuContent) {
                const container = menuContent as HTMLElement;
                const items = container.querySelectorAll(".menu-item");
                const el = items[newIndex] as HTMLElement | null;
                if (el) {
                  scrollMenuItemElIntoView(container, el);
                }
              }
              setSelectedTreeColumn((column) =>
                Math.min(column, getMaxColumnForIndex(newIndex))
              );
              return newIndex;
            });
            break;
          case "ArrowLeft":
            setSelectedTreeColumn((prev) => Math.max(0, prev - 1));
            break;
          case "ArrowRight":
            setSelectedTreeColumn((prev) => {
              const maxColumn = getMaxColumnForIndex(selectedTreeIndex);
              return Math.min(maxColumn, prev + 1);
            });
            break;
          case "Enter": // A button
            if (selectedTreeIndex === 0) {
              callbacks.onNewTree?.();
            } else if (selectedTreeColumn === 0) {
              const treeKey = orderedKeys[selectedTreeIndex - 1];
              touchStoryActive(treeKey);
              callbacks.onSelectTree?.(treeKey);
            } else {
              const treeKey = orderedKeys[selectedTreeIndex - 1];
              const columnType = columnTypes[selectedTreeColumn];
              if (columnType === "json") {
                callbacks.onExportTreeJson?.(treeKey);
              } else if (columnType === "thread") {
                callbacks.onExportTreeThread?.(treeKey);
              }
              return;
            }
            break;
          case "Backspace": // B button
            if (selectedTreeIndex > 0 && orderedKeys.length > 1) {
              const treeKey = orderedKeys[selectedTreeIndex - 1];
              callbacks.onDeleteTree?.(treeKey);
            }
            break;
        }
      } else if (activeMenu === "models") {
        const modelIds = callbacks.modelOrder ?? [];
        const hasSortRow = Boolean(callbacks.onToggleModelSort);
        const baseOffset = hasSortRow ? 2 : 1;
        const totalItems = modelIds.length + baseOffset;

        switch (key) {
          case "ArrowUp":
            setSelectedModelIndex((prev) => {
              const newIndex = (prev - 1 + totalItems) % totalItems;
              const menuContent = document.querySelector(".menu-content");
              if (menuContent) {
                const container = menuContent as HTMLElement;
                const items = container.querySelectorAll(".menu-item");
                const el = items[newIndex] as HTMLElement | null;
                if (el) {
                  scrollMenuItemElIntoView(container, el);
                }
              }
              return newIndex;
            });
            break;
          case "ArrowDown":
            setSelectedModelIndex((prev) => {
              const newIndex = (prev + 1) % totalItems;
              const menuContent = document.querySelector(".menu-content");
              if (menuContent) {
                const container = menuContent as HTMLElement;
                const items = container.querySelectorAll(".menu-item");
                const el = items[newIndex] as HTMLElement | null;
                if (el) {
                  scrollMenuItemElIntoView(container, el);
                }
              }
              return newIndex;
            });
            break;
          case "ArrowLeft":
            if (hasSortRow && selectedModelIndex === 0) {
              callbacks.onToggleModelSort?.(-1);
            }
            break;
          case "ArrowRight":
            if (hasSortRow && selectedModelIndex === 0) {
              callbacks.onToggleModelSort?.(1);
            }
            break;
          case "Enter":
            if (hasSortRow && selectedModelIndex === 0) {
              callbacks.onToggleModelSort?.(1);
            } else if (selectedModelIndex === (hasSortRow ? 1 : 0)) {
              callbacks.onNewModel?.();
            } else {
              const modelId = modelIds[selectedModelIndex - baseOffset];
              if (modelId) {
                callbacks.onEditModel?.(modelId);
              }
            }
            break;
          case "Backspace":
            if (selectedModelIndex >= baseOffset) {
              const modelId = modelIds[selectedModelIndex - baseOffset];
              if (modelId) {
                callbacks.onDeleteModel?.(modelId);
              }
            }
            break;
          case "`":
            if (hasSortRow && selectedModelIndex === 0) {
              callbacks.onToggleModelSort?.(1);
            }
            break;
        }
      } else if (activeMenu === "model-editor") {
        const fields = callbacks.modelEditorFields ?? [];
        const totalItems = fields.length;

        if (!totalItems) {
          return;
        }

        switch (key) {
          case "ArrowUp":
            setSelectedModelField((prev) => {
              const newIndex = (prev - 1 + totalItems) % totalItems;
              callbacks.onModelEditorHighlight?.(fields[newIndex]);
              return newIndex;
            });
            break;
          case "ArrowDown":
            setSelectedModelField((prev) => {
              const newIndex = (prev + 1) % totalItems;
              callbacks.onModelEditorHighlight?.(fields[newIndex]);
              return newIndex;
            });
            break;
          case "ArrowLeft":
            {
              const fieldKey = fields[selectedModelField];
              if (fieldKey) {
                callbacks.onModelEditorAdjust?.(fieldKey, -1);
              }
            }
            break;
          case "ArrowRight":
            {
              const fieldKey = fields[selectedModelField];
              if (fieldKey) {
                callbacks.onModelEditorAdjust?.(fieldKey, 1);
              }
            }
            break;
          case "Enter":
            {
              const fieldKey = fields[selectedModelField];
              if (fieldKey) {
                callbacks.onModelEditorEnter?.(fieldKey);
              }
            }
            break;
          case "Backspace":
            callbacks.onModelEditorBack?.();
            break;
        }
      }

      // Global menu controls (Enter closes non-settings menus)
      if (
        key === "Enter" &&
        activeMenu !== "select" &&
        activeMenu !== "models" &&
        activeMenu !== "model-editor"
      ) {
        setActiveMenu(null);
      }
    },
    [
      activeMenu,
      selectedParam,
      selectedTreeIndex,
      selectedTreeColumn,
      selectedModelIndex,
      selectedModelField,
      menuParams,
      scrollMenuItemElIntoView,
    ]
  );

  return {
    activeMenu,
    setActiveMenu,
    selectedParam,
    setSelectedParam,
    selectedTreeIndex,
    setSelectedTreeIndex,
    selectedTreeColumn,
    setSelectedTreeColumn,
    selectedModelIndex,
    setSelectedModelIndex,
    selectedModelField,
    setSelectedModelField,
    menuParams,
    setMenuParams,
    handleMenuNavigation,
  };
}
