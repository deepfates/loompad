import { useState, useCallback } from "react";
import { MenuType } from "../types";

interface MenuParams {
  temperature: number;
  maxTokens: number;
  model: string;
}

export function useMenuSystem() {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [selectedParam, setSelectedParam] = useState(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
  const [menuParams, setMenuParams] = useState<MenuParams>({
    temperature: 0.7,
    maxTokens: 100,
    model: "mistral-7b",
  });

  const handleParamAdjustment = useCallback(
    (direction: string) => {
      setMenuParams((prev) => {
        const param =
          selectedParam === 0
            ? "temperature"
            : selectedParam === 1
            ? "maxTokens"
            : "model";

        if (param === "model") {
          const MODELS = ["mistral-7b", "llama-2-7b", "mixtral-8x7b"];
          const currentIndex = MODELS.indexOf(prev.model);
          const newIndex =
            direction === "ArrowLeft"
              ? Math.max(0, currentIndex - 1)
              : Math.min(MODELS.length - 1, currentIndex + 1);
          return { ...prev, model: MODELS[newIndex] };
        }

        const step = param === "temperature" ? 0.1 : 10;
        const min = param === "temperature" ? 0.1 : 10;
        const max = param === "temperature" ? 2.0 : 500;
        const decimalPlaces = step.toString().split(".")[1]?.length || 0;

        const newValue = Number(
          (direction === "ArrowLeft"
            ? Math.max(min, prev[param] - step)
            : Math.min(max, prev[param] + step)
          ).toFixed(decimalPlaces)
        );

        return {
          ...prev,
          [param]: newValue,
        };
      });
    },
    [selectedParam]
  );

  const handleMenuNavigation = useCallback(
    (key: string) => {
      if (!activeMenu) return;

      switch (key) {
        case "Backspace":
          setActiveMenu(null);
          setSelectedParam(0);
          setSelectedTreeIndex(0);
          break;
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
            setSelectedTreeIndex((prev) => prev + 1); // Max will be handled by parent
          }
          break;
        case "ArrowLeft":
        case "ArrowRight":
          if (activeMenu === "select") {
            handleParamAdjustment(key);
          }
          break;
      }
    },
    [activeMenu, handleParamAdjustment]
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
