import { useEffect, useRef, useState } from "react";
import "./terminal-custom.css";

const STORY_BRANCHES = {
  root: {
    id: "root",
    text: `The darkness grew absolute, not that the hyperstitioner could see in the first place. His ears pricked up, however; he could hear the skittering, the mechanical hum as the machine followed him invisibly.`,
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
}) => (
  <div
    className={`btn ${active ? "btn-primary" : "btn-ghost"} ${className}`}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
  >
    {label}
  </div>
);

const DPad = ({ activeDirection = null, onControlPress, onControlRelease }) => (
  <div className="terminal-grid">
    <div className="terminal-grid-cell">
      <GamepadButton
        label="▲"
        active={activeDirection === "up"}
        onMouseDown={() => onControlPress("ArrowUp")}
        onMouseUp={() => onControlRelease("ArrowUp")}
      />
    </div>
    <div className="terminal-grid-cell">
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
    <div className="terminal-grid-cell">
      <GamepadButton
        label="▶"
        active={activeDirection === "right"}
        onMouseDown={() => onControlPress("ArrowRight")}
        onMouseUp={() => onControlRelease("ArrowRight")}
      />
    </div>
    <div className="terminal-grid-cell">
      <GamepadButton
        label="▼"
        active={activeDirection === "down"}
        onMouseDown={() => onControlPress("ArrowDown")}
        onMouseUp={() => onControlRelease("ArrowDown")}
      />
    </div>
  </div>
);

const MenuButton = ({ label, active = false, onMouseDown, onMouseUp }) => (
  <div
    className={`btn ${active ? "btn-primary" : "btn-ghost"}`}
    onMouseDown={onMouseDown}
    onMouseUp={onMouseUp}
  >
    {label}
  </div>
);

const GamepadInterface = () => {
  const [storyTree, setStoryTree] = useState(STORY_BRANCHES);
  const [currentDepth, setCurrentDepth] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState([0]);
  const [generatingAt, setGeneratingAt] = useState(null);
  const [activeControls, setActiveControls] = useState({
    direction: null,
    a: false,
    b: false,
    select: false,
    start: false,
  });
  const storyTextRef = useRef(null);

  const generateRandomText = async () => {
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

    const randomWord = (arr) => arr[Math.floor(Math.random() * arr.length)];
    return ` The ${randomWord(adjectives)} ${randomWord(nouns)} ${randomWord(
      verbs
    )} through the system.`;
  };

  const generateContinuations = async (count) => {
    const results = await Promise.all(
      Array(count)
        .fill(null)
        .map(async () => ({
          id: Math.random().toString(36).substring(2),
          text: await generateRandomText(),
        }))
    );
    return results;
  };

  const addContinuations = (path, newContinuations) => {
    const newTree = JSON.parse(JSON.stringify(storyTree));
    let current = newTree.root;

    for (let i = 1; i < path.length; i++) {
      const continuationIndex = selectedOptions[i - 1];
      current = current.continuations[continuationIndex];
    }

    if (!current.continuations) {
      current.continuations = newContinuations;
    } else {
      current.continuations = [...current.continuations, ...newContinuations];
    }

    return newTree;
  };

  const getOptionsAtDepth = (depth) => {
    if (depth === 0) return storyTree.root.continuations || [];

    let currentNode = storyTree.root;
    for (let i = 0; i < depth - 1; i++) {
      if (!currentNode.continuations?.[selectedOptions[i]]) return [];
      currentNode = currentNode.continuations[selectedOptions[i]];
    }

    const currentOption =
      currentNode.continuations?.[selectedOptions[depth - 1]];
    return currentOption?.continuations || [];
  };

  const getCurrentPath = () => {
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
  };

  const handleControlPress = async (key) => {
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
    }
  };

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
    const handleKeyDown = async (e) => {
      const currentPath = getCurrentPath();
      const options = getOptionsAtDepth(currentDepth);

      setActiveControls((prev) => {
        switch (e.key) {
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

      // Handle navigation and generation
      switch (e.key) {
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
    };

    const handleKeyUp = (e) => {
      setActiveControls((prev) => {
        switch (e.key) {
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentDepth, selectedOptions, storyTree]);

  useEffect(() => {
    if (storyTextRef.current) {
      const storyContainer = storyTextRef.current;
      const highlightedText = storyContainer.children[currentDepth];

      if (highlightedText) {
        // Get the position of the highlighted text relative to the container
        const containerTop = storyContainer.scrollTop;
        const containerBottom = containerTop + storyContainer.clientHeight;
        const elementTop = highlightedText.offsetTop;
        const elementBottom = elementTop + highlightedText.offsetHeight;

        // If element is above visible area, scroll up to it
        if (elementTop < containerTop) {
          storyContainer.scrollTop = elementTop - 20; // 20px padding for visibility
        }
        // If element is below visible area, scroll down to it
        else if (elementBottom > containerBottom) {
          storyContainer.scrollTop =
            elementBottom - storyContainer.clientHeight + 20;
        }
      }
    }
  }, [storyTree, currentDepth, selectedOptions]);

  const renderStoryText = () => {
    const path = getCurrentPath();

    return (
      <div className="story-text" ref={storyTextRef}>
        {path.map((segment, index) => {
          const isCurrentDepth = index === currentDepth;
          const isNextDepth = index === currentDepth + 1;
          const isLoading = generatingAt?.depth === index;

          return (
            <span
              key={index}
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
              {isLoading && index === path.length - 1 && (
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
    if (!options.length && !generatingAt?.depth === currentDepth) return null;

    // Get which option is currently selected
    const currentIndex = selectedOptions[currentDepth] ?? 0;

    // Determine whether we are pushing beyond the left or right edge
    const isEdgePress =
      (currentIndex === 0 && activeControls.direction === "left") ||
      (currentIndex === options.length - 1 &&
        activeControls.direction === "right");

    return (
      <div className="navigation-dots">
        {options.map((_, index) => {
          const isSelected = index === currentIndex;
          // Only bump the currently selected dot if we're pushing past the edge
          const shouldBump = isSelected && isEdgePress;
          return (
            <div
              key={index}
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

  return (
    <div className="terminal">
      <div className="container">
        {/* Screen area */}
        <div className="terminal-screen">
          {renderStoryText()}
          {renderNavigationDots()}
        </div>

        {/* Controls */}
        <div className="terminal-controls">
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
