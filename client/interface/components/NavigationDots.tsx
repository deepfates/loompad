import { StoryNode, ActiveControls, GeneratingState } from "../types";

interface NavigationDotsProps {
  options: StoryNode[];
  currentDepth: number;
  selectedOptions: number[];
  activeControls: ActiveControls;
  generatingAt: GeneratingState | null;
}

export const NavigationDots = ({
  options,
  currentDepth,
  selectedOptions,
  activeControls,
  generatingAt,
}: NavigationDotsProps) => {
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
