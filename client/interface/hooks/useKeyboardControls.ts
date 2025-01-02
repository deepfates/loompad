import { useState, useCallback, useEffect } from "react";
import { ActiveControls } from "../types";

export function useKeyboardControls(
  onAction?: (key: string) => Promise<void> | void
) {
  const [activeControls, setActiveControls] = useState<ActiveControls>({
    direction: null,
    a: false,
    b: false,
    select: false,
    start: false,
  });

  const handleControlPress = useCallback(
    async (key: string) => {
      setActiveControls((prev) => {
        switch (key) {
          case "ArrowUp":
            return { ...prev, direction: "up" };
          case "ArrowRight":
            return { ...prev, direction: "right" };
          case "ArrowDown":
            return { ...prev, direction: "down" };
          case "ArrowLeft":
            return { ...prev, direction: "left" };
          case "Enter":
            return { ...prev, a: true };
          case "Backspace":
            return { ...prev, b: true };
          case "`":
            return { ...prev, select: true };
          case "Escape":
            return { ...prev, start: true };
          default:
            return prev;
        }
      });

      if (onAction) {
        await onAction(key);
      }
    },
    [onAction]
  );

  const handleControlRelease = useCallback((key: string) => {
    setActiveControls((prev) => {
      switch (key) {
        case "ArrowUp":
        case "ArrowRight":
        case "ArrowDown":
        case "ArrowLeft":
          return { ...prev, direction: null };
        case "Enter":
          return { ...prev, a: false };
        case "Backspace":
          return { ...prev, b: false };
        case "`":
          return { ...prev, select: false };
        case "Escape":
          return { ...prev, start: false };
        default:
          return prev;
      }
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      await handleControlPress(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      handleControlRelease(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleControlPress, handleControlRelease]);

  return {
    activeControls,
    handleControlPress,
    handleControlRelease,
  };
}
