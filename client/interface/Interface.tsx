import { useCallback, useRef, useEffect, useState } from "react";

import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useMenuSystem } from "./hooks/useMenuSystem";
import { useStoryTree } from "./hooks/useStoryTree";
import { useOfflineStatus } from "./hooks/useOfflineStatus";

import { DPad } from "./components/DPad";
import { GamepadButton } from "./components/GamepadButton";
import { MenuButton } from "./components/MenuButton";
import { MenuScreen } from "./components/MenuScreen";
import { NavigationDots } from "./components/NavigationDots";
import { StoryMinimap } from "./components/StoryMinimap";
import { useTheme } from "./components/ThemeToggle";

import { SettingsMenu } from "./menus/SettingsMenu";
import { TreeListMenu } from "./menus/TreeListMenu";
import { EditMenu } from "./menus/EditMenu";
import { InstallPrompt } from "./components/InstallPrompt";
import ModeBar from "./components/ModeBar";
import { splitTextToNodes } from "./utils/textSplitter";
import {
  scrollToCurrentDepth,
  scrollToEndOfPath,
  scrollToSelectedSibling,
  scrollMenuItemIntoView,
  isAtBottom,
  createDebouncedScroll,
  SCROLL_DEBOUNCE_DELAY,
} from "./utils/scrolling";

import type { StoryNode } from "./types";
import type { ModelId } from "../../shared/models";

