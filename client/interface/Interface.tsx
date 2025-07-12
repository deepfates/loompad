import { useCallback, useRef, useEffect } from "react";
import "./terminal-custom.css";

import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useMenuSystem } from "./hooks/useMenuSystem";
import { useStoryTree } from "./hooks/useStoryTree";
import { useOfflineStatus } from "./hooks/useOfflineStatus";

import { DPad } from "./components/DPad";
import { GamepadButton } from "./components/GamepadButton";
import { MenuButton } from "./components/MenuButton";
import { MenuScreen } from "./components/MenuScreen";
import { NavigationDots } from "./components/NavigationDots";
import { useTheme } from "./components/ThemeToggle";

import { SettingsMenu } from "./menus/SettingsMenu";
import { TreeListMenu } from "./menus/TreeListMenu";
import { EditMenu } from "./menus/EditMenu";
import { InstallPrompt } from "./components/InstallPrompt";
import { splitTextToNodes } from "./utils/textSplitter";

import type { StoryNode } from "./types";
import type { ModelId } from "../../server/apis/generation";

const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxTokens: 256,
  model: "deepseek/deepseek-v3-base:free" as ModelId,
  textSplitting: true,
};

const EMPTY_STORY = {
  root: {
    id: "root",
    text: "Once upon a time...",
    continuations: [],
  },
};

