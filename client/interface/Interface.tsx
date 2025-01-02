import { useEffect, useRef, useState, useCallback } from "react";
import "./terminal-custom.css";

interface StoryNode {
  id: string;
  text: string;
  continuations?: StoryNode[];
}

interface MenuScreenProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

interface MenuKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  selected: boolean;
}

interface MenuSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  selected: boolean;
}

interface SettingsMenuProps {
  params: {
    temperature: number;
    maxTokens: number;
    model: string;
  };
  onParamChange: (param: string, value: number | string) => void;
  selectedParam: number;
}

interface TreeListProps {
  trees: { [key: string]: { root: StoryNode } };
  selectedIndex: number;
  onSelect: (key: string) => void;
}

interface GamepadButtonProps {
  label: string;
  className?: string;
  active?: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

interface DPadProps {
  activeDirection: string | null;
  onControlPress: (key: string) => void;
  onControlRelease: (key: string) => void;
}

interface MenuButtonProps {
  label: string;
  active: boolean;
  onMouseDown: () => void;
  onMouseUp: () => void;
}

interface GeneratingState {
  depth: number;
  index: number | null;
}

interface ActiveControls {
  direction: string | null;
  a: boolean;
  b: boolean;
  select: boolean;
  start: boolean;
}

const STORY_BRANCHES: { root: StoryNode } = {
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

const GamepadButton = ({
  label,
  className = "",
  active = false,
  onMouseDown,
  onMouseUp,
}: GamepadButtonProps) => (
  <button
    className={`btn ${active ? "btn-primary" : "btn-ghost"} ${className}`}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    aria-pressed={active}
  >
    {label}
  </button>
);

const DPad = ({
  activeDirection,
  onControlPress,
  onControlRelease,
}: DPadProps) => (
  <div className="terminal-grid" role="group" aria-label="Direction Controls">
    <div className="terminal-grid-cell up-arrow">
      <GamepadButton
        label="▲"
        active={activeDirection === "up"}
        onMouseDown={() => onControlPress("ArrowUp")}
        onMouseUp={() => onControlRelease("ArrowUp")}
      />
    </div>
    <div className="terminal-grid-cell left-arrow">
      <GamepadButton
        label="◀"
        active={activeDirection === "left"}
        onMouseDown={() => onControlPress("ArrowLeft")}
        onMouseUp={() => onControlRelease("ArrowLeft")}
      />
    </div>
    <div className="terminal-grid-cell">
      <div />
    </div>
    <div className="terminal-grid-cell right-arrow">
      <GamepadButton
        label="▶"
        active={activeDirection === "right"}
        onMouseDown={() => onControlPress("ArrowRight")}
        onMouseUp={() => onControlRelease("ArrowRight")}
      />
    </div>
    <div className="terminal-grid-cell down-arrow">
      <GamepadButton
        label="▼"
        active={activeDirection === "down"}
        onMouseDown={() => onControlPress("ArrowDown")}
        onMouseUp={() => onControlRelease("ArrowDown")}
      />
    </div>
  </div>
);

const MenuButton = ({
  label,
  active,
  onMouseDown,
  onMouseUp,
}: MenuButtonProps) => (
  <button
    className={`btn ${active ? "btn-primary" : "btn-ghost"}`}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
    aria-pressed={active}
  >
    {label}
  </button>
);

const MenuScreen = ({ title, onClose, children }: MenuScreenProps) => (
  <div className="menu-screen">
    <div className="menu-header">
      <h2>{title}</h2>
      <div className="menu-close">Press ⌫ to close</div>
    </div>
    {children}
  </div>
);

const MODELS = ["mistral-7b", "llama-2-7b", "mixtral-8x7b"];

const MenuKnob = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  selected,
}: MenuKnobProps) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newValue = min + (max - min) * percentage;
    const steppedValue = Math.round(newValue / step) * step;
    const decimalPlaces = step.toString().split(".")[1]?.length || 0;
    const roundedValue = Number(
      Math.max(min, Math.min(max, steppedValue)).toFixed(decimalPlaces)
    );
    onChange(roundedValue);
  };

  const handleTrackDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return; // Only handle left mouse button
    handleTrackClick(e);
  };

  const decimalPlaces = step.toString().split(".")[1]?.length || 0;
  const displayValue = Number(value.toFixed(decimalPlaces));

  return (
    <div
      className={`menu-item ${selected ? "selected" : ""}`}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={displayValue.toString()}
      tabIndex={selected ? 0 : -1}
    >
      <div className="menu-item-label">{label}</div>
      <div className="menu-item-value">
        <div className="menu-knob">
          <div
            ref={trackRef}
            className="menu-knob-track"
            onClick={handleTrackClick}
            onMouseMove={handleTrackDrag}
          >
            <div
              className="menu-knob-handle"
              style={{
                left: `${((value - min) / (max - min)) * 100}%`,
              }}
            />
          </div>
          <div className="menu-knob-value">{displayValue}</div>
        </div>
      </div>
    </div>
  );
};

