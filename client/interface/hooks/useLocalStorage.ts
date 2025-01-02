import { useEffect } from "react";
import { StoryNode } from "../types";

interface Trees {
  [key: string]: { root: StoryNode };
}

export function useLocalStorage(
  trees: Trees,
  setTrees: (trees: Trees) => void,
  currentTreeKey: string,
  setCurrentTreeKey: (key: string) => void,
  setStoryTree: (tree: { root: StoryNode }) => void
) {
  // Save tree changes to local storage
  useEffect(() => {
    localStorage.setItem("story-trees", JSON.stringify(trees));
  }, [trees]);

  // Load trees from local storage on mount
  useEffect(() => {
    const savedTrees = localStorage.getItem("story-trees");
    if (savedTrees) {
      try {
        const parsedTrees = JSON.parse(savedTrees);
        setTrees(parsedTrees);
        const firstKey = Object.keys(parsedTrees)[0];
        if (firstKey) {
          setCurrentTreeKey(firstKey);
          setStoryTree(parsedTrees[firstKey]);
        }
      } catch (error) {
        console.error("Failed to load saved trees:", error);
      }
    }
  }, []);
}
