import { useState, useCallback } from "react";
import { MenuType } from "../types";
import type { ModelId } from "../../../shared/models";
import type { LengthMode } from "../../../shared/lengthPresets";
import { scrollMenuItemElIntoView } from "../utils/scrolling";
import type { Theme } from "../components/ThemeToggle";
import {
  orderKeysReverseChronological,
  touchStoryActive,
} from "../utils/storyMeta";

interface MenuParams {
  temperature: number;
  lengthMode: LengthMode;
  model: ModelId;
  textSplitting: boolean;
}

interface MenuCallbacks {
  onNewTree?: () => void;
  onSelectTree?: (key: string) => void;
  onDeleteTree?: (key: string) => void;
  // Settings menu (theme)
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
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
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedModelField, setSelectedModelField] = useState(0);
  const [menuParams, setMenuParams] = useState<MenuParams>(defaultParams);
  const lengthModes: LengthMode[] = ["word", "sentence", "paragraph", "page"];
  const cycleLengthMode = (current: LengthMode, delta: number): LengthMode => {
    const index = lengthModes.indexOf(current);
    const nextIndex = (index + delta + lengthModes.length) % lengthModes.length;
    return lengthModes[nextIndex];
  };

  const handleMenuNavigation = useCallback(
    (
      key: string,
      trees: Record<string, unknown> = {},
      callbacks: MenuCallbacks = {},
    ) => {
      if (activeMenu === "select") {
        const params: (
          | "temperature"
          | "lengthMode"
          | "model"
          | "theme"
          | "textSplitting"
          | "manageModels"
        )[] = [
          "temperature",
          "lengthMode",
          "model",
          "theme",
          "textSplitting",
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
            } else if (param === "theme") {
              const themes: Theme[] = ["matrix", "light", "system"];
              const currentTheme = callbacks.currentTheme ?? "system";
              const idx = themes.indexOf(currentTheme);
              const nextTheme =
                themes[(idx - 1 + themes.length) % themes.length];
              callbacks.onThemeChange?.(nextTheme);
            } else if (param === "textSplitting") {
              setMenuParams((prev) => ({
                ...prev,
                textSplitting: !prev.textSplitting,
              }));
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
            } else if (param === "theme") {
              const themes: Theme[] = ["matrix", "light", "system"];
              const currentTheme = callbacks.currentTheme ?? "system";
              const idx = themes.indexOf(currentTheme);
              const nextTheme = themes[(idx + 1) % themes.length];
              callbacks.onThemeChange?.(nextTheme);
            } else if (param === "textSplitting") {
              setMenuParams((prev) => ({
                ...prev,
                textSplitting: !prev.textSplitting,
              }));
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
                const nextIndex = currentIndex >= 0
                  ? (currentIndex + 1) % modelIds.length
                  : 0;
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
            } else if (param === "theme") {
              const themes: Theme[] = ["matrix", "light", "system"];
              const currentTheme = callbacks.currentTheme ?? "system";
              const idx = themes.indexOf(currentTheme);
              const nextTheme = themes[(idx + 1) % themes.length];
              callbacks.onThemeChange?.(nextTheme);
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
              return newIndex;
            });
            break;
          case "Enter": // A button
            if (selectedTreeIndex === 0) {
              callbacks.onNewTree?.();
            } else {
              const treeKey = orderedKeys[selectedTreeIndex - 1];
              touchStoryActive(treeKey);
              callbacks.onSelectTree?.(treeKey);
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
      selectedModelIndex,
      selectedModelField,
      menuParams,
      scrollMenuItemElIntoView,
    ],
  );

  return {
    activeMenu,
    setActiveMenu,
    selectedParam,
    setSelectedParam,
    selectedTreeIndex,
    setSelectedTreeIndex,
    selectedModelIndex,
    setSelectedModelIndex,
    selectedModelField,
    setSelectedModelField,
    menuParams,
    setMenuParams,
    handleMenuNavigation,
  };
}
