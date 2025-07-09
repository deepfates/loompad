import { useCallback, useRef, useEffect, useState } from "react";
import "./terminal-custom.css";

// Helper function to generate unique node IDs (same as in useStoryTree)
const generateNodeId = (prefix: string = 'node') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useMenuSystem } from "./hooks/useMenuSystem";
import { useStoryTree } from "./hooks/useStoryTree";
import { useModels } from "./hooks/useModels";
import { useGardenStore } from "./stores/gardenStore";

import { DPad } from "./components/DPad";
import { GamepadButton, ShoulderButton } from "./components/GamepadButton";
import { MenuButton } from "./components/MenuButton";
import { MenuScreen } from "./components/MenuScreen";
import { NavigationDots } from "./components/NavigationDots";
import { MetadataPanel } from "./components/MetadataPanel";
import GardenVisualizer from "./components/GardenVisualizer";
import { ControlsModal } from "./components/ControlsModal";

import { SettingsMenu } from "./menus/SettingsMenu";
import { TreeListMenu } from "./menus/TreeListMenu";
import { EditMenu } from "./menus/EditMenu";
import { ModelManagementMenu } from "./menus/ModelManagementMenu";

import type { StoryNode } from "./types";
import type { ModelId } from "../../server/apis/generation";

const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxTokens: 100,
  model: "llama-3.1-405b-base" as ModelId,
  generationCount: 3,
};

const EMPTY_STORY = {
  root: {
    id: "root",
    text: "Once upon a time...",
    continuations: [],
  },
};

