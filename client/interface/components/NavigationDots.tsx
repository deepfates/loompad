import type {
  StoryNode,
  ActiveControls,
  InFlight,
  GeneratingInfo,
} from "../types";

interface NavigationDotsProps {
  options: StoryNode[];
  currentDepth: number;
  selectedOptions: number[];
  activeControls: ActiveControls;
  inFlight: InFlight;
  generatingInfo: GeneratingInfo;
}

export const NavigationDots = ({
  options,
  currentDepth,
  selectedOptions,
  activeControls,
  inFlight,
  generatingInfo,
}: NavigationDotsProps) => {
  // Check if any node at this depth is generating
  const isGeneratingAtDepth = Object.values(generatingInfo).some(
    (info) => info.depth === currentDepth,
  );

  // Only hide if there are no options AND we're not generating at this depth
  if (!options.length && !isGeneratingAtDepth) return null;

  // Get which option is currently selected
  const currentIndex = selectedOptions[currentDepth] ?? 0;

  // Determine whether we are pushing beyond the left or right edge
  const isEdgePress =
    (currentIndex === 0 && activeControls.direction === "left") ||
    (currentIndex === options.length - 1 &&
      activeControls.direction === "right");

  // Calculate loading dots based on all generations at this depth
  let loadingCount = 0;
  Object.values(generatingInfo).forEach((info) => {
    if (info.depth === currentDepth) {
      loadingCount += info.pendingCount * info.batchSize;
    }
  });

  return (
    <div className="navigation-dots">
      {/* Show existing options */}
      {options.map((option, index) => {
        const isSelected = index === currentIndex;
        const isGenerating = (inFlight.get(option.id) ?? 0) > 0;
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
              key={`loading-${currentDepth}-${i}`}
              className="navigation-dot generating"
            />
          ))}
    </div>
  );
};
