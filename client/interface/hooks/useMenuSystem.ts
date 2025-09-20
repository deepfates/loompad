import { useState, useCallback } from "react";
import { MenuType } from "../types";
import type { ModelId } from "../../../shared/models";
import type { LengthMode } from "../../../shared/lengthPresets";
import { useModels } from "./useModels";
import { scrollMenuItemElIntoView } from "../utils/scrolling";
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

type Theme = "matrix" | "light" | "system";

interface MenuCallbacks {
  onNewTree?: () => void;
  onSelectTree?: (key: string) => void;
  onDeleteTree?: (key: string) => void;
  // Settings menu (theme)
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

// Story ordering and active tracking handled by utils/storyMeta

export function useMenuSystem(defaultParams: MenuParams) {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [selectedParam, setSelectedParam] = useState(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
  const [menuParams, setMenuParams] = useState<MenuParams>(defaultParams);
  const { models } = useModels();
  const lengthModes: LengthMode[] = ["word", "sentence", "paragraph", "page"];

  const handleMenuNavigation = useCallback(
    (
      key: string,
      trees: { [key: string]: any } = {},
      callbacks: MenuCallbacks = {},
    ) => {
      if (activeMenu === "select") {
        switch (key) {
          case "ArrowUp":
            setSelectedParam((prev) => {
              const count = 5; // number of settings items
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
              const count = 5;
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
            const param = [
              "temperature",
              "lengthMode",
              "model",
              "theme",
              "textSplitting",
            ][selectedParam];
            if (param === "temperature") {
              setMenuParams((prev) => ({
                ...prev,
                temperature: Math.max(0.1, prev.temperature - 0.1),
              }));
            } else if (param === "lengthMode") {
              setMenuParams((prev) => {
                const index = lengthModes.indexOf(prev.lengthMode);
                const nextIndex = (index - 1 + lengthModes.length) % lengthModes.length;
                return {
                  ...prev,
                  lengthMode: lengthModes[nextIndex],
                };
              });
            } else if (param === "model" && models) {
              const modelIds = Object.keys(models) as ModelId[];
              const currentIndex = modelIds.indexOf(menuParams.model);
              if (currentIndex > 0) {
                const newModel = modelIds[currentIndex - 1];
                setMenuParams((prev) => ({
                  ...prev,
                  model: newModel,
                }));
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
            const param = [
              "temperature",
              "lengthMode",
              "model",
              "theme",
              "textSplitting",
            ][selectedParam];
            if (param === "temperature") {
              setMenuParams((prev) => ({
                ...prev,
                temperature: Math.min(2.0, prev.temperature + 0.1),
              }));
            } else if (param === "lengthMode") {
              setMenuParams((prev) => {
                const index = lengthModes.indexOf(prev.lengthMode);
                const nextIndex = (index + 1) % lengthModes.length;
                return {
                  ...prev,
                  lengthMode: lengthModes[nextIndex],
                };
              });
            } else if (param === "model" && models) {
              const modelIds = Object.keys(models) as ModelId[];
              const currentIndex = modelIds.indexOf(menuParams.model);
              if (currentIndex < modelIds.length - 1) {
                const newModel = modelIds[currentIndex + 1];
                setMenuParams((prev) => ({
                  ...prev,
                  model: newModel,
                }));
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
            const param = [
              "temperature",
              "lengthMode",
              "model",
              "theme",
              "textSplitting",
            ][selectedParam];
            if (param === "model" && models) {
              const modelIds = Object.keys(models) as ModelId[];
              const currentIndex = modelIds.indexOf(menuParams.model);
              const newModel = modelIds[(currentIndex + 1) % modelIds.length];
              setMenuParams((prev) => ({
                ...prev,
                model: newModel,
              }));
            } else if (param === "lengthMode") {
              setMenuParams((prev) => ({
                ...prev,
                lengthMode:
                  lengthModes[(lengthModes.indexOf(prev.lengthMode) + 1) % lengthModes.length],
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
      }

      // Global menu controls (Enter closes non-settings menus)
      if (key === "Enter" && activeMenu !== "select") {
        setActiveMenu(null);
      }
    },
    [
      activeMenu,
      selectedParam,
      selectedTreeIndex,
      menuParams,
      models,
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
    menuParams,
    setMenuParams,
    handleMenuNavigation,
  };
}
