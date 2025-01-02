import type { StoryNode, ActiveControls, GeneratingState } from "../types";

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
  // Only hide if there are no options AND we're not generating at this depth
  if (!options.length && generatingAt?.depth !== currentDepth) return null;

  // Get which option is currently selected
  const currentIndex = selectedOptions[currentDepth] ?? 0;

  // Determine whether we are pushing beyond the left or right edge
  const isEdgePress =
    (currentIndex === 0 && activeControls.direction === "left") ||
    (currentIndex === options.length - 1 &&
      activeControls.direction === "right");

  // If we're generating new nodes, show 3 loading dots
  // If we're generating a sibling, show 1 loading dot
  const isGeneratingNew =
    generatingAt?.depth === currentDepth && generatingAt.index === null;
  const isGeneratingSibling =
    generatingAt?.depth === currentDepth && generatingAt.index !== null;
  const loadingCount = isGeneratingNew ? 3 : isGeneratingSibling ? 1 : 0;

  return (
    <div className="navigation-dots">
      {/* Show existing options */}
      {options.map((option, index) => {
        const isSelected = index === currentIndex;
        const isGenerating =
          generatingAt?.depth === currentDepth && generatingAt.index === index;
        const shouldBump = isSelected && isEdgePress;

        return (
          <div
            key={`dot-${option.id}`}
            className={`navigation-dot ${shouldBump ? "edge-bump" : ""} ${
              isGenerating ? "generating" : ""
            }`}
            style={{
              background: isSelected ? "var(--primary-color)" : "transparent",
            }}
          />
        );
      })}
      {/* Show loading dots for new options */}
      {loadingCount > 0 &&
        Array(loadingCount)
          .fill(null)
          .map((_, i) => (
            <div
              key={`loading-${generatingAt?.depth}-${
                generatingAt?.index ?? "new"
              }-${i}`}
              className="navigation-dot generating"
            />
          ))}
    </div>
  );
};
