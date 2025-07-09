import { useState, useCallback, useEffect } from "react";
import type { StoryNode, GeneratingState } from "../types";
import { useStoryGeneration } from "./useStoryGeneration";
import { useLocalStorage } from "./useLocalStorage";
import type { ModelId } from "../../../server/apis/generation";

// Helper function to generate unique node IDs
const generateNodeId = (prefix: string = 'node') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const INITIAL_STORY = {
  root: {
    id: generateNodeId('root'),
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
  generationCount: number;
}

export function useStoryTree(params: StoryParams, onModelChange?: (model: ModelId) => void) {
  const [trees, setTrees] = useLocalStorage(DEFAULT_TREES);
  const [currentTreeKey, setCurrentTreeKey] = useState(
    () => Object.keys(trees)[0]
  );
  const [storyTree, setStoryTree] = useState<{ root: StoryNode }>(
    () => trees[currentTreeKey]
  );

  // Migration effect to update old "root" IDs to proper IDs
  useEffect(() => {
    let hasChanges = false;
    const migratedTrees = { ...trees };

    Object.keys(migratedTrees).forEach(treeKey => {
      const tree = migratedTrees[treeKey];
      if (tree.root.id === "root") {
        console.log("🔄 Migrating old story with 'root' ID:", treeKey);
        tree.root.id = generateNodeId('root');
        hasChanges = true;
      }
      
      // Also migrate any continuations that might have simple IDs
      const migrateNode = (node: StoryNode) => {
        if (node.id && node.id.length < 10) {
          // Simple ID detected, migrate it
          node.id = generateNodeId('node');
        }
        if (node.continuations) {
          node.continuations.forEach(migrateNode);
        }
      };
      
      migrateNode(tree.root);
    });

    if (hasChanges) {
      console.log("🔄 Migration completed, updating localStorage");
      setTrees(migratedTrees);
    }
  }, [trees, setTrees]);
  const [currentDepth, setCurrentDepth] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([0]);
  const [generatingAt, setGeneratingAt] = useState<GeneratingState | null>(
    null
  );

  const { generateContinuation, isGenerating, error } = useStoryGeneration();

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
    []
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
    [storyTree, selectedOptions]
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
    [storyTree, currentTreeKey, setTrees]
  );

  const generateContinuations = useCallback(
    async (count: number): Promise<StoryNode[]> => {
      const currentPath = getCurrentPath();

      const results = await Promise.all(
        Array(count)
          .fill(null)
          .map(async () => {
            const result = await generateContinuation(currentPath, currentDepth, params);
            return {
              id: generateNodeId('node'),
              text: result.text,
              continuations: [],
              generatedByModel: result.generatedByModel,
              generationMetadata: result.generationMetadata,
            };
          })
      );
      return results;
    },
    [getCurrentPath, currentDepth, params, generateContinuation]
  );

  const addContinuations = useCallback(
    (
      path: StoryNode[],
      newContinuations: StoryNode[],
      isNewChildren: boolean
    ) => {
      console.log("Adding continuations:", {
        path: path.map((n) => ({ id: n.id, text: n.text.slice(0, 20) })),
        newContinuations: newContinuations.map((n) => ({
          id: n.id,
          text: n.text.slice(0, 20),
        })),
      });

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

      console.log("Updated tree node:", {
        nodeId: current.id,
        continuations: current.continuations.map((n) => ({
          id: n.id,
          text: n.text.slice(0, 20),
        })),
        lastSelectedIndex: current.lastSelectedIndex,
      });

      return newTree;
    },
    [storyTree]
  );

  const handleModelSwitch = useCallback(
    (availableModels: string[], direction: "left" | "right") => {
      if (!availableModels.length) return;

      const currentIndex = availableModels.indexOf(params.model);
      let newIndex: number;

      if (direction === "left") {
        newIndex = currentIndex <= 0 ? availableModels.length - 1 : currentIndex - 1;
      } else {
        newIndex = currentIndex >= availableModels.length - 1 ? 0 : currentIndex + 1;
      }

      const newModel = availableModels[newIndex] as ModelId;
      onModelChange?.(newModel);
    },
    [params.model, onModelChange]
  );

  const handleStoryNavigation = useCallback(
    async (key: string, availableModels: string[] = []) => {
      if (isGenerating) return;

      // Handle story switching with L/R buttons
      if (key === "q" || key === "Q") {
        // Cycle to previous story
        const treeKeys = Object.keys(trees);
        if (treeKeys.length > 1) {
          const currentIndex = treeKeys.indexOf(currentTreeKey);
          const newIndex = currentIndex > 0 ? currentIndex - 1 : treeKeys.length - 1;
          const newTreeKey = treeKeys[newIndex];
          setCurrentTreeKey(newTreeKey);
          console.log('🔄 Switched to previous story:', newTreeKey);
        }
        return;
      }
      if (key === "e" || key === "E" || key === "r" || key === "R" || key === "p" || key === "P") {
        // Cycle to next story
        const treeKeys = Object.keys(trees);
        if (treeKeys.length > 1) {
          const currentIndex = treeKeys.indexOf(currentTreeKey);
          const newIndex = currentIndex < treeKeys.length - 1 ? currentIndex + 1 : 0;
          const newTreeKey = treeKeys[newIndex];
          setCurrentTreeKey(newTreeKey);
          console.log('🔄 Switched to next story:', newTreeKey);
        }
        return;
      }

      const currentPath = getCurrentPath();
      const currentOption = selectedOptions[currentDepth] ?? 0;

      switch (key) {
        case "ArrowUp":
          const newDepth = Math.max(0, currentDepth - 1);
          setCurrentDepth(newDepth);
          // Ensure selectedOptions array has the correct value for the new depth
          // If the selectedOptions array doesn't have a value for this depth, use 0 as default
          if (selectedOptions[newDepth] === undefined) {
            setSelectedOptions((prev) => {
              const newOptions = [...prev];
              newOptions[newDepth] = 0;
              return newOptions;
            });
          }
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
        case "ArrowRight":
          // Get the current node's siblings using the same method as NavigationDots
          const siblings = getOptionsAtDepth(currentDepth);
          
          console.log('Left/Right navigation debug:', {
            currentDepth,
            currentOption,
            siblingsCount: siblings.length,
            siblings: siblings.map(s => ({ id: s.id, text: s.text.slice(0, 20) })),
            currentPath: currentPath.map(n => ({ id: n.id, text: n.text.slice(0, 20) })),
            selectedOptions
          });
          
          const direction = key === "ArrowLeft" ? -1 : 1;
          const newOption = currentOption + direction;
          
          console.log('Boundary check:', {
            siblingsLength: siblings.length,
            currentOption,
            newOption,
            direction,
            leftBoundary: newOption >= 0,
            rightBoundary: newOption < siblings.length,
            willNavigate: siblings.length > 1 && newOption >= 0 && newOption < siblings.length
          });
          
          // Check both left and right boundaries
          if (siblings.length > 1 && newOption >= 0 && newOption < siblings.length) {
            console.log('Navigating to sibling:', { from: currentOption, to: newOption, direction });
            setSelectedOptions((prev) => {
              const newOptions = [...prev];
              newOptions[currentDepth] = newOption;
              return newOptions.slice(0, currentDepth + 1);
            });
            // Note: We don't need to update lastSelectedIndex for sibling navigation
            // as we're just changing which sibling is selected at the current depth
          } else {
            console.log('Cannot navigate - invalid bounds:', { 
              siblingsLength: siblings.length, 
              newOption, 
              currentOption,
              direction 
            });
          }
          break;
        case "Enter": {
          if (error) return;

          const currentNode = currentPath[currentDepth];
          
          // Prevent generation from empty branching root nodes
          if (!currentNode.text || currentNode.text.trim() === "") {
            return;
          }
          
          const hasExistingContinuations =
            currentNode.continuations?.length > 0;
          const count = params.generationCount;

          console.log("Starting generation:", {
            depth: currentDepth,
            hasExisting: hasExistingContinuations,
            count,
            paramsGenerationCount: params.generationCount,
            allParams: params,
            currentNode: {
              id: currentNode.id,
              text: currentNode.text.slice(0, 20),
            },
          });

          setGeneratingAt({
            depth: currentDepth,
            index: hasExistingContinuations
              ? currentNode.continuations?.length ?? 0
              : null,
          });

          try {
            const newContinuations = await generateContinuations(count);
            console.log(
              "Generated continuations:",
              newContinuations.map((n) => ({
                id: n.id,
                text: n.text.slice(0, 20),
              }))
            );

            const updatedTree = addContinuations(
              currentPath.slice(0, currentDepth + 1),
              newContinuations,
              !hasExistingContinuations
            );

            // Update all state at once
            if (hasExistingContinuations) {
              // For siblings, select the new continuation
              const newIndex = currentNode.continuations?.length ?? 0;
              setSelectedOptions((prev) => {
                const newOptions = [...prev];
                newOptions[currentDepth] = newIndex;
                return newOptions.slice(0, currentDepth + 1);
              });
            } else {
              // For new children, stay at current depth
              // The children will be visible but not selected
              console.log("Generated new children, staying at current depth");
            }

            // Update tree last to ensure all state is consistent
            setStoryTree(updatedTree);
            setTrees((prev) => ({
              ...prev,
              [currentTreeKey]: updatedTree,
            }));
          } catch (e) {
            console.error("Generation failed:", e);
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
      setTrees,
      getLastSelectedIndex,
      updateLastSelectedIndex,
      trees,
      setCurrentTreeKey,
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
    setSelectedOptions,
    setCurrentDepth,
  };
}
