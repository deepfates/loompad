import { useState, useCallback, useEffect, useRef } from "react";
import { ActiveControls } from "../types";

const INITIAL_REPEAT_DELAY = 250;
const REPEAT_INTERVAL = 80;

const getNextDirection = (keys: string[]): ActiveControls["direction"] => {
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    const key = keys[i];
    if (key === "ArrowUp") return "up";
    if (key === "ArrowRight") return "right";
    if (key === "ArrowDown") return "down";
    if (key === "ArrowLeft") return "left";
  }
  return null;
};

const buildActiveControls = (keys: string[]): ActiveControls => {
  return {
    direction: getNextDirection(keys),
    a: keys.includes("Enter"),
    b: keys.includes("Backspace"),
    select: keys.includes("`"),
    start: keys.includes("Escape"),
  };
};

const areActiveControlsEqual = (a: ActiveControls, b: ActiveControls) =>
  a.direction === b.direction &&
  a.a === b.a &&
  a.b === b.b &&
  a.select === b.select &&
  a.start === b.start;

export function useKeyboardControls(
  onAction?: (keys: string[], latestKey: string) => Promise<void> | void,
) {
  const [activeControls, setActiveControls] = useState<ActiveControls>({
    direction: null,
    a: false,
    b: false,
    select: false,
    start: false,
  });

  const pressedKeysRef = useRef<string[]>([]);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);

  const updateActiveControls = useCallback(() => {
    const keys = pressedKeysRef.current;
    const nextState = buildActiveControls(keys);

    setActiveControls((prev) => {
      if (areActiveControlsEqual(prev, nextState)) {
        return prev;
      }
      return nextState;
    });
  }, []);

  const triggerAction = useCallback(() => {
    if (!onAction) {
      return Promise.resolve();
    }

    const keys = pressedKeysRef.current;
    if (keys.length === 0) {
      return Promise.resolve();
    }

    const latestKey = keys[keys.length - 1];
    if (!latestKey) {
      return Promise.resolve();
    }

    return Promise.resolve(onAction([...keys], latestKey));
  }, [onAction]);

  const stopRepeat = useCallback(() => {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  const startRepeat = useCallback(() => {
    if (!onAction || pressedKeysRef.current.length === 0) {
      return;
    }

    stopRepeat();

    repeatTimeoutRef.current = window.setTimeout(() => {
      if (pressedKeysRef.current.length === 0) {
        stopRepeat();
        return;
      }

      void triggerAction();
      repeatIntervalRef.current = window.setInterval(() => {
        if (pressedKeysRef.current.length === 0) {
          stopRepeat();
          return;
        }

        void triggerAction();
      }, REPEAT_INTERVAL);
    }, INITIAL_REPEAT_DELAY);
  }, [onAction, stopRepeat, triggerAction]);

  const handleControlPress = useCallback(
    async (key: string) => {
      if (pressedKeysRef.current.includes(key)) {
        return;
      }

      pressedKeysRef.current.push(key);
      updateActiveControls();

      await triggerAction();
      startRepeat();
    },
    [startRepeat, triggerAction, updateActiveControls],
  );

  const handleControlRelease = useCallback(
    (key: string) => {
      const index = pressedKeysRef.current.indexOf(key);
      if (index === -1) {
        return;
      }

      pressedKeysRef.current.splice(index, 1);

      updateActiveControls();

      if (pressedKeysRef.current.length === 0) {
        stopRepeat();
      }
    },
    [stopRepeat, updateActiveControls],
  );

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      await handleControlPress(event.key);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      handleControlRelease(event.key);
    };

    const handleBlur = () => {
      if (pressedKeysRef.current.length === 0) {
        return;
      }
      pressedKeysRef.current.length = 0;
      updateActiveControls();
      stopRepeat();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      stopRepeat();
      pressedKeysRef.current.length = 0;
    };
  }, [handleControlPress, handleControlRelease, stopRepeat, updateActiveControls]);

  return {
    activeControls,
    handleControlPress,
    handleControlRelease,
  };
}
