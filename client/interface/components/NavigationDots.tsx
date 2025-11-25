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
    (info) => info.depth === currentDepth
  );

  // Only show dots if there are siblings (more than 1 option) OR generating
  // If there's only one option, no need to show dots
  if (options.length <= 1 && !isGeneratingAtDepth) return null;

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
      loadingCount += info.index === null ? 3 : 1;
    }
  });

  return (
    <div className="flex items-center gap-1.5">
      {/* Show existing options */}
      {options.map((option, index) => {
        const isSelected = index === currentIndex;
        const isGenerating = inFlight.has(option.id);
        const shouldBump = isSelected && isEdgePress;

        return (
          <div
            key={`dot-${option.id}`}
            className={`
              w-2 h-2 rounded-full border border-theme-text
              transition-all duration-75
              ${
                isSelected
                  ? "bg-theme-focused border-theme-focused"
                  : "bg-transparent"
              }
              ${shouldBump ? "scale-125" : ""}
              ${isGenerating ? "animate-pulse" : ""}
            `}
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
              className="w-2 h-2 rounded-full border border-theme-text animate-pulse bg-theme-focused-subdued"
            />
          ))}
    </div>
  );
};
