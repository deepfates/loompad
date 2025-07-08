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
    l: false,
    r: false,
  });

  const handleControlPress = useCallback(
    async (key: string) => {
      // Map alternate keys to their primary equivalents for downstream logic
      let mappedKey = key;
      if (key === "w" || key === "W") mappedKey = "ArrowUp";
      else if (key === "a" || key === "A") mappedKey = "ArrowLeft";
      else if (key === "s" || key === "S") mappedKey = "ArrowDown";
      else if (key === "d" || key === "D") mappedKey = "ArrowRight";

      setActiveControls((prev) => {
        switch (key) {
          case "ArrowUp":
          case "w":
          case "W":
            return { ...prev, direction: "up" };
          case "ArrowRight":
          case "d":
          case "D":
            return { ...prev, direction: "right" };
          case "ArrowDown":
          case "s":
          case "S":
            return { ...prev, direction: "down" };
          case "ArrowLeft":
          case "a":
          case "A":
            return { ...prev, direction: "left" };
          case "Enter":
            return { ...prev, a: true };
          case "Backspace":
            return { ...prev, b: true };
          case "`":
            return { ...prev, select: true };
          case "Escape":
            return { ...prev, start: true };
          case "q":
          case "Q":
            return { ...prev, l: true };
          case "e":
          case "E":
            return { ...prev, r: true };
          case "r":
          case "R":
            return { ...prev, r: true };
          case "p":
          case "P":
            return { ...prev, r: true };
          case "z":
          case "Z":
            return { ...prev, select: true };
          case "m":
          case "M":
            return { ...prev, start: true };
          default:
            return prev;
        }
      });

      if (onAction) {
        await onAction(mappedKey);
      }
    },
    [onAction]
  );

  const handleControlRelease = useCallback((key: string) => {
    setActiveControls((prev) => {
      switch (key) {
        case "w":
        case "W":
        case "d":
        case "D":
        case "s":
        case "S":
        case "a":
        case "A":
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
        case "q":
        case "Q":
          return { ...prev, l: false };
        case "e":
        case "E":
        case "r":
        case "R":
          return { ...prev, r: false };
        case "p":
        case "P":
          return { ...prev, r: false };
        case "z":
        case "Z":
          return { ...prev, select: false };
        case "m":
        case "M":
          return { ...prev, start: false };
        default:
          return prev;
      }
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only allow ESC and backtick when in textarea, block all other keys
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const isAllowedKey = ['Escape', '`'].includes(e.key);
        if (!isAllowedKey) {
          return;
        }
      }
      await handleControlPress(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Only allow ESC and backtick when in textarea, block all other keys
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const isAllowedKey = ['Escape', '`'].includes(e.key);
        if (!isAllowedKey) {
          return;
        }
      }
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
