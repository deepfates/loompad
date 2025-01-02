import { useState, useCallback } from "react";
import { MenuType } from "../types";
import type { ModelId } from "../../../server/apis/generation";
import { useModels } from "./useModels";

interface MenuParams {
  temperature: number;
  maxTokens: number;
  model: ModelId;
}

export function useMenuSystem(defaultParams: MenuParams) {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [selectedParam, setSelectedParam] = useState(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
  const [menuParams, setMenuParams] = useState<MenuParams>(defaultParams);
  const { models } = useModels();

  const handleMenuNavigation = useCallback(
    (key: string) => {
      switch (key) {
        case "ArrowUp":
          if (activeMenu === "select") {
            setSelectedParam((prev) => Math.max(0, prev - 1));
          } else if (activeMenu === "start") {
            setSelectedTreeIndex((prev) => Math.max(0, prev - 1));
          }
          break;
        case "ArrowDown":
          if (activeMenu === "select") {
            setSelectedParam((prev) => Math.min(2, prev + 1));
          } else if (activeMenu === "start") {
            setSelectedTreeIndex((prev) => prev + 1);
          }
          break;
        case "ArrowLeft":
          if (activeMenu === "select") {
            const param = ["temperature", "maxTokens", "model"][selectedParam];
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
            }
          }
          break;
        case "ArrowRight":
          if (activeMenu === "select") {
            const param = ["temperature", "maxTokens", "model"][selectedParam];
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
            }
          }
          break;
        case "Enter":
          if (activeMenu === "select" || activeMenu === "start") {
            setActiveMenu(null);
          }
          break;
        case "Escape":
          setActiveMenu(null);
          break;
      }
    },
    [activeMenu, selectedParam, menuParams, models]
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
