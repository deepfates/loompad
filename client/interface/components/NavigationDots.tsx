import type { StoryNode, ActiveControls, GeneratingState } from "../types";

interface NavigationDotsProps {
  options: StoryNode[];
  currentDepth: number;
  selectedOptions: number[];
  activeControls: ActiveControls;
  generatingAt: GeneratingState | null;
  generationCount: number;
}

export const NavigationDots = ({
  options,
  currentDepth,
  selectedOptions,
  activeControls,
  generatingAt,
  generationCount,
}: NavigationDotsProps) => {
  // Always show the component to display depth indicator

  // Get which option is currently selected
  const currentIndex = selectedOptions[currentDepth] ?? 0;
  
  // Debug logging
  console.log('🎯 NavigationDots:', {
    currentDepth,
    selectedOptions,
    currentIndex,
    optionsLength: options.length,
    optionsIds: options.map(o => o.id)
  });

  // Determine whether we are pushing beyond the left or right edge
  const isEdgePress =
    (currentIndex === 0 && activeControls.direction === "left") ||
    (currentIndex === options.length - 1 &&
      activeControls.direction === "right");

  // If we're generating new nodes or siblings, show the configured number of loading dots
  const isGeneratingNew =
    generatingAt?.depth === currentDepth && generatingAt.index === null;
  const isGeneratingSibling =
    generatingAt?.depth === currentDepth && generatingAt.index !== null;
  const loadingCount = (isGeneratingNew || isGeneratingSibling) ? generationCount : 0;

  return (
    <div className="navigation-dots">
      {/* Depth indicator */}
      <span className="depth-indicator">L{currentDepth}</span>
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
