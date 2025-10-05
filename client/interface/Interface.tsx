import { useCallback, useRef, useEffect, useState, useMemo } from "react";

import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useMenuSystem } from "./hooks/useMenuSystem";
import { useStoryTree, INITIAL_STORY } from "./hooks/useStoryTree";
import { useOfflineStatus } from "./hooks/useOfflineStatus";
import { useScrollSync } from "./hooks/useScrollSync";

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
import { scrollElementIntoViewIfNeeded, isAtBottom } from "./utils/scrolling";

import type { StoryNode, MenuType } from "./types";
import type { ModelId } from "../../shared/models";
import { DEFAULT_LENGTH_MODE } from "../../shared/lengthPresets";
import {
  orderKeysReverseChronological,
  getDefaultStoryKey,
  getStoryMeta,
  setStoryMeta,
  touchStoryUpdated,
  touchStoryActive,
} from "./utils/storyMeta";

const DEFAULT_PARAMS = {
  temperature: 0.7,
  lengthMode: DEFAULT_LENGTH_MODE,
  model: "meta-llama/llama-3.1-405b" as ModelId,
  textSplitting: true,
};

export const GamepadInterface = () => {
  const { isOnline, isOffline, wasOffline } = useOfflineStatus();
  const { theme, setTheme } = useTheme();
  const [lastMapNodeId, setLastMapNodeId] = useState<string | null>(null);
  const [pendingNewNode, setPendingNewNode] = useState<
    | {
        depth: number;
        pathIds: string[];
        draft: StoryNode;
      }
    | null
  >(null);

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
    setSelectionByPath,
    createSiblingNode,
  } = useStoryTree(menuParams);

  // Compute reverse-chronologically ordered trees for menus
  const orderedKeys = useMemo(
    () => orderKeysReverseChronological(trees),
    [trees],
  );
  // Use orderedKeys directly where needed; no reordered trees object required

  // On first load, default to the most recently active story (if any)
  const hasAppliedDefault = useRef(false);

  useEffect(() => {
    if (hasAppliedDefault.current) return;
    const keys = Object.keys(trees);
    if (!keys.length) return;
    const preferred = getDefaultStoryKey(trees) ?? orderedKeys[0];
    if (preferred && currentTreeKey !== preferred) {
      setCurrentTreeKey(preferred);
    }
    if (preferred) touchStoryActive(preferred);
    hasAppliedDefault.current = true;
  }, [trees, orderedKeys, currentTreeKey, setCurrentTreeKey]);

  // Calculate current highlighted node for map
  const highlightedNode = useMemo(() => {
    let node = storyTree.root;
    for (let depth = 0; depth < currentDepth; depth++) {
      const idx = selectedOptions[depth];
      const child = node.continuations?.[idx];
      if (!child) break;
      node = child;
    }
    return node;
  }, [storyTree, currentDepth, selectedOptions]);

  const storyTextRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { queueScroll, cancel } = useScrollSync({
    containerRef: storyTextRef,
    prefersReducedMotion,
    padding: 8,
  });

  const handleNewTree = useCallback(() => {
    const newKey = `Story ${Object.keys(trees).length + 1}`;
    setTrees((prev) => ({
      ...prev,
      [newKey]: INITIAL_STORY,
    }));
    touchStoryActive(newKey);
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
        {
          const meta = getStoryMeta();
          if (meta[key]) {
            delete meta[key];
            setStoryMeta(meta);
          }
        }

        // If we deleted the current tree, switch to another one
        if (key === currentTreeKey) {
          const remaining = orderKeysReverseChronological(trees).filter(
            (k) => k !== key,
          );
          if (remaining.length > 0) {
            setCurrentTreeKey(remaining[0]);
            touchStoryActive(remaining[0]);
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
          setLastMapNodeId(highlightedNode.id);
          setPendingNewNode(null);
          setActiveMenu("edit");
          return;
        } else if (key === "`") {
          // SELECT from map opens story list
          // Set selection to current story on open (reverse-chronological order)
          const currentIndex = Math.max(0, orderedKeys.indexOf(currentTreeKey));
          setSelectedTreeIndex(currentIndex + 1); // +1 for "+ New Story"
          setLastMapNodeId(highlightedNode.id);
          setActiveMenu("start");
          return;
        } else if (key === "Escape") {
          // START toggles map off back to reading
          setLastMapNodeId(highlightedNode.id);
          setActiveMenu(null);
          // Align LOOM on reveal
          requestAnimationFrame(() => {
            queueScroll({
              nodeId: highlightedNode.id,
              reason: "mode-exit-map",
              priority: 90,
            });
          });
          return;
        }
        // Let arrow keys and Enter fall through to story navigation
      }

      if (activeMenu === "select") {
        handleMenuNavigation(key, trees, {
          onNewTree: handleNewTree,
          onSelectTree: (key) => {
            touchStoryActive(key);
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
            touchStoryActive(key);
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
        if (!activeMenu && key === "ArrowRight") {
          const options = getOptionsAtDepth(currentDepth);
          const currentOption = selectedOptions[currentDepth] ?? 0;
          if (
            currentDepth > 0 &&
            options.length > 0 &&
            currentOption >= options.length - 1
          ) {
            const path = getCurrentPath();
            const pathIds = path.slice(0, currentDepth + 1).map((node) => node.id);
            setPendingNewNode({
              depth: currentDepth,
              pathIds,
              draft: {
                id: `draft-${Date.now().toString(36)}`,
                text: "",
                continuations: [],
              },
            });
            setActiveMenu("edit");
            return;
          }
        }
        await handleStoryNavigation(key);
      }

      // Handle menu activation/deactivation with zoom-out flow
      if (key === "`") {
        // On Stories screen, SELECT returns to map
        if (activeMenu === "start") {
          setActiveMenu("map");
        } else if (activeMenu !== "map") {
          // Elsewhere, SELECT toggles Settings; keep last focused row
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
        setLastMapNodeId(highlightedNode.id);
        setActiveMenu(null);
        // Align LOOM on reveal
        requestAnimationFrame(() => {
          queueScroll({
            nodeId: highlightedNode.id,
            reason: "mode-exit-map",
            priority: 90,
          });
        });
      } else if (key === "Backspace" && !activeMenu) {
        setPendingNewNode(null);
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
      highlightedNode,
      getOptionsAtDepth,
      currentDepth,
      selectedOptions,
      getCurrentPath,
      setPendingNewNode,
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
  const scrollNodeIntoView = useCallback(
    (nodeId: string | undefined | null) => {
      const container = storyTextRef.current;
      if (!container || !nodeId) return;
      const el = container.querySelector(
        `[data-node-id="${nodeId}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      // Use a small edge buffer, but only scroll when offscreen
      scrollElementIntoViewIfNeeded(container, el, 8, "smooth");
    },
    [],
  );

  // Scroll to current depth when navigation changes
  useEffect(() => {
    if (!activeMenu) {
      const path = getCurrentPath();
      const current = path[currentDepth];
      if (current) {
        queueScroll({
          nodeId: current.id,
          reason: "nav-up-down",
          priority: 100,
        });
      }
    }
  }, [currentDepth, getCurrentPath, activeMenu, scrollNodeIntoView]);

  // Scroll to selected sibling when left/right navigation changes
  useEffect(() => {
    if (!activeMenu) {
      const path = getCurrentPath();
      const next = path[currentDepth + 1];
      if (next) {
        queueScroll({
          nodeId: next.id,
          align: "top",
          reason: "nav-left-right",
          priority: 110,
        });
      }
    }
  }, [
    selectedOptions,
    getCurrentPath,
    activeMenu,
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
        const last = path[path.length - 1];
        if (last) {
          queueScroll({
            nodeId: last.id,
            reason: "generation",
            priority: 50,
          });
        }
      }
    }
  }, [storyTree, isAnyGenerating, getCurrentPath]);

  // Removed LOOM scroll preservation to keep behavior simple and reliable

  const renderStoryText = () => {
    const currentPath = getCurrentPath();

    return (
      <div ref={storyTextRef} className="story-text view-fade">
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
          {/* Unified top mode bar */}
          {(() => {
            const map: Record<MenuType, { title: string; hint: string }> & {
              null: { title: string; hint: string };
            } = {
              null: { title: "LOOM", hint: "START: MAP • SELECT: SETTINGS" },
              map: { title: "MAP", hint: "SELECT: STORIES • START: LOOM" },
              select: { title: "SETTINGS", hint: "START: CLOSE" },
              start: {
                title: "STORIES",
                hint: "↵: OPEN • ⌫: DELETE • START: MAP",
              },
              edit: { title: "EDIT", hint: "SELECT: CANCEL • START: SAVE" },
            } as const;
            const key = (activeMenu ?? "null") as keyof typeof map;
            const entry = map[key];
            return entry ? (
              <ModeBar title={entry.title} hint={entry.hint} />
            ) : null;
          })()}
          {activeMenu === "select" ? (
            <>
              <MenuScreen>
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
              onSelectNode={(path) => {
                setSelectionByPath(path);
                setActiveMenu(null);
                requestAnimationFrame(() => {
                  const last = path[path.length - 1];
                  if (last) {
                    queueScroll({
                      nodeId: last.id,
                      reason: "map-select",
                      priority: 90,
                    });
                  }
                });
              }}
              isVisible={activeMenu === "map"}
              lastMapNodeId={lastMapNodeId}
              currentNodeId={highlightedNode.id}
            />
          ) : activeMenu === "start" ? (
            <>
              <MenuScreen>
                <TreeListMenu
                  trees={trees}
                  selectedIndex={selectedTreeIndex}
                  onSelect={(key) => {
                    touchStoryActive(key);
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
            <MenuScreen>
              <EditMenu
                node={
                  pendingNewNode?.draft ??
                  getCurrentPath()[currentDepth] ??
                  storyTree.root
                }
                onSave={(text) => {
                  if (pendingNewNode) {
                    const buildNode = () => {
                      if (menuParams.textSplitting) {
                        const nodeChain = splitTextToNodes(text);
                        if (nodeChain) {
                          return nodeChain;
                        }
                      }

                      return {
                        id: Math.random().toString(36).substring(2, 15),
                        text,
                        continuations: [],
                      } as StoryNode;
                    };

                    const newNode = buildNode();
                    const created = createSiblingNode(
                      pendingNewNode.pathIds,
                      pendingNewNode.depth,
                      newNode,
                    );

                    setActiveMenu(null);
                    setPendingNewNode(null);

                    if (created) {
                      requestAnimationFrame(() => {
                        const path = getCurrentPath();
                        const last = path[path.length - 1];
                        if (last) {
                          queueScroll({
                            nodeId: last.id,
                            reason: "edit-save",
                            priority: 60,
                          });
                        }
                      });
                    }

                    return;
                  }

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
                  // Mark story as updated for reverse-chronological order
                  touchStoryUpdated(currentTreeKey);
                  setActiveMenu(null);
                  setPendingNewNode(null);

                  // Align to end of updated content after text splitting
                  requestAnimationFrame(() => {
                    const path = getCurrentPath();
                    const last = path[path.length - 1];
                    if (last) {
                      queueScroll({
                        nodeId: last.id,
                        reason: "edit-save",
                        priority: 60,
                      });
                    }
                  });
                }}
                onCancel={() => {
                  setPendingNewNode(null);
                  setActiveMenu(null);
                }}
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
