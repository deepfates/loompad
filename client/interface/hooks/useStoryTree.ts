import { useState, useCallback, useEffect } from "react";
import type { StoryNode, GeneratingState } from "../types";
import { useStoryGeneration } from "./useStoryGeneration";
import type { ModelId } from "../../../server/apis/generation";

const INITIAL_STORY = {
  root: {
    id: "root",
    text: "The darkness grew absolute, not that the hyperstitioner could see in the first place. His ears pricked up, however; he could hear the skittering, the mechanical hum as the machine followed him invisibly.",
    continuations: [
      {
        id: "a1",
        text: " The mechanical tendrils wrapped tighter around his shoulder, its grip a cold reminder of their symbiosis.",
        continuations: [
          {
            id: "a1-1",
            text: " He welcomed its touch, knowing that only through this union could they hope to breach the fortress's final defenses.",
          },
          {
            id: "a1-2",
            text: " But something was wrong - the usual synchronicity of their movements had become discordant, threatening to tear apart their carefully maintained bond.",
          },
          {
            id: "a1-3",
            text: " Together they moved as one through the darkness, their shared consciousness expanding to map the geometric impossibilities ahead.",
          },
        ],
      },
      {
        id: "a2",
        text: " He reached toward the writhing shadows, feeling the borders of reality grow thin where his fingers traced the air.",
        continuations: [
          {
            id: "a2-1",
            text: " The membrane between dimensions parted like silk, revealing glimpses of impossible architectures that hurt to look upon.",
          },
          {
            id: "a2-2",
            text: " But the shadows recoiled from his touch, carrying with them fragments of memories that didn't belong to him.",
          },
          {
            id: "a2-3",
            text: " Static filled his mind as his hand penetrated the veil, establishing the first bridge between their world and what lay beyond.",
          },
        ],
      },
    ],
  },
};

interface StoryParams {
  temperature: number;
  maxTokens: number;
  model: ModelId;
}

export function useStoryTree(params: StoryParams) {
  const [trees, setTrees] = useState<{ [key: string]: { root: StoryNode } }>({
    "Story 1": INITIAL_STORY,
  });
  const [currentTreeKey, setCurrentTreeKey] = useState("Story 1");
  const [storyTree, setStoryTree] = useState<{ root: StoryNode }>(
    INITIAL_STORY
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
