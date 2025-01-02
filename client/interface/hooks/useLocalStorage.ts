import { useEffect, useState } from "react";
import { StoryNode } from "../types";

interface Trees {
  [key: string]: { root: StoryNode };
}

// Helper to safely access localStorage
const getStoredValue = (key: string, defaultValue: Trees): Trees => {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    if (!item) return defaultValue;

    const parsed = JSON.parse(item);
    // Validate the parsed data has the expected shape
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return defaultValue;
  } catch (error) {
    console.warn("Failed to load from localStorage:", error);
    return defaultValue;
  }
};

// Helper to safely store to localStorage
const setStoredValue = (key: string, value: Trees): void => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to save to localStorage:", error);
  }
};

export function useLocalStorage(defaultValue: Trees) {
  // Initialize state with a lazy function to only read localStorage once on mount
  const [trees, setTrees] = useState<Trees>(() =>
    getStoredValue("story-trees", defaultValue)
  );

  // Save to localStorage whenever trees change
  useEffect(() => {
    setStoredValue("story-trees", trees);
  }, [trees]);

  return [trees, setTrees] as const;
}