const GamepadInterface = () => {
  const { isOnline, isOffline, wasOffline } = useOfflineStatus();
  const { theme, setTheme } = useTheme();

  const {
    activeMenu,
    setActiveMenu,
    selectedParam,
    setSelectedParam,
    selectedTreeIndex,
    setSelectedTreeIndex,
    menuParams,
    setMenuParams,
    handleMenuNavigation,
  } = useMenuSystem(DEFAULT_PARAMS);

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
  } = useStoryTree(menuParams);

  const storyTextRef = useRef<HTMLDivElement>(null);

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
    [currentTreeKey, trees, setTrees, setCurrentTreeKey],
  );

  const handleControlAction = useCallback(
    async (key: string) => {
      if (activeMenu === "edit") {
        // Let EditMenu handle keyboard events, but also handle button clicks
        if (key === "Escape" || key === "`") {
          // Simulate keyboard event for the EditMenu
          window.dispatchEvent(new KeyboardEvent("keydown", { key }));
        }
        return;
      }

      if (activeMenu === "select") {
        // Custom handling for settings menu including theme
        if (key === "ArrowUp") {
          setSelectedParam((prev) => Math.max(0, prev - 1));
        } else if (key === "ArrowDown") {
          setSelectedParam((prev) => Math.min(4, prev + 1));
        } else if (key === "ArrowLeft" || key === "ArrowRight") {
          const direction = key === "ArrowRight" ? 1 : -1;

          if (selectedParam === 3) {
            // Theme parameter
            const themes = ["matrix", "light", "system"] as const;
            const currentIndex = themes.indexOf(theme);
            const newIndex =
              direction > 0
                ? (currentIndex + 1) % themes.length
                : (currentIndex - 1 + themes.length) % themes.length;
            setTheme(themes[newIndex]);
          } else if (selectedParam === 4) {
            // Text Splitting parameter
            setMenuParams((prev) => ({
              ...prev,
              textSplitting: !prev.textSplitting,
            }));
          } else {
            // Regular menu parameters - delegate to existing handler
            handleMenuNavigation(key, trees, {
              onNewTree: handleNewTree,
              onSelectTree: (key) => {
                setCurrentTreeKey(key);
                setActiveMenu(null);
                setSelectedTreeIndex(0);
              },
              onDeleteTree: handleDeleteTree,
            });
          }
        }
      } else if (activeMenu) {
        handleMenuNavigation(key, trees, {
          onNewTree: handleNewTree,
          onSelectTree: (key) => {
            setCurrentTreeKey(key);
            setActiveMenu(null);
            setSelectedTreeIndex(0);
          },
          onDeleteTree: handleDeleteTree,
        });
      } else {
        await handleStoryNavigation(key);
      }

      // Handle menu activation/deactivation
      if (key === "`") {
        setActiveMenu((prev) => (prev === "select" ? null : "select"));
      } else if (key === "Escape" && !activeMenu) {
        setActiveMenu((prev) => (prev === "start" ? null : "start"));
      } else if (key === "Backspace" && !activeMenu) {
        setActiveMenu("edit");
      }
    },
    [
      activeMenu,
      trees,
      handleMenuNavigation,
      handleNewTree,
      handleDeleteTree,
      handleStoryNavigation,
      setCurrentTreeKey,
      setActiveMenu,
      setSelectedTreeIndex,
    ],
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
      for (let i = 0; i < currentDepth; i++) {
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
            >
              {segment.text}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <main className="terminal" aria-label="Story Interface">
      <InstallPrompt />
      <div className="container">
        {/* Screen area */}
        <section className="terminal-screen" aria-label="Story Display">
          {activeMenu === "select" ? (
            <MenuScreen title="Settings" onClose={() => setActiveMenu(null)}>
              <SettingsMenu
                params={{ ...menuParams, theme }}
                onParamChange={(param, value) => {
                  if (param === "theme") {
                    setTheme(value as "matrix" | "light" | "system");
                  } else {
                    setMenuParams((prev) => ({ ...prev, [param]: value }));
                  }
                }}
                selectedParam={selectedParam}
                isLoading={isGenerating}
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
                      Math.min(prev, Object.keys(trees).length - 1),
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

                  for (let i = 1; i <= currentDepth; i++) {
                    if (!current.continuations) break;
                    current = current.continuations[selectedOptions[i - 1]];
                  }

                  // Conditionally split the edited text based on settings
                  if (menuParams.textSplitting) {
                    const nodeChain = splitTextToNodes(text);

                    if (nodeChain) {
                      // Replace current node with the head of the chain
                      current.text = nodeChain.text;

                      // Preserve existing continuations by attaching them to the end of the chain
                      const existingContinuations = current.continuations || [];

                      // Walk to the end of the new chain
                      let chainEnd = nodeChain;
                      while (
                        chainEnd.continuations &&
                        chainEnd.continuations.length > 0
                      ) {
                        chainEnd = chainEnd.continuations[0];
                      }

                      // Attach existing continuations to the end of the chain
                      chainEnd.continuations = existingContinuations;

                      // Replace the current node's continuations with the new chain
                      current.continuations = nodeChain.continuations;
                      if (nodeChain.lastSelectedIndex !== undefined) {
                        current.lastSelectedIndex = nodeChain.lastSelectedIndex;
                      }
                    } else {
                      // Fallback to simple text replacement if splitting fails
                      current.text = text;
                    }
                  } else {
                    // Simple text replacement when splitting is disabled
                    current.text = text;
                  }

                  setStoryTree(newTree);
                  setActiveMenu(null);
                }}
                onCancel={() => setActiveMenu(null)}
              />
            </MenuScreen>
          ) : (
            <>
              {renderStoryText()}
              <NavigationDots
                options={getOptionsAtDepth(currentDepth)}
                currentDepth={currentDepth}
                selectedOptions={selectedOptions}
                activeControls={activeControls}
                generatingAt={generatingAt}
              />
              {isOffline && (
                <output className="offline-message">
                  ⚡ Offline - Stories saved locally, generation unavailable
                </output>
              )}
              {error && (
                <output className="error-message">
                  Generation error: {error.message}
                </output>
              )}
            </>
          )}
        </section>

        {/* Controls */}
        <div className="terminal-controls" aria-label="Game Controls">
          <div className="controls-top">
            <DPad
              activeDirection={activeControls.direction}
              onControlPress={handleControlPress}
              onControlRelease={handleControlRelease}
            />
            <div className="terminal-buttons">
              <GamepadButton
                label="⌫"
                active={activeControls.b}
                onMouseDown={() => handleControlPress("Backspace")}
                onMouseUp={() => handleControlRelease("Backspace")}
              />
              <GamepadButton
                label="↵"
                active={activeControls.a}
                onMouseDown={() => handleControlPress("Enter")}
                onMouseUp={() => handleControlRelease("Enter")}
                disabled={isOffline}
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
          </div>
        </div>
      </div>
    </main>
  );
};

export default GamepadInterface;
