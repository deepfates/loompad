import { useState, useCallback } from "react";
import { MenuType } from "../types";
import type { ModelId } from "../../../server/apis/generation";
import { useModels } from "./useModels";

interface MenuParams {
  temperature: number;
  maxTokens: number;
  model: ModelId;
  textSplitting: boolean;
}

interface MenuCallbacks {
  onNewTree?: () => void;
  onSelectTree?: (key: string) => void;
  onDeleteTree?: (key: string) => void;
}

export function useMenuSystem(defaultParams: MenuParams) {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [selectedParam, setSelectedParam] = useState(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
  const [menuParams, setMenuParams] = useState<MenuParams>(defaultParams);
  const { models } = useModels();

  const handleMenuNavigation = useCallback(
    (
      key: string,
      trees: { [key: string]: any } = {},
      callbacks: MenuCallbacks = {}
    ) => {
      if (activeMenu === "select") {
        switch (key) {
          case "ArrowUp":
            setSelectedParam((prev) => Math.max(0, prev - 1));
            break;
          case "ArrowDown":
            setSelectedParam((prev) => Math.min(3, prev + 1));
            break;
          case "ArrowLeft": {
            const param = ["temperature", "maxTokens", "model", "textSplitting"][selectedParam];
            if (param === "temperature") {
              setMenuParams((prev) => ({
                ...prev,
                temperature: Math.max(0.1, prev.temperature - 0.1),
              }));
            } else if (param === "maxTokens") {
              setMenuParams((prev) => ({
                ...prev,
                maxTokens: Math.max(10, prev.maxTokens - 10),
              }));
            } else if (param === "model" && models) {
              const modelIds = Object.keys(models) as ModelId[];
              const currentIndex = modelIds.indexOf(menuParams.model);
              if (currentIndex > 0) {
                const newModel = modelIds[currentIndex - 1];
                setMenuParams((prev) => ({
                  ...prev,
                  model: newModel,
                  maxTokens: Math.min(
                    prev.maxTokens,
                    models[newModel].maxTokens
                  ),
                }));
              }
            } else if (param === "textSplitting") {
              setMenuParams((prev) => ({
                ...prev,
                textSplitting: !prev.textSplitting,
              }));
            }
            break;
          }
          case "ArrowRight": {
            const param = ["temperature", "maxTokens", "model", "textSplitting"][selectedParam];
            if (param === "temperature") {
              setMenuParams((prev) => ({
                ...prev,
                temperature: Math.min(2.0, prev.temperature + 0.1),
              }));
            } else if (param === "maxTokens") {
              setMenuParams((prev) => ({
                ...prev,
                maxTokens: Math.min(500, prev.maxTokens + 10),
              }));
            } else if (param === "model" && models) {
              const modelIds = Object.keys(models) as ModelId[];
              const currentIndex = modelIds.indexOf(menuParams.model);
              if (currentIndex < modelIds.length - 1) {
                const newModel = modelIds[currentIndex + 1];
                setMenuParams((prev) => ({
                  ...prev,
                  model: newModel,
                  maxTokens: Math.min(
                    prev.maxTokens,
                    models[newModel].maxTokens
                  ),
                }));
              }
            } else if (param === "textSplitting") {
              setMenuParams((prev) => ({
                ...prev,
                textSplitting: !prev.textSplitting,
              }));
            }
            break;
          }
        }
      } else if (activeMenu === "start") {
        const totalItems = Object.keys(trees).length + 1; // +1 for New Story

        switch (key) {
          case "ArrowUp":
            setSelectedTreeIndex((prev) => Math.max(0, prev - 1));
            break;
          case "ArrowDown":
            setSelectedTreeIndex((prev) => Math.min(totalItems - 1, prev + 1));
            break;
          case "Enter": // A button
            if (selectedTreeIndex === 0) {
              callbacks.onNewTree?.();
            } else {
              const treeKey = Object.keys(trees)[selectedTreeIndex - 1];
              callbacks.onSelectTree?.(treeKey);
            }
            break;
          case "Backspace": // B button
            if (selectedTreeIndex > 0 && Object.keys(trees).length > 1) {
              const treeKey = Object.keys(trees)[selectedTreeIndex - 1];
              callbacks.onDeleteTree?.(treeKey);
            }
            break;
        }
      }

      // Global menu controls
      if (key === "Escape" || key === "Enter") {
        setActiveMenu(null);
      }
    },
    [activeMenu, selectedParam, selectedTreeIndex, menuParams, models]
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
