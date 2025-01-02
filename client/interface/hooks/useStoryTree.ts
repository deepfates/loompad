import { useState, useCallback, useEffect } from "react";
import type { StoryNode, GeneratingState } from "../types";
import { useStoryGeneration } from "./useStoryGeneration";
import { useLocalStorage } from "./useLocalStorage";
import type { ModelId } from "../../../server/apis/generation";

const INITIAL_STORY = {
  root: {
    id: "root",
    text: "Once upon a time...",
    continuations: [],
  },
};

const DEFAULT_TREES = {
  "Story 1": INITIAL_STORY,
};

interface StoryParams {
  temperature: number;
  maxTokens: number;
  model: ModelId;
}

export function useStoryTree(params: StoryParams) {
  const [trees, setTrees] = useLocalStorage(DEFAULT_TREES);
  const [currentTreeKey, setCurrentTreeKey] = useState(
    () => Object.keys(trees)[0]
  );
  const [storyTree, setStoryTree] = useState<{ root: StoryNode }>(
    () => trees[currentTreeKey]
  );
  const [currentDepth, setCurrentDepth] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([0]);
  const [generatingAt, setGeneratingAt] = useState<GeneratingState | null>(
    null
  );

  const { generateContinuation, isGenerating, error } = useStoryGeneration();

  useEffect(() => {
    setStoryTree(trees[currentTreeKey] || INITIAL_STORY);
  }, [trees, currentTreeKey]);

  const getOptionsAtDepth = useCallback(
    (depth: number): StoryNode[] => {
      if (depth === 0) return storyTree.root.continuations || [];

      let currentNode = storyTree.root;
      for (let i = 0; i < depth - 1; i++) {
        if (!currentNode.continuations?.[selectedOptions[i]]) return [];
        currentNode = currentNode.continuations[selectedOptions[i]];
      }

      return (
        currentNode.continuations?.[selectedOptions[depth - 1]]
          ?.continuations || []
      );
    },
    [storyTree, selectedOptions]
  );

  const getCurrentPath = useCallback((): StoryNode[] => {
    const path = [storyTree.root];
    let currentNode = storyTree.root;

    for (let i = 0; i < selectedOptions.length; i++) {
      const nextNode = currentNode.continuations?.[selectedOptions[i]];
      if (!nextNode) break;
      path.push(nextNode);
      currentNode = nextNode;
    }

    return path;
  }, [storyTree, selectedOptions]);

  const generateContinuations = useCallback(
    async (count: number): Promise<StoryNode[]> => {
      const currentPath = getCurrentPath();

      const results = await Promise.all(
        Array(count)
          .fill(null)
          .map(async () => ({
            id: Math.random().toString(36).substring(2),
            text: await generateContinuation(currentPath, currentDepth, params),
          }))
      );
      return results;
    },
    [getCurrentPath, currentDepth, params, generateContinuation]
  );

  const addContinuations = useCallback(
    (path: StoryNode[], newContinuations: StoryNode[]) => {
      const newTree = JSON.parse(JSON.stringify(storyTree)) as typeof storyTree;
      let current = newTree.root;

      for (let i = 1; i < path.length; i++) {
        const nextNode = current.continuations?.[selectedOptions[i - 1]];
        if (!nextNode) return newTree;
        current = nextNode;
      }

      if (!current.continuations) {
        current.continuations = newContinuations;
      } else {
        current.continuations = [...current.continuations, ...newContinuations];
      }

      return newTree;
    },
    [storyTree, selectedOptions]
  );

  const handleStoryNavigation = useCallback(
    async (key: string) => {
      if (isGenerating) return;

      const currentPath = getCurrentPath();
      const options = getOptionsAtDepth(currentDepth);
      const currentOption = selectedOptions[currentDepth] || 0;

      switch (key) {
        case "ArrowUp":
          setCurrentDepth((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowDown":
          if (currentDepth < currentPath.length - 1) {
            setCurrentDepth((prev) => prev + 1);
            const nextOptions = getOptionsAtDepth(currentDepth + 1);
            if (nextOptions.length > 0) {
              setSelectedOptions((prev) => {
                const newOptions = [...prev];
                newOptions[currentDepth + 1] = 0;
                return newOptions;
              });
            }
          }
          break;
        case "ArrowLeft":
          if (options.length > 1 && currentOption > 0) {
            setSelectedOptions((prev) => {
              const newOptions = [...prev];
              newOptions[currentDepth] = currentOption - 1;
              return newOptions.slice(0, currentDepth + 1);
            });
          }
          break;
        case "ArrowRight":
          if (options.length > 1 && currentOption < options.length - 1) {
            setSelectedOptions((prev) => {
              const newOptions = [...prev];
              newOptions[currentDepth] = currentOption + 1;
              return newOptions.slice(0, currentDepth + 1);
            });
          }
          break;
        case "Enter": {
          if (error) return;

          const hasExistingContinuations =
            currentPath[currentDepth].continuations?.length > 0;
          const count = hasExistingContinuations ? 1 : 3;

          setGeneratingAt({
            depth: currentDepth,
            index: hasExistingContinuations
              ? currentPath[currentDepth].continuations?.length ?? 0
              : null,
          });

          try {
            const newContinuations = await generateContinuations(count);
            const updatedTree = addContinuations(
              currentPath.slice(0, currentDepth + 1),
              newContinuations
            );
            setStoryTree(updatedTree);
            setTrees((prev) => ({
              ...prev,
              [currentTreeKey]: updatedTree,
            }));

            if (hasExistingContinuations) {
              const newIndex =
                currentPath[currentDepth].continuations?.length ?? 0;
              setSelectedOptions((prev) => {
                const newOptions = [...prev];
                newOptions[currentDepth] = newIndex;
                return newOptions;
              });
            } else {
              setSelectedOptions((prev) => [...prev, 0]);
            }
          } finally {
            setGeneratingAt(null);
          }
          break;
        }
      }
    },
    [
      isGenerating,
      error,
      getCurrentPath,
      getOptionsAtDepth,
      currentDepth,
      selectedOptions,
      generateContinuations,
      addContinuations,
      currentTreeKey,
    ]
  );

  return {
    storyTree,
    currentDepth,
    selectedOptions,
    generatingAt,
    isGenerating,
    error,
    handleStoryNavigation,
    trees,
    currentTreeKey,
    setCurrentTreeKey: (key: string) => {
      setCurrentTreeKey(key);
      setStoryTree(trees[key] || INITIAL_STORY);
      setCurrentDepth(0);
      setSelectedOptions([0]);
    },
    getCurrentPath,
    getOptionsAtDepth,
    setTrees,
    setStoryTree,
  };
}