const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxTokens: 256,
  model: "meta-llama/llama-3.1-405b" as ModelId,
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

  // Create debounced scroll function
  const debouncedScroll = createDebouncedScroll(SCROLL_DEBOUNCE_DELAY);

  // (select menu navigation now handled in useMenuSystem)

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
    inFlight,
    generatingInfo,
    isGeneratingAt,
    isAnyGenerating,
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

      if (activeMenu === "map") {
        // In map mode, navigation and generation work normally
        if (key === "Backspace") {
          // B button exits map and goes to edit mode
          setActiveMenu("edit");
          return;
        } else if (key === "`") {
          // SELECT from map opens story list
          // Set selection to current story on open
          const keys = Object.keys(trees);
          const currentIndex = Math.max(0, keys.indexOf(currentTreeKey));
          setSelectedTreeIndex(currentIndex + 1); // +1 for "+ New Story"
          setActiveMenu("start");
          return;
        } else if (key === "Escape") {
          // START toggles map off back to reading
          setActiveMenu(null);
          return;
        }
        // Let arrow keys and Enter fall through to story navigation
      }

      if (activeMenu === "select") {
        handleMenuNavigation(key, trees, {
          onNewTree: handleNewTree,
          onSelectTree: (key) => {
            setCurrentTreeKey(key);
            setActiveMenu(null);
          },
          onDeleteTree: handleDeleteTree,
          currentTheme: theme,
          onThemeChange: setTheme,
        });
      } else if (activeMenu && activeMenu !== "map") {
        handleMenuNavigation(key, trees, {
          onNewTree: handleNewTree,
          onSelectTree: (key) => {
            setCurrentTreeKey(key);
            setActiveMenu(null);
          },
          onDeleteTree: handleDeleteTree,
        });
        // Allow START to back out from Trees to Map
        if (activeMenu === "start" && key === "Escape") {
          setActiveMenu("map");
          return;
        }
      } else {
        await handleStoryNavigation(key);
      }

      // Handle menu activation/deactivation with zoom-out flow
      if (key === "`") {
        // SELECT toggles Settings when not in map; keep last focused row
        if (activeMenu !== "map") {
          if (activeMenu === "select") {
            setActiveMenu(null);
          } else {
            setActiveMenu("select");
          }
        }
      } else if (key === "Escape" && !activeMenu) {
        // START toggles minimap on when reading
        setActiveMenu("map");
      } else if (key === "Escape" && activeMenu === "map") {
        // START toggles minimap off when in map
        setActiveMenu(null);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    const checkLayout = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const aspectRatio = clientWidth / clientHeight;
        setLayout(aspectRatio >= 1.33 ? "landscape" : "portrait");
      }
    };

    // Use ResizeObserver for more efficient layout checks
    const resizeObserver = new ResizeObserver(checkLayout);
    const currentContainer = containerRef.current;

    if (currentContainer) {
      resizeObserver.observe(currentContainer);
      checkLayout(); // Initial check
    }

    return () => {
      if (currentContainer) {
        resizeObserver.unobserve(currentContainer);
      }
    };
  }, []);

  // Helper: scroll a specific rendered node into view within the story container
  const scrollNodeIntoView = useCallback((nodeId: string | undefined | null) => {
    const container = storyTextRef.current;
    if (!container || !nodeId) return;
    const el = container.querySelector(
      `[data-node-id="${nodeId}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Scroll to current depth when navigation changes
  useEffect(() => {
    if (!activeMenu) {
      const path = getCurrentPath();
      const current = path[currentDepth];
      if (current) {
        debouncedScroll(() => scrollNodeIntoView(current.id));
      }
    }
  }, [currentDepth, getCurrentPath, debouncedScroll, activeMenu, scrollNodeIntoView]);

  // Scroll to selected sibling when left/right navigation changes
  useEffect(() => {
    if (!activeMenu) {
      const path = getCurrentPath();
      const next = path[currentDepth + 1];
      if (next) {
        debouncedScroll(() => scrollNodeIntoView(next.id));
      }
    }
  }, [
    selectedOptions,
    getCurrentPath,
    activeMenu,
    debouncedScroll,
    currentDepth,
    scrollNodeIntoView,
  ]);

  // Scroll to end when new content is added (after text splitting or generation)
  useEffect(() => {
    if (storyTextRef.current && !isAnyGenerating && !activeMenu) {
      const container = storyTextRef.current;
      const path = getCurrentPath();
      const wasAtBottom = isAtBottom(container);

      // If user was at bottom or near end, scroll to show new content
      if (wasAtBottom) {
        debouncedScroll(() => {
          scrollToEndOfPath(container, path, true);
        });
      }
    }
  }, [storyTree, isAnyGenerating, getCurrentPath, debouncedScroll]);

  // Removed LOOM scroll preservation to keep behavior simple and reliable

  const renderStoryText = () => {
    const currentPath = getCurrentPath();

    return (
      <div ref={storyTextRef} className="story-text">
        {currentPath.map((segment, index) => {
          const isCurrentDepth = index === currentDepth;
          const isNextDepth = index === currentDepth + 1;
          const isLoading = isGeneratingAt(segment.id);

          return (
            <span
              key={segment.id}
              data-node-id={segment.id}
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
      <div ref={containerRef} className={`container ${layout}`}>
        {/* Screen area */}
        <section className="terminal-screen" aria-label="Story Display">
          {/* Consistent top mode bar */}
          {activeMenu === null && (
            <ModeBar title="LOOM" hint="START: MAP • SELECT: SETTINGS" />
          )}
          {activeMenu === "map" && (
            <ModeBar title="MAP" hint="SELECT: STORIES • START: LOOM" />
          )}
          {activeMenu === "select" ? (
            <>
              <ModeBar title="SETTINGS" hint="START: CLOSE" />
              <MenuScreen
                title=""
                showCloseInstructions={false}
                onClose={() => setActiveMenu(null)}
              >
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
                isLoading={isAnyGenerating}
              />
              </MenuScreen>
            </>
          ) : activeMenu === "map" ? (
            <StoryMinimap
              tree={storyTree}
              currentDepth={currentDepth}
              selectedOptions={selectedOptions}
              currentPath={getCurrentPath()}
              inFlight={inFlight}
              generatingInfo={generatingInfo}
            />
          ) : activeMenu === "start" ? (
            <>
              <ModeBar title="STORIES" hint="↵: SELECT • ⌫: DELETE • START: MAP" />
              <MenuScreen
                title=""
                showCloseInstructions={false}
                onClose={() => setActiveMenu(null)}
              >
              <TreeListMenu
                trees={trees}
                selectedIndex={selectedTreeIndex}
                onSelect={(key) => {
                  setCurrentTreeKey(key);
                  setActiveMenu(null);
                }}
                onNew={() => {
                  handleNewTree();
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
            </>
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

                  // Scroll to the end of the updated content after text splitting
                  setTimeout(() => {
                    if (storyTextRef.current) {
                      const container = storyTextRef.current;
                      const path = getCurrentPath();
                      scrollToEndOfPath(container, path, true);
                    }
                  }, 100);
                }}
                onCancel={() => setActiveMenu(null)}
              />
            </MenuScreen>
          ) : null}

          {/* Keep LOOM mounted; hide when a menu is active. Use display: contents to preserve flex context */}
          <div style={{ display: activeMenu ? "none" : ("contents" as const) }}>
            {renderStoryText()}
            <NavigationDots
              options={getOptionsAtDepth(currentDepth)}
              currentDepth={currentDepth}
              selectedOptions={selectedOptions}
              activeControls={activeControls}
              inFlight={inFlight}
              generatingInfo={generatingInfo}
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
          </div>
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
                disabled={
                  isOffline ||
                  isGeneratingAt(getCurrentPath()[currentDepth]?.id)
                }
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
