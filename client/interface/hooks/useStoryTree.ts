import { useState, useCallback } from "react";
import { StoryNode, GeneratingState } from "../types";

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

export function useStoryTree() {
  const [trees, setTrees] = useState<{ [key: string]: { root: StoryNode } }>({
    "Story 1": INITIAL_STORY,
  });
  const [currentTreeKey, setCurrentTreeKey] = useState("Story 1");
  const [storyTree, setStoryTree] = useState(trees[currentTreeKey]);
  const [currentDepth, setCurrentDepth] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([0]);
  const [generatingAt, setGeneratingAt] = useState<GeneratingState | null>(
    null
  );

  const getOptionsAtDepth = useCallback(
    (depth: number): StoryNode[] => {
      if (depth === 0) return storyTree.root.continuations || [];

      let currentNode = storyTree.root;
      for (let i = 0; i < depth - 1; i++) {
        if (!currentNode.continuations?.[selectedOptions[i]]) return [];
        currentNode = currentNode.continuations[selectedOptions[i]];
      }

      const currentOption =
        currentNode.continuations?.[selectedOptions[depth - 1]];
      return currentOption?.continuations || [];
    },
    [storyTree, selectedOptions]
  );

  const getCurrentPath = useCallback((): StoryNode[] => {
    const path = [storyTree.root];
    let currentNode = storyTree.root;

    for (let i = 0; i < selectedOptions.length; i++) {
      if (!currentNode.continuations) break;
      const nextNode = currentNode.continuations[selectedOptions[i]];
      if (!nextNode) break;
      path.push(nextNode);
      currentNode = nextNode;
    }

    return path;
  }, [storyTree, selectedOptions]);

  const generateRandomText = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const adjectives = [
      "mysterious",
      "glowing",
      "ancient",
      "digital",
      "quantum",
      "neural",
      "cybernetic",
    ];
    const nouns = [
      "algorithm",
      "signal",
      "pattern",
      "network",
      "interface",
      "matrix",
      "protocol",
    ];
    const verbs = [
      "pulsed",
      "shimmered",
      "transformed",
      "resonated",
      "manifested",
      "evolved",
      "interfaced",
    ];

    const randomWord = (arr: string[]) =>
      arr[Math.floor(Math.random() * arr.length)];
    return ` The ${randomWord(adjectives)} ${randomWord(nouns)} ${randomWord(
      verbs
    )} through the system.`;
  }, []);

  const generateContinuations = useCallback(
    async (count: number): Promise<StoryNode[]> => {
      const results = await Promise.all(
        Array(count)
          .fill(null)
          .map(async () => ({
            id: Math.random().toString(36).substring(2),
            text: await generateRandomText(),
          }))
      );
      return results;
    },
    [generateRandomText]
  );

  const addContinuations = useCallback(
    (path: StoryNode[], newContinuations: StoryNode[]) => {
      const newTree = JSON.parse(
        JSON.stringify(storyTree)
      ) as typeof INITIAL_STORY;
      let current = newTree.root;

      for (let i = 1; i < path.length; i++) {
        const continuationIndex = selectedOptions[i - 1];
        if (current.continuations && current.continuations[continuationIndex]) {
          current = current.continuations[continuationIndex];
        } else {
          return newTree;
        }
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
      const currentPath = getCurrentPath();
      const options = getOptionsAtDepth(currentDepth);

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
          if (options.length > 1) {
            const currentIndex = selectedOptions[currentDepth] || 0;
            if (currentIndex > 0) {
              setSelectedOptions((prev) => {
                const newOptions = [...prev];
                newOptions[currentDepth] = currentIndex - 1;
                return newOptions.slice(0, currentDepth + 1);
              });
            }
          }
          break;
        case "ArrowRight":
          if (options.length > 1) {
            const currentIndex = selectedOptions[currentDepth] || 0;
            if (currentIndex < options.length - 1) {
              setSelectedOptions((prev) => {
                const newOptions = [...prev];
                newOptions[currentDepth] = currentIndex + 1;
                return newOptions.slice(0, currentDepth + 1);
              });
            }
          }
          break;
        case "Enter": {
          const hasExistingContinuations =
            currentPath[currentDepth].continuations?.length > 0;
          const count = hasExistingContinuations ? 1 : 3;

          setGeneratingAt({
            depth: currentDepth,
            index: hasExistingContinuations
              ? currentPath[currentDepth].continuations.length
              : null,
          });

          const newContinuations = await generateContinuations(count);
          const updatedTree = addContinuations(
            currentPath.slice(0, currentDepth + 1),
            newContinuations
          );
          setStoryTree(updatedTree);

          if (hasExistingContinuations) {
            const newIndex = currentPath[currentDepth].continuations.length;
            setSelectedOptions((prev) => {
              const newOptions = [...prev];
              newOptions[currentDepth] = newIndex;
              return newOptions;
            });
          } else {
            setSelectedOptions((prev) => [...prev, 0]);
          }

          setGeneratingAt(null);
          break;
        }
      }
    },
    [
      currentDepth,
      getCurrentPath,
      getOptionsAtDepth,
      generateContinuations,
      addContinuations,
    ]
  );

  return {
    trees,
    setTrees,
    currentTreeKey,
    setCurrentTreeKey,
    storyTree,
    setStoryTree,
    currentDepth,
    setCurrentDepth,
    selectedOptions,
    setSelectedOptions,
    generatingAt,
    setGeneratingAt,
    getOptionsAtDepth,
    getCurrentPath,
    handleStoryNavigation,
  };
}
