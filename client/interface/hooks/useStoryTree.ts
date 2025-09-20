import { useState, useCallback, useEffect } from "react";
import type { StoryNode, InFlight, GeneratingInfo } from "../types";
import { useStoryGeneration } from "./useStoryGeneration";
import { useLocalStorage } from "./useLocalStorage";
import type { ModelId } from "../../../shared/models";
import { touchStoryUpdated } from "../utils/storyMeta";

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
  textSplitting: boolean;
}

export function useStoryTree(params: StoryParams) {
  const [trees, setTrees] = useLocalStorage(DEFAULT_TREES);
  const [currentTreeKey, setCurrentTreeKey] = useState(
    () => Object.keys(trees)[0],
  );
  const [storyTree, setStoryTree] = useState<{ root: StoryNode }>(
    () => trees[currentTreeKey],
  );
  const [currentDepth, setCurrentDepth] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([0]);
  const [inFlight, setInFlight] = useState<InFlight>(new Set());
  const [generatingInfo, setGeneratingInfo] = useState<GeneratingInfo>({});

  const { generateContinuation, error } = useStoryGeneration();

  // Helper to check if a specific node is generating
  const isGeneratingAt = useCallback(
    (nodeId: string) => inFlight.has(nodeId),
    [inFlight],
  );

  // Helper to check if any generation is in progress
  const isAnyGenerating = inFlight.size > 0;

  useEffect(() => {
    setStoryTree(trees[currentTreeKey] || INITIAL_STORY);
  }, [trees, currentTreeKey]);

  // Helper to get the last selected index for a node
  const getLastSelectedIndex = useCallback(
    (node: StoryNode, defaultIndex: number) => {
      if (
        typeof node.lastSelectedIndex === "number" &&
        node.continuations &&
        node.lastSelectedIndex < node.continuations.length
      ) {
        return node.lastSelectedIndex;
      }
      return defaultIndex;
    },
    [],
  );

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
    [storyTree, selectedOptions],
  );

  const getCurrentPath = useCallback((): StoryNode[] => {
    const path = [storyTree.root];
    let currentNode = storyTree.root;

    // First follow the selected options
    for (let i = 0; i < selectedOptions.length; i++) {
      const nextNode = currentNode.continuations?.[selectedOptions[i]];
      if (!nextNode) break;
      path.push(nextNode);
      currentNode = nextNode;
    }

    // Then continue following lastSelectedIndex or first child until we hit a leaf
    while (currentNode.continuations?.length) {
      const index = getLastSelectedIndex(currentNode, 0);
      const nextNode = currentNode.continuations[index];
      if (!nextNode) break;
      path.push(nextNode);
      currentNode = nextNode;
    }

    return path;
  }, [storyTree, selectedOptions, getLastSelectedIndex]);

  // Helper to update the lastSelectedIndex in the tree
  const updateLastSelectedIndex = useCallback(
    (path: StoryNode[], depth: number, index: number) => {
      const newTree = JSON.parse(JSON.stringify(storyTree)) as typeof storyTree;
      let current = newTree.root;

      // Navigate to the node at the specified depth using the path directly
      for (let i = 1; i <= depth; i++) {
        const pathNode = path[i];
        if (!pathNode) break;
        // Find the matching continuation
        const continuationIndex =
          current.continuations?.findIndex((node) => node.id === pathNode.id) ??
          -1;
        if (continuationIndex === -1) break;
        current = current.continuations![continuationIndex];
      }

      // Update the lastSelectedIndex
      current.lastSelectedIndex = index;

      setStoryTree(newTree);
      setTrees((prev) => ({
        ...prev,
        [currentTreeKey]: newTree,
      }));
    },
    [storyTree, currentTreeKey, setTrees],
  );

  const generateContinuations = useCallback(
    async (count: number): Promise<StoryNode[]> => {
      const currentPath = getCurrentPath();

      const results = await Promise.all(
        Array(count)
          .fill(null)
          .map(async () => {
            // generateContinuation now returns a node chain (head node)
            return await generateContinuation(
              currentPath,
              currentDepth,
              params,
            );
          }),
      );
      return results;
    },
    [getCurrentPath, currentDepth, params, generateContinuation],
  );

  const addContinuations = useCallback(
    (
      path: StoryNode[],
      newContinuations: StoryNode[],
      isNewChildren: boolean,
    ) => {
      const newTree = JSON.parse(JSON.stringify(storyTree)) as typeof storyTree;
      let current = newTree.root;

      // Navigate to the target node using path IDs to ensure we find the right node
      for (let i = 1; i < path.length; i++) {
        const pathNode = path[i];
        const continuationIndex =
          current.continuations?.findIndex((node) => node.id === pathNode.id) ??
          -1;
        if (continuationIndex === -1) {
          console.error("Failed to find node in path:", {
            pathNode,
            currentContinuations: current.continuations,
          });
          return newTree;
        }
        current = current.continuations![continuationIndex];
      }

      // Initialize or append continuations
      if (!current.continuations) {
        current.continuations = newContinuations;
      } else {
        current.continuations = [...current.continuations, ...newContinuations];
      }

      // Set lastSelectedIndex for the current node
      if (isNewChildren) {
        current.lastSelectedIndex = 0;
      } else {
        current.lastSelectedIndex = (current.continuations?.length ?? 1) - 1;
      }

      return newTree;
    },
    [storyTree],
  );

  const handleStoryNavigation = useCallback(
    async (key: string) => {
      // Allow arrow/backspace navigation during generation, but prevent new
      // generations from the same node if it's already generating.
      const currentPath = getCurrentPath();
      const currentNode = currentPath[currentDepth];
      if (key === "Enter" && isGeneratingAt(currentNode.id)) return;

      const options = getOptionsAtDepth(currentDepth);
      const currentOption = selectedOptions[currentDepth] ?? 0;

      switch (key) {
        case "ArrowUp":
          setCurrentDepth((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowDown":
          if (currentDepth < currentPath.length - 1) {
            setCurrentDepth((prev) => prev + 1);
            const nextOptions = getOptionsAtDepth(currentDepth + 1);
            if (nextOptions.length > 0) {
              // Use lastSelectedIndex when moving down
              const currentNode = currentPath[currentDepth];
              const nextNode =
                currentNode.continuations?.[selectedOptions[currentDepth]];
              if (nextNode) {
                const lastIndex = getLastSelectedIndex(nextNode, 0);
                setSelectedOptions((prev) => {
                  const newOptions = [...prev];
                  newOptions[currentDepth + 1] = lastIndex;
                  // Keep only the options up to the current depth + 1
                  // This allows the getCurrentPath to follow lastSelectedIndex for the rest
                  return newOptions.slice(0, currentDepth + 2);
                });
              }
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
            // Update lastSelectedIndex when switching continuations
            updateLastSelectedIndex(
              currentPath,
              currentDepth,
              currentOption - 1,
            );
          }
          break;
        case "ArrowRight":
          if (options.length > 1 && currentOption < options.length - 1) {
            setSelectedOptions((prev) => {
              const newOptions = [...prev];
              newOptions[currentDepth] = currentOption + 1;
              return newOptions.slice(0, currentDepth + 1);
            });
            // Update lastSelectedIndex when switching continuations
            updateLastSelectedIndex(
              currentPath,
              currentDepth,
              currentOption + 1,
            );
          }
          break;
        case "Enter": {
          if (error) return;

          const currentNode = currentPath[currentDepth];
          const hasExistingContinuations =
            currentNode.continuations?.length > 0;
          const count = hasExistingContinuations ? 1 : 3;

          // Add node to in-flight set and track generation info
          setInFlight((prev) => new Set(prev).add(currentNode.id));
          setGeneratingInfo((prev) => ({
            ...prev,
            [currentNode.id]: {
              depth: currentDepth,
              index: hasExistingContinuations
                ? (currentNode.continuations?.length ?? 0)
                : null,
            },
          }));

          try {
            const newContinuations = await generateContinuations(count);

            const updatedTree = addContinuations(
              currentPath.slice(0, currentDepth + 1),
              newContinuations,
              !hasExistingContinuations,
            );

            // Don't auto-jump to new nodes - let user navigate manually
            // The new nodes will be visible in the reader and minimap
            // but the cursor stays where it was

            // Update tree last to ensure all state is consistent
            setStoryTree(updatedTree);
            setTrees((prev) => ({
              ...prev,
              [currentTreeKey]: updatedTree,
            }));
            // Mark story as updated for reverse-chronological ordering
            touchStoryUpdated(currentTreeKey);
          } catch (e) {
            console.error("Generation failed:", e);
          } finally {
            // Remove node from in-flight set and clear generation info
            setInFlight((prev) => {
              const newSet = new Set(prev);
              newSet.delete(currentNode.id);
              return newSet;
            });
            setGeneratingInfo((prev) => {
              const newInfo = { ...prev };
              delete newInfo[currentNode.id];
              return newInfo;
            });
          }
          break;
        }
      }
    },
    [
      error,
      getCurrentPath,
      getOptionsAtDepth,
      currentDepth,
      selectedOptions,
      generateContinuations,
      addContinuations,
      currentTreeKey,
      setTrees,
      getLastSelectedIndex,
      updateLastSelectedIndex,
      isGeneratingAt,
    ],
  );

  return {
    storyTree,
    currentDepth,
    selectedOptions,
    inFlight,
    generatingInfo,
    isGeneratingAt,
    isAnyGenerating,
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
    // Set selection state (currentDepth and selectedOptions) from a provided path.
    // Matches path IDs against current storyTree to compute indices.
    setSelectionByPath: (path: StoryNode[]) => {
      if (!path || path.length === 0) return;
      const indices: number[] = [];
      let current = storyTree.root;
      for (let i = 1; i < path.length; i++) {
        const target = path[i];
        const idx =
          current.continuations?.findIndex((n) => n.id === target.id) ?? -1;
        if (idx < 0) break;
        indices.push(idx);
        current = current.continuations![idx];
      }
      // Depth equals number of traversed indices
      setCurrentDepth(indices.length);
      // Keep at least one element for downstream logic
      setSelectedOptions(indices.length ? indices : [0]);
    },
    getCurrentPath,
    getOptionsAtDepth,
    setTrees,
    setStoryTree,
  };
}
