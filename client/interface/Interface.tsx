import { useCallback, useRef, useEffect } from "react";
import "./terminal-custom.css";

import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useMenuSystem } from "./hooks/useMenuSystem";
import { useStoryTree } from "./hooks/useStoryTree";
import { useLocalStorage } from "./hooks/useLocalStorage";

import { DPad } from "./components/DPad";
import { GamepadButton } from "./components/GamepadButton";
import { MenuButton } from "./components/MenuButton";
import { MenuScreen } from "./components/MenuScreen";
import { NavigationDots } from "./components/NavigationDots";

import { SettingsMenu } from "./menus/SettingsMenu";
import { TreeListMenu } from "./menus/TreeListMenu";
import { EditMenu } from "./menus/EditMenu";

import type { StoryNode } from "./types";
import type { ModelId } from "../../server/apis/generation";

const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxTokens: 100,
  model: "mistralai/mixtral-8x7b" as ModelId,
};

const GamepadInterface = () => {
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

  useLocalStorage(
    trees,
    setTrees,
    currentTreeKey,
    setCurrentTreeKey,
    setStoryTree
  );

  const storyTextRef = useRef<HTMLDivElement>(null);

  const handleControlAction = useCallback(
    async (key: string) => {
      if (activeMenu === "edit") {
        // Let EditMenu handle its own keyboard events
        return;
      }

      if (activeMenu) {
        handleMenuNavigation(key);
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
    [activeMenu, handleMenuNavigation, handleStoryNavigation, setActiveMenu]
  );

  const { activeControls, handleControlPress, handleControlRelease } =
    useKeyboardControls(handleControlAction);

  // Scroll to current depth
  useEffect(() => {
    if (storyTextRef.current) {
      const storyContainer = storyTextRef.current;
      const text = storyContainer.textContent || "";
      const path = getCurrentPath();

      // Calculate the position to scroll to
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

      storyContainer.scrollTop = scrollPosition - 20;
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
              {isLoading && index === currentPath.length - 1 && (
                <span
                  className="inline-block w-2 h-2 ml-1 animate-pulse"
                  style={{ background: "var(--secondary-color)" }}
                />
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <main className="terminal" aria-label="Story Interface">
      <div className="container">
        {/* Screen area */}
        <section className="terminal-screen" aria-label="Story Display">
          {activeMenu === "select" ? (
            <MenuScreen title="Settings" onClose={() => setActiveMenu(null)}>
              <SettingsMenu
                params={menuParams}
                onParamChange={(param, value) =>
                  setMenuParams((prev) => ({ ...prev, [param]: value }))
                }
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

                  current.text = text;
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
              {error && (
                <output className="error-message">
                  Generation error: {error.message}
                </output>
              )}
            </>
          )}
        </section>

        {/* Controls */}
        <fieldset className="terminal-controls" aria-label="Game Controls">
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
        </fieldset>
      </div>
    </main>
  );
};

export default GamepadInterface;