const MenuSelect = ({
  label,
  value,
  options,
  onChange,
  selected,
}: MenuSelectProps) => (
  <div
    className={`menu-item ${selected ? "selected" : ""}`}
    role="combobox"
    aria-label={label}
    aria-expanded={selected}
    aria-haspopup="listbox"
  >
    <div className="menu-item-label">{label}</div>
    <div className="menu-item-value">{value}</div>
  </div>
);

const SettingsMenu = ({
  params,
  onParamChange,
  selectedParam = 0,
}: SettingsMenuProps) => (
  <div className="menu-content" role="menu">
    <MenuKnob
      label="Temperature"
      value={params.temperature}
      min={0.1}
      max={2.0}
      step={0.1}
      onChange={(value) => onParamChange("temperature", value)}
      selected={selectedParam === 0}
    />
    <MenuKnob
      label="Max Tokens"
      value={params.maxTokens}
      min={10}
      max={500}
      step={10}
      onChange={(value) => onParamChange("maxTokens", value)}
      selected={selectedParam === 1}
    />
    <MenuSelect
      label="Model"
      value={params.model}
      options={MODELS}
      onChange={(value) => onParamChange("model", value)}
      selected={selectedParam === 2}
    />
  </div>
);

const TreeList = ({ trees, selectedIndex, onSelect }: TreeListProps) => {
  const treeEntries = Object.entries(trees);

  return (
    <div className="menu-content">
      {treeEntries.map(([key, tree], index) => (
        <button
          key={key}
          className={`menu-item ${selectedIndex === index ? "selected" : ""}`}
          onClick={() => onSelect(key)}
          aria-selected={selectedIndex === index}
        >
          <div className="menu-item-label">{key}</div>
          <div className="menu-item-preview">
            {tree.root.text.slice(0, 50)}...
          </div>
        </button>
      ))}
    </div>
  );
};

