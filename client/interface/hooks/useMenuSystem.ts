import { useState, useCallback } from "react";
import { MenuType } from "../types";
import type { ModelId } from "../../../server/apis/generation";
import { useModels } from "./useModels";

interface MenuParams {
  temperature: number;
  maxTokens: number;
  model: ModelId;
  generationCount: number;
}

interface MenuCallbacks {
  onNewTree?: () => void;
  onSelectTree?: (key: string) => void;
  onDeleteTree?: (key: string) => void;
  onExportData?: () => void;
  onImportData?: () => void;
  onModelAction?: (action: "add" | "edit" | "delete", modelId?: string) => void;
}

export function useMenuSystem(defaultParams: MenuParams) {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [selectedParam, setSelectedParam] = useState(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
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
            setSelectedParam((prev) => Math.min(6, prev + 1)); // Increased to 6 for import/export options
            break;
          case "Enter":
            if (selectedParam === 4) {
              // "Manage Models" selected
              setActiveMenu("models");
              setSelectedModelIndex(0);
            } else if (selectedParam === 5) {
              // "Export Data" selected
              callbacks.onExportData?.();
            } else if (selectedParam === 6) {
              // "Import Data" selected
              callbacks.onImportData?.();
            }
            break;
          case "ArrowLeft":
            const param = ["temperature", "maxTokens", "model", "generationCount"][selectedParam];
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
            } else if (param === "generationCount") {
              setMenuParams((prev) => ({
                ...prev,
                generationCount: Math.max(1, prev.generationCount - 1),
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
            }
            break;
          case "ArrowRight": {
            const param = ["temperature", "maxTokens", "model", "generationCount"][selectedParam];
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
            } else if (param === "generationCount") {
              setMenuParams((prev) => ({
                ...prev,
                generationCount: Math.min(10, prev.generationCount + 1),
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
            }
            break;
          }
        }
      } else if (activeMenu === "models") {
        const modelEntries = models ? Object.entries(models) : [];
        const totalItems = modelEntries.length + 1; // +1 for "Add New Model"

        switch (key) {
          case "ArrowUp":
            setSelectedModelIndex((prev) => Math.max(0, prev - 1));
            break;
          case "ArrowDown":
            setSelectedModelIndex((prev) => Math.min(totalItems - 1, prev + 1));
            break;
          case "Enter":
            // Handle model selection/editing
            if (selectedModelIndex === modelEntries.length) {
              // "Add New Model" selected
              callbacks.onModelAction?.("add");
            } else if (selectedModelIndex < modelEntries.length) {
              // Existing model selected
              const [modelId] = modelEntries[selectedModelIndex];
              callbacks.onModelAction?.("edit", modelId);
            }
            break;
          case "Backspace":
            // Handle model deletion
            if (selectedModelIndex < modelEntries.length) {
              const [modelId] = modelEntries[selectedModelIndex];
              callbacks.onModelAction?.("delete", modelId);
            }
            break;
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
      if (key === "Escape" || key === "m" || key === "M") {
        setActiveMenu(null);
      }
    },
    [activeMenu, selectedParam, selectedTreeIndex, selectedModelIndex, menuParams, models]
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
    menuParams,
    setMenuParams,
    handleMenuNavigation,
  };
}