const GamepadInterface = () => {
  const { models, getModelName } = useModels();
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsModalOpen, setIsControlsModalOpen] = useState(false);
  
  // Garden store integration
  const { syncWithStoryTrees, setGenerating, selectedNode, getPathFromRoot } = useGardenStore();
  
  const {
    activeMenu,
    setActiveMenu,
    selectedParam,
    setSelectedParam,
    selectedTreeIndex,
    setSelectedTreeIndex,
    selectedModelIndex,
    setSelectedModelIndex,
    menuParams,
    setMenuParams,
    handleMenuNavigation,
  } = useMenuSystem(DEFAULT_PARAMS);

  const handleModelChange = useCallback((newModel: ModelId) => {
    setMenuParams((prev) => ({
      ...prev,
      model: newModel,
      // Adjust maxTokens if it exceeds the new model's limit
      maxTokens: models?.[newModel]?.maxTokens 
        ? Math.min(prev.maxTokens, models[newModel].maxTokens)
        : prev.maxTokens,
    }));
  }, [models, setMenuParams]);

  const {
    trees,
    currentTreeKey,
    storyTree,
    currentDepth,
    selectedOptions,
    generatingAt,
    isGenerating,
    error,
    handleStoryNavigation,
    setCurrentTreeKey,
    getCurrentPath,
    getOptionsAtDepth,
    setTrees,
    setStoryTree,
    setSelectedOptions,
    setCurrentDepth,
  } = useStoryTree(menuParams, handleModelChange);

  // Sync garden store with story trees
  useEffect(() => {
    syncWithStoryTrees(trees);
  }, [trees, syncWithStoryTrees]);

  // Sync generation state
  useEffect(() => {
    setGenerating(isGenerating);
  }, [isGenerating, setGenerating]);

  // Sync story switching with garden store
  useEffect(() => {
    if (currentTreeKey && trees[currentTreeKey]) {
      // When story is switched, update the garden store
      const currentStoryTree = trees[currentTreeKey];
      if (currentStoryTree && currentStoryTree.root) {
        console.log('🔄 Story switched, updating garden store:', {
          storyKey: currentTreeKey,
          rootNodeId: currentStoryTree.root.id,
          rootText: currentStoryTree.root.text.slice(0, 50)
        });
        
        // Sync the story trees to update garden store
        syncWithStoryTrees(trees);
        
        // Find and select the corresponding garden tree
        const gardenStore = useGardenStore.getState();
        const gardenTree = gardenStore.trees.find(t => t.name === currentTreeKey);
        if (gardenTree) {
          gardenStore.selectTree(gardenTree.id);
          gardenStore.selectNode(currentStoryTree.root.id);
        }
      }
    }
  }, [currentTreeKey, trees, syncWithStoryTrees]);

  const storyTextRef = useRef<HTMLDivElement>(null);

  const getCurrentNode = useCallback(() => {
    // If there's a selected node from the garden store, use that
    // Otherwise, fall back to the text interface's current node
    if (selectedNode && selectedNode.id) {
      return selectedNode;
    }
    
    const path = getCurrentPath();
    return path[currentDepth] || storyTree.root;
  }, [getCurrentPath, currentDepth, selectedNode]);

  const getCurrentNodeDepth = useCallback(() => {
    // If there's a selected node from the garden store, calculate its depth
    if (selectedNode && selectedNode.id) {
      const path = getPathFromRoot(selectedNode.id);
      return path.length - 1; // Depth is 0-based
    }
    
    // Otherwise, use the text interface's current depth
    return currentDepth;
  }, [selectedNode, getPathFromRoot, currentDepth]);

  // Sync selected node with garden store
  const lastSelectedNodeId = useRef<string | null>(null);
  useEffect(() => {
    const path = getCurrentPath();
    const currentNode = path[currentDepth] || storyTree.root;
    if (currentNode && currentNode.id && currentNode.id !== lastSelectedNodeId.current) {
      lastSelectedNodeId.current = currentNode.id;
      console.log('🔄 Text Interface -> Garden Store: Selecting node:', {
        nodeId: currentNode.id,
        nodeText: currentNode.text.slice(0, 50),
        currentDepth,
        selectedOptions,
        pathLength: path.length
      });
      useGardenStore.getState().selectNode(currentNode.id);
    }
  }, [currentDepth, selectedOptions, getCurrentPath, storyTree.root]);

  // Sync garden store selectedNode back to text interface
  const lastGardenSelectedNodeId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedNode && selectedNode.id && selectedNode.id !== lastGardenSelectedNodeId.current) {
      lastGardenSelectedNodeId.current = selectedNode.id;
      console.log('🔄 Garden Store -> Text Interface: Node selected in visualizer:', {
        nodeId: selectedNode.id,
        nodeText: selectedNode.text?.slice(0, 50),
        currentTreeKey
      });
      
      // Find the node in all story trees and navigate to it
      const findNodeInTree = (node: StoryNode, targetId: string, path: StoryNode[] = []): StoryNode[] | null => {
        const currentPath = [...path, node];
        
        if (node.id === targetId) {
          return currentPath;
        }
        
        if (node.continuations) {
          for (const child of node.continuations) {
            const result = findNodeInTree(child, targetId, currentPath);
            if (result) return result;
          }
        }
        
        return null;
      };
      
      // First try to find the node in the current story tree
      let pathToNode = findNodeInTree(storyTree.root, selectedNode.id);
      let targetTreeKey = currentTreeKey;
      
      // If not found in current story, search through all stories
      if (!pathToNode) {
        for (const [treeKey, treeData] of Object.entries(trees)) {
          if (treeKey !== currentTreeKey) {
            pathToNode = findNodeInTree(treeData.root, selectedNode.id);
            if (pathToNode) {
              targetTreeKey = treeKey;
              console.log('🔄 Garden Store -> Text Interface: Node found in different story:', {
                nodeId: selectedNode.id,
                targetTreeKey,
                currentTreeKey
              });
              break;
            }
          }
        }
      }
      
      if (pathToNode) {
        // If the node is in a different story, switch to that story first
        if (targetTreeKey !== currentTreeKey) {
          console.log('🔄 Garden Store -> Text Interface: Switching to story:', targetTreeKey);
          setCurrentTreeKey(targetTreeKey);
        }
        
        // Navigate to the selected node by updating depth and selectedOptions
        const newDepth = pathToNode.length - 1;
        const newSelectedOptions: number[] = [];
        
        // Calculate selectedOptions based on the path TO the selected node
        // This gives us the path from root to the selected node
        for (let i = 1; i < pathToNode.length; i++) {
          const parentNode = pathToNode[i - 1];
          const currentNode = pathToNode[i];
          
          if (parentNode.continuations) {
            const index = parentNode.continuations.findIndex(child => child.id === currentNode.id);
            if (index !== -1) {
              newSelectedOptions.push(index);
            }
          }
        }
        
        // Ensure the selectedOptions array has the correct length for the new depth
        // The array should have values for depths 0 to newDepth-1
        while (newSelectedOptions.length < newDepth) {
          newSelectedOptions.push(0); // Default to first option for missing depths
        }
        
        // Update depth and preserve existing selectedOptions for depths up to newDepth
        setCurrentDepth(newDepth);
        
        // Preserve existing selectedOptions for depths 0 to newDepth-1
        // Only update if the newSelectedOptions are different from current
        setSelectedOptions(prev => {
          const updated = [...prev];
          // Update only the depths that are in the path to the selected node
          for (let i = 0; i < newSelectedOptions.length && i < newDepth; i++) {
            updated[i] = newSelectedOptions[i];
          }
          return updated;
        });
      }
    }
  }, [selectedNode, storyTree.root, trees, currentTreeKey, setCurrentDepth, setSelectedOptions, setCurrentTreeKey]);

  const handleNewTree = useCallback(() => {
    const newKey = `Story ${Object.keys(trees).length + 1}`;
    setTrees((prev) => ({
      ...prev,
      [newKey]: EMPTY_STORY,
    }));
    setCurrentTreeKey(newKey);
    setActiveMenu(null);
  }, [trees, setTrees, setCurrentTreeKey, setActiveMenu]);

  const handleDeleteTree = useCallback(
    (key: string) => {
      if (window.confirm(`Are you sure you want to delete "${key}"?`)) {
        setTrees((prev) => {
          const newTrees = { ...prev };
          delete newTrees[key];
          return newTrees;
        });

        // If we deleted the current tree, switch to another one
        if (key === currentTreeKey) {
          const remainingKeys = Object.keys(trees);
          if (remainingKeys.length > 0) {
            setCurrentTreeKey(remainingKeys[0]);
          }
        }
      }
    },
    [currentTreeKey, trees, setTrees, setCurrentTreeKey]
  );

  const handleExportData = useCallback(() => {
    const dataToExport = localStorage.getItem("story-trees");
    if (dataToExport) {
      const blob = new Blob([dataToExport], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loompad-stories-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setActiveMenu(null);
  }, [setActiveMenu]);

  const handleImportData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = e.target?.result as string;
            const parsedData = JSON.parse(importedData);
            
            // Validate the data structure
            if (typeof parsedData === "object" && parsedData !== null) {
              // Merge with existing trees or replace
              const shouldReplace = window.confirm(
                "Replace all existing stories with imported data? Click Cancel to merge instead."
              );
              
              if (shouldReplace) {
                setTrees(parsedData);
                localStorage.setItem("story-trees", importedData);
              } else {
                setTrees((prev) => {
                  const merged = { ...prev, ...parsedData };
                  localStorage.setItem("story-trees", JSON.stringify(merged));
                  return merged;
                });
              }
              
              // Switch to the first imported tree
              const importedKeys = Object.keys(parsedData);
              if (importedKeys.length > 0) {
                setCurrentTreeKey(importedKeys[0]);
              }
            } else {
              alert("Invalid file format. Please select a valid JSON file.");
            }
          } catch (error) {
            alert("Failed to parse JSON file. Please check the file format.");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
    setActiveMenu(null);
  }, [setTrees, setCurrentTreeKey, setActiveMenu]);

  const handleControlAction = useCallback(
    async (key: string) => {
      if (activeMenu === "edit") {
        // EditMenu handles its own keyboard events through multiple listeners
        // No need to dispatch events here, just return to avoid interference
        return;
      }

      if (activeMenu) {
        handleMenuNavigation(key, trees, {
          onNewTree: handleNewTree,
          onSelectTree: (key) => {
            setCurrentTreeKey(key);
            setActiveMenu(null);
            setSelectedTreeIndex(0);
          },
          onDeleteTree: handleDeleteTree,
          onExportData: handleExportData,
          onImportData: handleImportData,
          onModelAction: (action, modelId) => {
            // Forward the action to trigger the ModelManagementMenu's internal logic
            if (action === "add") {
              // Trigger add model action by calling the component's onAction prop
              // But we need to make the component handle this internally
              console.log("Add model action triggered");
            } else if (action === "edit" && modelId) {
              console.log("Edit model action triggered:", modelId);
            } else if (action === "delete" && modelId) {
              console.log("Delete model action triggered:", modelId);
            }
          },
        });
      } else {
        // Pass available models for L/R button switching
        const availableModels = models ? Object.keys(models) : [];
        await handleStoryNavigation(key, availableModels);
      }

      // Handle menu activation/deactivation
      if (key === "`" || key === "z" || key === "Z") {
        setActiveMenu((prev) => (prev === "select" ? null : "select"));
      } else if ((key === "Escape" || key === "m" || key === "M") && !activeMenu) {
        setActiveMenu((prev) => (prev === "start" ? null : "start"));
      } else if (key === "Backspace" && !activeMenu) {
        const currentNode = getCurrentPath()[currentDepth];
        // Prevent editing empty branching root nodes
        if (!currentNode.text || currentNode.text.trim() === "") {
          return;
        }
        setActiveMenu("edit");
      }
    },
    [
      activeMenu,
      trees,
      models,
      handleMenuNavigation,
      handleNewTree,
      handleDeleteTree,
      handleStoryNavigation,
      setCurrentTreeKey,
      setActiveMenu,
      setSelectedTreeIndex,
      handleExportData,
      handleImportData,
    ]
  );

  const { activeControls, handleControlPress, handleControlRelease } =
    useKeyboardControls(handleControlAction);

  // Scroll to next depth (highlighted text)
  useEffect(() => {
    if (storyTextRef.current) {
      const storyContainer = storyTextRef.current;
      const text = storyContainer.textContent || "";
      const path = getCurrentPath();

      // Calculate the position to scroll to the next depth (highlighted text)
      let position = 0;
      for (let i = 0; i <= currentDepth; i++) {
        position += path[i].text.length;
      }

      // Create a temporary span to measure the position
      const temp = document.createElement("span");
      temp.style.whiteSpace = "pre-wrap";
      temp.textContent = text.substring(0, position);
      document.body.appendChild(temp);
      const scrollPosition = temp.offsetHeight;
      document.body.removeChild(temp);

      // Scroll to show the highlighted text with some padding
      storyContainer.scrollTop = scrollPosition - 60;
    }
  }, [currentDepth, getCurrentPath]);

  const renderStoryText = () => {
    const currentPath = getCurrentPath();

    return (
      <div ref={storyTextRef} className="story-text">
        {currentPath.map((segment, index) => {
          const isCurrentDepth = index === currentDepth;
          const isNextDepth = index === currentDepth + 1;
          const isLoading = generatingAt?.depth === index;

          return (
            <span
              key={segment.id}
              style={{
                color: isCurrentDepth
                  ? "var(--font-color)"
                  : isNextDepth
                  ? "var(--primary-color)"
                  : "var(--secondary-color)",
              }}
              className={isLoading ? "opacity-50" : ""}
              title={segment.generatedByModel ? `Generated by: ${getModelName(segment.generatedByModel)}` : undefined}
            >
              {segment.text}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <main className={`terminal ${isFullscreen ? 'fullscreen' : ''}`} aria-label="Story Interface">
      <div className={`container ${isFullscreen ? 'fullscreen' : ''}`}>
        {/* Screen area */}
        <section className={`terminal-screen ${isFullscreen ? 'fullscreen' : ''}`} aria-label="Story Display">
          {activeMenu === "select" ? (
            <MenuScreen title="Settings" onClose={() => setActiveMenu(null)}>
              <SettingsMenu
                params={menuParams}
                onParamChange={(param, value) =>
                  setMenuParams((prev) => ({ ...prev, [param]: value }))
                }
                selectedParam={selectedParam}
                isLoading={isGenerating}
                onManageModels={() => {
                  setActiveMenu("models");
                  setSelectedModelIndex(0);
                }}
                onExportData={handleExportData}
                onImportData={handleImportData}
              />
            </MenuScreen>
          ) : activeMenu === "models" ? (
            <MenuScreen title="Manage Models" onClose={() => setActiveMenu("select")}>
              <ModelManagementMenu
                selectedIndex={selectedModelIndex}
                onNavigate={(direction) => {
                  if (direction === "up") {
                    setSelectedModelIndex((prev) => Math.max(0, prev - 1));
                  } else {
                    const modelEntries = models ? Object.entries(models) : [];
                    const totalItems = modelEntries.length + 1;
                    setSelectedModelIndex((prev) => Math.min(totalItems - 1, prev + 1));
                  }
                }}
                onAction={(action, modelId) => {
                  // This is handled internally by ModelManagementMenu
                  // Just log for debugging
                  console.log("Model action from component:", action, modelId);
                }}
              />
            </MenuScreen>
          ) : activeMenu === "start" ? (
            <MenuScreen title="Trees" onClose={() => setActiveMenu(null)}>
              <TreeListMenu
                trees={trees}
                selectedIndex={selectedTreeIndex}
                onSelect={(key) => {
                  setCurrentTreeKey(key);
                  setActiveMenu(null);
                  setSelectedTreeIndex(0);
                }}
                onNew={() => {
                  handleNewTree();
                  setSelectedTreeIndex(0);
                }}
                onDelete={(key) => {
                  handleDeleteTree(key);
                  // Adjust selected index if needed
                  if (selectedTreeIndex > 0) {
                    setSelectedTreeIndex((prev) =>
                      Math.min(prev, Object.keys(trees).length - 1)
                    );
                  }
                }}
              />
            </MenuScreen>
          ) : activeMenu === "edit" ? (
            <MenuScreen
              title=""
              onClose={() => setActiveMenu(null)}
              showCloseInstructions={false}
            >
              <EditMenu
                node={getCurrentPath()[currentDepth]}
                onSave={(text) => {
                  const newTree = JSON.parse(JSON.stringify(storyTree)) as {
                    root: StoryNode;
                  };
                  let current = newTree.root;
                  let parent = null;

                  // Navigate to the node being edited
                  for (let i = 1; i <= currentDepth; i++) {
                    if (!current.continuations) break;
                    parent = current;
                    const selectedIndex = selectedOptions[i - 1];
                    if (selectedIndex >= 0 && selectedIndex < current.continuations.length) {
                      current = current.continuations[selectedIndex];
                    } else {
                      console.error("Invalid navigation path", { selectedOptions, currentDepth, selectedIndex, continuationsLength: current.continuations?.length });
                      return;
                    }
                  }

                  // Ensure we have a valid current node
                  if (!current) {
                    console.error("Failed to navigate to current node", { selectedOptions, currentDepth });
                    return;
                  }

                  // Check if the current node has existing children
                  const hasExistingChildren = current.continuations && current.continuations.length > 0;
                  
                  if (hasExistingChildren && current.text !== text) {
                    // Create a new sibling node with the edited text
                    const newSibling: StoryNode = {
                      id: generateNodeId('node'),
                      text: text,
                      continuations: [],
                      // Mark as edited if the original was generated content
                      ...(current.generationMetadata && { isEdited: true })
                    };
                    
                    if (currentDepth === 0) {
                      // Root node: create a branching structure with original and edited versions
                      const originalRoot = { ...current };
                      const newRoot = {
                        id: generateNodeId('root'),
                        text: text,
                        continuations: [],
                        // Mark as edited if the original was generated content
                        ...(current.generationMetadata && { isEdited: true })
                      };
                      
                      // Create a new root that branches to both versions
                      current.text = ""; // Empty text for branching root
                      current.continuations = [originalRoot, newRoot];
                      
                      // Select the new version (second option)
                      const newSelectedOptions = [1];
                      setSelectedOptions(newSelectedOptions);
                      setCurrentDepth(1);
                    } else if (parent && parent.continuations) {
                      // Add the new sibling to the parent's continuations
                      parent.continuations.push(newSibling);
                      
                      // Update selectedOptions to point to the new sibling
                      const newSelectedOptions = [...selectedOptions];
                      newSelectedOptions[currentDepth - 1] = parent.continuations.length - 1;
                      setSelectedOptions(newSelectedOptions);
                    }
                  } else {
                    // No existing children, or text unchanged - just update the text
                    const textChanged = current.text !== text;
                    current.text = text;
                    // Mark as edited if this was originally generated content and text actually changed
                    if (current.generationMetadata && textChanged) {
                      current.isEdited = true;
                    }
                  }
                  
                  setStoryTree(newTree);
                  // Update the trees storage
                  setTrees((prev) => ({
                    ...prev,
                    [currentTreeKey]: newTree,
                  }));
                  setActiveMenu(null);
                }}
                onCancel={() => setActiveMenu(null)}
              />
            </MenuScreen>
          ) : (
            <>
              <div className="story-content">
                {renderStoryText()}
                <NavigationDots
                  options={getOptionsAtDepth(currentDepth)}
                  currentDepth={currentDepth}
                  selectedOptions={selectedOptions}
                  activeControls={activeControls}
                  generatingAt={generatingAt}
                  generationCount={menuParams.generationCount}
                />
                {error && (
                  <output className="error-message">
                    Generation error: {error.message}
                  </output>
                )}
              </div>
              <GardenVisualizer
                showMeshGrid={true}
                showAxis={false}
                currentDepth={currentDepth}
                selectedOptions={selectedOptions}
              />
            </>
          )}

          {/* Metadata panel - only show when not in a menu */}
          {!activeMenu && (
            <MetadataPanel
              currentNode={getCurrentNode()}
              currentDepth={getCurrentNodeDepth()}
              totalDepth={getCurrentPath().length}
              selectedOptions={selectedOptions}
              isExpanded={isMetadataExpanded}
              onToggle={() => setIsMetadataExpanded(!isMetadataExpanded)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            />
          )}
        </section>

        {/* Controls */}
        <div className="terminal-controls" aria-label="Game Controls">
          {/* Shoulder buttons and model display */}
          <div className="controls-shoulders">
            <ShoulderButton
              label="L"
              active={activeControls.l}
              onMouseDown={() => handleControlPress("q")}
              onMouseUp={() => handleControlRelease("q")}
            />
            <div className="model-display">
              {currentTreeKey || "No Story"}
            </div>
            <ShoulderButton
              label="R"
              active={activeControls.r}
              onMouseDown={() => handleControlPress("e")}
              onMouseUp={() => handleControlRelease("e")}
            />
          </div>

          <div className="controls-top">
            <DPad
              activeDirection={activeControls.direction}
              onControlPress={handleControlPress}
              onControlRelease={handleControlRelease}
            />
            <div className="terminal-buttons">
              <GamepadButton
                label="B"
                active={activeControls.b}
                onMouseDown={() => handleControlPress("Backspace")}
                onMouseUp={() => handleControlRelease("Backspace")}
              />
              <GamepadButton
                label="A"
                active={activeControls.a}
                onMouseDown={() => handleControlPress("Enter")}
                onMouseUp={() => handleControlRelease("Enter")}
              />
            </div>
          </div>

          <div className="terminal-menu">
            <MenuButton
              label="SELECT"
              active={activeControls.select}
              onMouseDown={() => handleControlPress("`")}
              onMouseUp={() => handleControlRelease("`")}
            />
            <MenuButton
              label="START"
              active={activeControls.start}
              onMouseDown={() => handleControlPress("Escape")}
              onMouseUp={() => handleControlRelease("Escape")}
            />
            <MenuButton
              label="HELP"
              active={false}
              onMouseDown={() => setIsControlsModalOpen(true)}
              onMouseUp={() => {}}
            />
          </div>
        </div>
      </div>
      
      <ControlsModal 
        isOpen={isControlsModalOpen}
        onClose={() => setIsControlsModalOpen(false)}
      />
    </main>
  );
};

export default GamepadInterface;