const GamepadInterface = () => {
  const [trees, setTrees] = useState<{ [key: string]: { root: StoryNode } }>({
    "Story 1": STORY_BRANCHES,
  });
  const [currentTreeKey, setCurrentTreeKey] = useState("Story 1");
  const [selectedTreeIndex, setSelectedTreeIndex] = useState(0);
  const [storyTree, setStoryTree] = useState(trees[currentTreeKey]);
  const [currentDepth, setCurrentDepth] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([0]);
  const [generatingAt, setGeneratingAt] = useState<GeneratingState | null>(
    null
  );
  const [activeControls, setActiveControls] = useState<ActiveControls>({
    direction: null,
    a: false,
    b: false,
    select: false,
    start: false,
  });
  const [activeMenu, setActiveMenu] = useState<"select" | "start" | null>(null);
  const [menuParams, setMenuParams] = useState({
    temperature: 0.7,
    maxTokens: 100,
    model: "mistral-7b",
  });
  const storyTextRef = useRef<HTMLDivElement>(null);
  const [selectedParam, setSelectedParam] = useState(0);

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
      ) as typeof STORY_BRANCHES;
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

  const handleControlPress = useCallback(
    async (key: string) => {
      // If a menu is active, handle menu controls
      if (activeMenu) {
        switch (key) {
          case "Backspace":
            setActiveMenu(null);
            setSelectedParam(0);
            setSelectedTreeIndex(0);
            break;
          case "ArrowUp":
            if (activeMenu === "select") {
              setSelectedParam((prev) => Math.max(0, prev - 1));
            } else if (activeMenu === "start") {
              setSelectedTreeIndex((prev) => Math.max(0, prev - 1));
            }
            break;
          case "ArrowDown":
            if (activeMenu === "select") {
              setSelectedParam((prev) => Math.min(2, prev + 1));
            } else if (activeMenu === "start") {
              setSelectedTreeIndex((prev) =>
                Math.min(Object.keys(trees).length - 1, prev + 1)
              );
            }
            break;
          case "ArrowLeft":
            if (activeMenu === "select") {
              setMenuParams((prev) => {
                const param =
                  selectedParam === 0
                    ? "temperature"
                    : selectedParam === 1
                    ? "maxTokens"
                    : "model";

                if (param === "model") {
                  const currentIndex = MODELS.indexOf(prev.model);
                  const newIndex = Math.max(0, currentIndex - 1);
                  return { ...prev, model: MODELS[newIndex] };
                }

                const step = param === "temperature" ? 0.1 : 10;
                const min = param === "temperature" ? 0.1 : 10;
                const decimalPlaces =
                  step.toString().split(".")[1]?.length || 0;
                const newValue = Number(
                  Math.max(min, prev[param] - step).toFixed(decimalPlaces)
                );

                return {
                  ...prev,
                  [param]: newValue,
                };
              });
            }
            break;
          case "ArrowRight":
            if (activeMenu === "select") {
              setMenuParams((prev) => {
                const param =
                  selectedParam === 0
                    ? "temperature"
                    : selectedParam === 1
                    ? "maxTokens"
                    : "model";

                if (param === "model") {
                  const currentIndex = MODELS.indexOf(prev.model);
                  const newIndex = Math.min(
                    MODELS.length - 1,
                    currentIndex + 1
                  );
                  return { ...prev, model: MODELS[newIndex] };
                }

                const step = param === "temperature" ? 0.1 : 10;
                const max = param === "temperature" ? 2.0 : 500;
                const decimalPlaces =
                  step.toString().split(".")[1]?.length || 0;
                const newValue = Number(
                  Math.min(max, prev[param] + step).toFixed(decimalPlaces)
                );

                return {
                  ...prev,
                  [param]: newValue,
                };
              });
            }
            break;
          // ... rest of menu controls ...
        }
        return;
      }

      const currentPath = getCurrentPath();
      const options = getOptionsAtDepth(currentDepth);

      setActiveControls((prev) => {
        switch (key) {
          case "ArrowUp":
            return { ...prev, direction: "up" };
          case "ArrowRight":
            return { ...prev, direction: "right" };
          case "ArrowDown":
            return { ...prev, direction: "down" };
          case "ArrowLeft":
            return { ...prev, direction: "left" };
          case "Enter":
            return { ...prev, a: true };
          case "Backspace":
            return { ...prev, b: true };
          case "`":
            return { ...prev, select: true };
          case "Escape":
            return { ...prev, start: true };
          default:
            return prev;
        }
      });

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
        case "`":
          setActiveMenu("select");
          break;
        case "Escape":
          setActiveMenu("start");
          break;
      }
    },
    [
      activeMenu,
      selectedParam,
      selectedTreeIndex,
      trees,
      setCurrentTreeKey,
      setStoryTree,
      setActiveMenu,
      setSelectedTreeIndex,
      setCurrentDepth,
      setSelectedOptions,
      setMenuParams,
    ]
  );

  const handleControlRelease = (key) => {
    setActiveControls((prev) => {
      switch (key) {
        case "ArrowUp":
        case "ArrowRight":
        case "ArrowDown":
        case "ArrowLeft":
          return { ...prev, direction: null };
        case "Enter":
          return { ...prev, a: false };
        case "Backspace":
          return { ...prev, b: false };
        case "`":
          return { ...prev, select: false };
        case "Escape":
          return { ...prev, start: false };
        default:
          return prev;
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      await handleControlPress(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      handleControlRelease(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleControlPress, handleControlRelease]);

  useEffect(() => {
    if (storyTextRef.current) {
      const storyContainer = storyTextRef.current;
      const highlightedText = storyContainer.children[currentDepth];

      if (highlightedText) {
        const containerTop = storyContainer.scrollTop;
        const containerBottom = containerTop + storyContainer.clientHeight;
        const elementTop = highlightedText.offsetTop;
        const elementBottom = elementTop + highlightedText.offsetHeight;

        if (elementTop < containerTop) {
          storyContainer.scrollTop = elementTop - 20;
        } else if (elementBottom > containerBottom) {
          storyContainer.scrollTop =
            elementBottom - storyContainer.clientHeight + 20;
        }
      }
    }
  }, [currentDepth]);

  const renderStoryText = () => {
    const path = getCurrentPath();

    return (
      <div className="story-text" ref={storyTextRef}>
        {path.map((segment) => {
          const isCurrentDepth = path.indexOf(segment) === currentDepth;
          const isNextDepth = path.indexOf(segment) === currentDepth + 1;
          const isLoading = generatingAt?.depth === path.indexOf(segment);

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
              {isLoading && path.indexOf(segment) === path.length - 1 && (
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

  const renderNavigationDots = () => {
    const options = getOptionsAtDepth(currentDepth);
    if (!options.length || generatingAt?.depth !== currentDepth) return null;

    // Get which option is currently selected
    const currentIndex = selectedOptions[currentDepth] ?? 0;

    // Determine whether we are pushing beyond the left or right edge
    const isEdgePress =
      (currentIndex === 0 && activeControls.direction === "left") ||
      (currentIndex === options.length - 1 &&
        activeControls.direction === "right");

    return (
      <div className="navigation-dots">
        {options.map((option, index) => {
          const isSelected = index === currentIndex;
          // Only bump the currently selected dot if we're pushing past the edge
          const shouldBump = isSelected && isEdgePress;
          return (
            <div
              key={`dot-${option.id}`}
              className={`navigation-dot ${shouldBump ? "edge-bump" : ""}`}
              style={{
                background: isSelected ? "var(--primary-color)" : "transparent",
              }}
            />
          );
        })}
        {generatingAt?.depth === currentDepth && (
          <div
            className="navigation-dot animate-pulse"
            style={{ background: "var(--secondary-color)" }}
          />
        )}
      </div>
    );
  };

  // Save tree changes to local storage
  useEffect(() => {
    const updatedTrees = { ...trees, [currentTreeKey]: storyTree };
    setTrees(updatedTrees);
    localStorage.setItem("story-trees", JSON.stringify(updatedTrees));
  }, [storyTree, currentTreeKey, trees]);

  // Load trees from local storage on mount
  useEffect(() => {
    const savedTrees = localStorage.getItem("story-trees");
    if (savedTrees) {
      try {
        const parsedTrees = JSON.parse(savedTrees);
        setTrees(parsedTrees);
        const firstKey = Object.keys(parsedTrees)[0];
        if (firstKey) {
          setCurrentTreeKey(firstKey);
          setStoryTree(parsedTrees[firstKey]);
        }
      } catch (error) {
        console.error("Failed to load saved trees:", error);
      }
    }
  }, []);

  return (
    <div className="terminal" role="application" aria-label="Story Interface">
      <div className="container">
        {/* Screen area */}
        <div
          className="terminal-screen"
          role="region"
          aria-label="Story Display"
        >
          {activeMenu === "select" ? (
            <MenuScreen title="Settings" onClose={() => setActiveMenu(null)}>
              <SettingsMenu
                params={menuParams}
                onParamChange={(param, value) =>
                  setMenuParams((prev) => ({ ...prev, [param]: value }))
                }
                selectedParam={selectedParam}
              />
            </MenuScreen>
          ) : activeMenu === "start" ? (
            <MenuScreen title="Trees" onClose={() => setActiveMenu(null)}>
              <TreeList
                trees={trees}
                selectedIndex={selectedTreeIndex}
                onSelect={(key) => {
                  setCurrentTreeKey(key);
                  setStoryTree(trees[key]);
                  setActiveMenu(null);
                  setSelectedTreeIndex(0);
                  setCurrentDepth(0);
                  setSelectedOptions([0]);
                }}
              />
            </MenuScreen>
          ) : (
            <>
              {renderStoryText()}
              {renderNavigationDots()}
            </>
          )}
        </div>

        {/* Controls */}
        <div
          className="terminal-controls"
          role="group"
          aria-label="Game Controls"
        >
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
        </div>
      </div>
    </div>
  );
};

export default GamepadInterface;
