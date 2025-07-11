import { useEffect, useRef, useCallback } from "react";
import { useTextGeneration } from "./useTextGeneration";
import type { StoryNode } from "../types";
import type { ModelId } from "../../../server/apis/generation";

interface ScoredNode {
  score: number;
  child: StoryNode;
  index: number;
  depth: number;
  hasGeneratedChildren: boolean;
}

interface AgentProps {
  isEnabled: boolean;
  isGenerating: boolean;
  currentDepth: number;
  selectedOptions: number[];
  getCurrentPath: () => StoryNode[];
  getOptionsAtDepth: (depth: number) => StoryNode[];
  handleControlPress: (key: string) => Promise<void> | void;
  model: ModelId;
}

export function useLLMAgent({
  isEnabled,
  isGenerating,
  currentDepth,
  selectedOptions,
  getCurrentPath,
  getOptionsAtDepth,
  handleControlPress,
  model,
}: AgentProps) {
  const { generate, isGenerating: isScoring } = useTextGeneration();
  const isAgentRunning = useRef(false);
  const agentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoredNodesCache = useRef<Map<string, ScoredNode[]>>(new Map());
  const MAX_DEPTH = 4;

  // Helper function for consistent delays throughout the agent
  const agentDelay = useCallback((ms: number = 1000) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  // Store the latest handleControlPress in a ref to avoid stale closures
  const handleControlPressRef = useRef(handleControlPress);
  useEffect(() => {
    handleControlPressRef.current = handleControlPress;
  }, [handleControlPress]);

  const scoreContinuation = useCallback(async (
    context: string,
    continuation: string
  ): Promise<number> => {
    const prompt =
      `Rate the following story continuation on a scale of 0-10 for how interesting it is.\n` +
      `0 = boring, 10 = very interesting\n` +
      `Respond with ONLY a single number.\n\n` +
      `STORY SO FAR: ${context}\n\n` +
      `CONTINUATION: ${continuation}\n\n` +
      `RATING: `;

    console.log("LLM-Agent: Requesting score for continuation:", continuation.slice(0, 50) + "...");
    
    let raw = "";
    
    try {
      await generate(
        prompt,
        { model, temperature: 0.7, maxTokens: 10 },
        (token) => {
          raw += token;
        },
        () => {
          console.log("LLM-Agent: Score generation completed");
        }
      );
      
      await agentDelay(100);
      
    } catch (error) {
      console.error("LLM-Agent: Error during score generation:", error);
      return 0;
    }
    
    const match = raw.match(/\d+/);
    const num = match ? parseInt(match[0], 10) : NaN;
    const clamped = isNaN(num) ? 0 : Math.min(10, Math.max(0, num));
    console.log("LLM-Agent: Parsed score ->", clamped);
    return clamped;
  }, [generate, model]);

  const getCacheKey = useCallback((depth: number, pathToDepth: StoryNode[]): string => {
    return `${depth}_${pathToDepth.map(n => n.text.slice(0, 20)).join('_')}`;
  }, []);

  const findHighestScoringUncle = useCallback((max_depth: number = 2): { depth: number; index: number } | null => {
    const currentPath = getCurrentPath();
    
    // Go up the tree from current depth - 1 to find the highest scoring uncle
    // Only search up to max_depth (inclusive)
    const searchStartDepth = Math.min(currentDepth - 1, max_depth);
    
    let bestUncle: { depth: number; index: number; score: number } | null = null;
    
    for (let depth = searchStartDepth; depth >= 0; depth--) {
      const pathToDepth = currentPath.slice(0, depth + 1);
      const cacheKey = getCacheKey(depth, pathToDepth);
      const cachedScores = scoredNodesCache.current.get(cacheKey);
      
      if (cachedScores) {
        // Find the highest scoring node that hasn't generated children yet
        // and is not the currently selected path
        const currentSelectedIndex = selectedOptions[depth] ?? 0;
        const availableUncles = cachedScores.filter(node => 
          !node.hasGeneratedChildren && 
          node.index !== currentSelectedIndex
        );
        
        if (availableUncles.length > 0) {
          const depthBestUncle = availableUncles.reduce((a, b) => a.score >= b.score ? a : b);
          
          // Keep track of the globally best uncle across all depths
          if (!bestUncle || depthBestUncle.score > bestUncle.score) {
            bestUncle = { depth, index: depthBestUncle.index, score: depthBestUncle.score };
          }
        }
      }
    }
    
    if (bestUncle) {
      console.log(`LLM-Agent: Found highest scoring uncle at depth ${bestUncle.depth}, index ${bestUncle.index}, score ${bestUncle.score} (searched up to depth ${max_depth})`);
      return { depth: bestUncle.depth, index: bestUncle.index };
    }
    
    console.log(`LLM-Agent: No available uncles found (searched up to depth ${max_depth})`);
    return null;
  }, [currentDepth, getCurrentPath, getCacheKey, selectedOptions]);

  const navigateToPosition = useCallback(async (targetDepth: number, targetIndex: number) => {
    console.log(`LLM-Agent: Navigating to depth ${targetDepth}, index ${targetIndex}`);
    
    // First, navigate up to the target depth
    const depthDiff = currentDepth - targetDepth;
    for (let i = 0; i < depthDiff; i++) {
      await handleControlPressRef.current('ArrowUp');
      await agentDelay();
    }
    
    // Then navigate to the target index
    const currentSelectionIndex = selectedOptions[targetDepth] ?? 0;
    const indexDiff = targetIndex - currentSelectionIndex;
    
    if (indexDiff > 0) {
      for (let i = 0; i < indexDiff; i++) {
        await handleControlPressRef.current('ArrowRight');
        await agentDelay();
      }
    } else if (indexDiff < 0) {
      for (let i = 0; i < -indexDiff; i++) {
        await handleControlPressRef.current('ArrowLeft');
        await agentDelay();
      }
    }
    
    // Move down to start exploring this branch
    await handleControlPressRef.current('ArrowDown');
  }, [currentDepth, selectedOptions]);

  const markNodeAsHavingChildren = useCallback((depth: number, index: number) => {
    const currentPath = getCurrentPath();
    const pathToDepth = currentPath.slice(0, depth + 1);
    const cacheKey = getCacheKey(depth, pathToDepth);
    const cachedScores = scoredNodesCache.current.get(cacheKey);
    
    if (cachedScores) {
      const nodeToUpdate = cachedScores.find(node => node.index === index);
      if (nodeToUpdate) {
        nodeToUpdate.hasGeneratedChildren = true;
        console.log(`LLM-Agent: Marked node at depth ${depth}, index ${index} as having generated children`);
      }
    }
  }, [getCurrentPath, getCacheKey]);

  const runAgentCycle = useCallback(async () => {
    if (isAgentRunning.current || !isEnabled || isGenerating || isScoring) {
      return;
    }

    console.log("LLM-Agent: --- Starting new cycle ---");
    isAgentRunning.current = true;

    try {
      const currentPath = getCurrentPath();
      const currentNode = currentPath[currentDepth];
      const children = getOptionsAtDepth(currentDepth);

      console.log(`LLM-Agent: At depth ${currentDepth}, node: "${currentNode.text.slice(0, 30)}...". Children: ${children.length}`);
      
      // Check if we've reached maximum depth
      if (currentDepth >= MAX_DEPTH) {
        console.log(`LLM-Agent: Reached maximum depth ${MAX_DEPTH}. Deciding next action...`);
        
        // 50/50 chance: start new story or navigate to highest scoring uncle
        const shouldStartNewStory = Math.random() < 0.5;
        console.log("LLM-Agent: shouldStartNewStory", shouldStartNewStory);
        if (shouldStartNewStory) {
          console.log("LLM-Agent: Starting a new story (50% chance).");
          await handleControlPressRef.current('Escape');
          await agentDelay();
          await handleControlPressRef.current('Enter');
        } else {
          console.log("LLM-Agent: Looking for highest scoring uncle (50% chance).");
          const unclePosition = findHighestScoringUncle();
          
          if (unclePosition) {
            console.log("LLM-Agent: Navigating to highest scoring uncle. Uncle position:", unclePosition);
            // Mark the current node as having generated children since we're moving away from it
            markNodeAsHavingChildren(currentDepth, selectedOptions[currentDepth] ?? 0);
            await navigateToPosition(unclePosition.depth, unclePosition.index);
            // Mark the uncle as having generated children to prevent returning to it immediately
            markNodeAsHavingChildren(unclePosition.depth, unclePosition.index);
            
            // After navigating to uncle, check if it needs children generated
            const uncleChildren = getOptionsAtDepth(unclePosition.depth + 1);
            if (uncleChildren.length === 0) {
              console.log("LLM-Agent: Uncle has no children. Generating new content.");
              await agentDelay();
              await handleControlPressRef.current('Enter');
            }
          } else {
            console.log("LLM-Agent: No available uncles found. Starting a new story instead.");
            await handleControlPressRef.current('Escape');
            await agentDelay();
            await handleControlPressRef.current('Enter');
          }
        }
        return;
      }
      
      if (children.length === 0) {
        console.log("LLM-Agent: No children found. Pressing Enter to generate new ones.");
        await handleControlPressRef.current('Enter');
      } else {
        console.log("LLM-Agent: Scoring children...");
        const currentPathToDepth = currentPath.slice(0, currentDepth + 1);
        const cacheKey = getCacheKey(currentDepth, currentPathToDepth);
        
        // Check if we already have cached scores for this position
        let scores: ScoredNode[] = scoredNodesCache.current.get(cacheKey) || [];
        
        if (scores.length === 0) {
          // Generate new scores
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const context = currentPath.slice(0, currentDepth + 1).map(n => n.text).join("");
            const score = await scoreContinuation(context, child.text);
                      scores.push({ 
            score, 
            child, 
            index: i, 
            depth: currentDepth, 
            hasGeneratedChildren: false 
          });
          await agentDelay(500); // Delay between API calls
          }
          
          // Cache the scores
          scoredNodesCache.current.set(cacheKey, scores);
          console.log("LLM-Agent: All children scored and cached:", scores);
        } else {
          console.log("LLM-Agent: Using cached scores:", scores);
        }

        const best = scores.reduce((a, b) => a.score >= b.score ? a : b);
        console.log(`LLM-Agent: Best child is at index ${best.index} with score ${best.score}`);

        if (best.score >= 5) {
          console.log("LLM-Agent: Score is high enough. Navigating to best child.");
          const bestChildIndex = best.index;
          const currentSelectionIndex = selectedOptions[currentDepth] ?? 0;
          const diff = bestChildIndex - currentSelectionIndex;

          console.log(`LLM-Agent: Navigating from ${currentSelectionIndex} to ${bestChildIndex}. Diff: ${diff}`);
          
          if (diff > 0) {
            for (let i = 0; i < diff; i++) {
              await handleControlPressRef.current('ArrowRight');
              await agentDelay();
            }
          } else if (diff < 0) {
            for (let i = 0; i < -diff; i++) {
              await handleControlPressRef.current('ArrowLeft');
              await agentDelay();
            }
          }
          
          console.log("LLM-Agent: Selection complete. Moving down a level. The next cycle will handle generation.");
          await handleControlPressRef.current('ArrowDown');
          
          // Mark this node as having generated children
          markNodeAsHavingChildren(currentDepth, bestChildIndex);
          
        } else {
          console.log("LLM-Agent: All scores are too low. Starting a new story.");
          await handleControlPressRef.current('Escape');
          await agentDelay();
          await handleControlPressRef.current('Enter');
        }
      }
    } catch (e) {
        console.error("LLM-Agent: Error in agent cycle:", e);
    } finally {
        isAgentRunning.current = false;
        console.log("LLM-Agent: --- Cycle finished ---");
    }
  }, [
    isEnabled,
    isGenerating,
    isScoring,
    currentDepth,
    selectedOptions,
    getCurrentPath,
    getOptionsAtDepth,
    scoreContinuation,
    getCacheKey,
    findHighestScoringUncle,
    navigateToPosition,
    markNodeAsHavingChildren,
  ]);
  
  useEffect(() => {
    if (agentTimeoutRef.current) {
      clearTimeout(agentTimeoutRef.current);
    }
    if (isEnabled && !isGenerating && !isScoring && !isAgentRunning.current) {
      console.log("LLM-Agent: Scheduling next cycle.");
      agentTimeoutRef.current = setTimeout(() => {
        runAgentCycle();
      }, 3000); // 3 second delay before acting
    }

    return () => {
      if (agentTimeoutRef.current) {
        clearTimeout(agentTimeoutRef.current);
      }
    };
  }, [isEnabled, isGenerating, isScoring, runAgentCycle]);
}