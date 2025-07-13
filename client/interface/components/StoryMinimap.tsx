import { useMemo, useRef, useEffect } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import type { StoryNode } from "../types";

interface StoryMinimapProps {
  /**
   * The root of the story tree to render.
   */
  tree: { root: StoryNode };
  /**
   * Current depth in the main reader.
   */
  currentDepth: number;
  /**
   * Selected options at each depth.
   */
  selectedOptions: number[];
  /**
   * Set of node IDs currently generating.
   */
  inFlight: Set<string>;
  /**
   * Generation metadata (unused but kept for future features).
   */
  generatingInfo: { [nodeId: string]: { depth: number; index: number | null } };
  /**
   * Current path through the tree following favorite children.
   */
  currentPath: StoryNode[];
  /**
   * Callback when user clicks a node (optional, for future use).
   */
  onSelectNode?: (path: StoryNode[]) => void;
}

/**
 * Size constants – tweak for aesthetics.
 */
const LANE_WIDTH = 30;
const ROW_HEIGHT = 50;
const NODE_RADIUS = 5;

/**
 * Tidy tree layout using d3-hierarchy - no overlaps, optimal spacing
 */
function useCoords(root: StoryNode) {
  return useMemo(() => {
    const coords: Record<
      string,
      { x: number; y: number; lane: number; depth: number; path: StoryNode[] }
    > = {};

    // Handle empty tree
    if (!root) return coords;

    // Create hierarchy from StoryNode tree
    const rootHierarchy = hierarchy(root, (d) => d.continuations);

    // Apply tidy tree layout with proper size
    const treeLayout = tree<StoryNode>()
      .separation(() => 1) // 1 lane between siblings
      .nodeSize([LANE_WIDTH, ROW_HEIGHT]); // Fixed node size instead of canvas size

    treeLayout(rootHierarchy);

    // Build path for each node and convert to coords
    const buildPath = (node: any, path: StoryNode[] = []): StoryNode[] => {
      const currentPath = [...path, node.data];
      coords[node.data.id] = {
        x: node.x || 0,
        y: node.y || 0,
        lane: Math.round((node.x || 0) / LANE_WIDTH),
        depth: node.depth || 0,
        path: currentPath,
      };

      // Recursively process children
      if (node.children) {
        node.children.forEach((child: any) => buildPath(child, currentPath));
      }

      return currentPath;
    };

    buildPath(rootHierarchy);

    return coords;
  }, [root]);
}

/**
 * Return a list of edges as pairs of {from, to, key}.
 */
function useEdges(root: StoryNode) {
  return useMemo(() => {
    const edges: { from: StoryNode; to: StoryNode; key: string }[] = [];
    const walk = (node: StoryNode) => {
      node.continuations?.forEach((child, idx) => {
        edges.push({ from: node, to: child, key: `${node.id}-${idx}` });
        walk(child);
      });
    };
    walk(root);
    return edges;
  }, [root]);
}

/**
 * Terminal-style minibuffer at bottom of map
 */
const Minibuffer = ({ text }: { text: string }) => (
  <div className="minimap-minibuffer">
    <div className="minimap-minibuffer-text">
      {text || "Navigate with arrow keys • A to generate • B to edit"}
    </div>
  </div>
);

/**
 * The actual component.
 */
export const StoryMinimap = ({
  tree,
  currentDepth,
  selectedOptions,
  currentPath,
  inFlight,
  generatingInfo,
  onSelectNode,
}: StoryMinimapProps) => {
  const { root } = tree;
  const coords = useCoords(root);
  const edges = useEdges(root);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Determine node that matches current reader position for highlight
  const highlightedNode = (() => {
    let node = root;
    for (let depth = 0; depth < currentDepth; depth++) {
      const idx = selectedOptions[depth];
      const child = node.continuations?.[idx];
      if (!child) break;
      node = child;
    }
    return node;
  })();

  // Determine selected sibling (next depth)
  const selectedSibling = (() => {
    if (!highlightedNode.continuations?.length) return null;
    const idx = selectedOptions[currentDepth] ?? 0;
    return (
      highlightedNode.continuations[idx] || highlightedNode.continuations[0]
    );
  })();

  // Handle empty tree
  if (Object.keys(coords).length === 0) {
    return <div>Empty tree</div>;
  }

  // Bounds for <svg> viewBox - ensure it's wide enough for scrolling
  const xCoords = Object.values(coords).map((c) => c.x);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const maxDepth = Math.max(...Object.values(coords).map((c) => c.depth));

  // Add padding around the tree
  const padding = LANE_WIDTH * 2;
  const svgWidth = Math.max(600, maxX - minX + padding * 2); // Ensure minimum width
  const svgHeight = (maxDepth + 1) * ROW_HEIGHT + ROW_HEIGHT;

  // Center the tree horizontally - offset all x coords so tree is centered
  const centerX = svgWidth / 2;
  const treeCenter = (minX + maxX) / 2;
  const rootOffset = centerX - treeCenter;

  // Auto-scroll to keep both highlighted node and selected sibling in view
  useEffect(() => {
    if (!viewportRef.current || !highlightedNode || !coords[highlightedNode.id])
      return;

    const viewport = viewportRef.current;
    const viewportRect = viewport.getBoundingClientRect();
    const scrollLeft = viewport.scrollLeft;
    const scrollTop = viewport.scrollTop;
    const margin = 50;

    // Get coordinates for both nodes
    const highlightedCoord = coords[highlightedNode.id];
    const highlightedX = highlightedCoord.x + rootOffset;
    const highlightedY = highlightedCoord.y;

    let minX = highlightedX;
    let maxX = highlightedX;
    let minY = highlightedY;
    let maxY = highlightedY;

    // Include selected sibling if it exists
    if (selectedSibling && coords[selectedSibling.id]) {
      const siblingCoord = coords[selectedSibling.id];
      const siblingX = siblingCoord.x + rootOffset;
      const siblingY = siblingCoord.y;

      minX = Math.min(minX, siblingX);
      maxX = Math.max(maxX, siblingX);
      minY = Math.min(minY, siblingY);
      maxY = Math.max(maxY, siblingY);
    }

    // Calculate bounding box for both nodes
    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let newScrollLeft = scrollLeft;
    let newScrollTop = scrollTop;

    // Check if bounding box fits in viewport
    if (boundingWidth + margin * 2 <= viewportRect.width) {
      // Both nodes can fit, center them
      const targetLeft = centerX - viewportRect.width / 2;
      if (
        minX < scrollLeft + margin ||
        maxX > scrollLeft + viewportRect.width - margin
      ) {
        newScrollLeft = Math.max(0, targetLeft);
      }
    } else {
      // Focus on the selected sibling if it exists, otherwise highlighted node
      const focusX =
        selectedSibling && coords[selectedSibling.id]
          ? coords[selectedSibling.id].x + rootOffset
          : highlightedX;
      if (focusX < scrollLeft + margin) {
        newScrollLeft = Math.max(0, focusX - margin);
      } else if (focusX > scrollLeft + viewportRect.width - margin) {
        newScrollLeft = focusX - viewportRect.width + margin;
      }
    }

    // Similar logic for vertical
    if (boundingHeight + margin * 2 <= viewportRect.height) {
      const targetTop = centerY - viewportRect.height / 2;
      if (
        minY < scrollTop + margin ||
        maxY > scrollTop + viewportRect.height - margin
      ) {
        newScrollTop = Math.max(0, targetTop);
      }
    } else {
      const focusY =
        selectedSibling && coords[selectedSibling.id]
          ? coords[selectedSibling.id].y
          : highlightedY;
      if (focusY < scrollTop + margin) {
        newScrollTop = Math.max(0, focusY - margin);
      } else if (focusY > scrollTop + viewportRect.height - margin) {
        newScrollTop = focusY - viewportRect.height + margin;
      }
    }

    // Scroll to new position if needed
    if (newScrollLeft !== scrollLeft || newScrollTop !== scrollTop) {
      viewport.scrollTo({
        left: newScrollLeft,
        top: newScrollTop,
        behavior: "smooth",
      });
    }
  }, [selectedSibling?.id, highlightedNode.id, coords, rootOffset]);

  return (
    <div className="minimap-container">
      <div ref={viewportRef} className="minimap-viewport">
        <div style={{ width: svgWidth, minWidth: "100%" }}>
          <svg width={svgWidth} height={svgHeight}>
            {/* Render edges first so they sit behind nodes */}
            {edges.map(({ from, to, key }) => {
              const a = coords[from.id];
              const b = coords[to.id];

              const ax = a.x + rootOffset;
              const bx = b.x + rootOffset;

              let path;
              if (a.lane === b.lane) {
                // Straight line for same lane
                path = `M${ax},${a.y} L${bx},${b.y}`;
              } else {
                // Squircle-style branch: curve early then straight down
                const branchPoint = a.y + 15; // Fork happens 15px below parent
                const curveRadius = 8; // Radius of the rounded corner

                if (bx > ax) {
                  // Branching to the right
                  path = `M${ax},${a.y} L${ax},${branchPoint - curveRadius} Q${ax},${branchPoint} ${ax + curveRadius},${branchPoint} L${bx - curveRadius},${branchPoint} Q${bx},${branchPoint} ${bx},${branchPoint + curveRadius} L${bx},${b.y}`;
                } else {
                  // Branching to the left
                  path = `M${ax},${a.y} L${ax},${branchPoint - curveRadius} Q${ax},${branchPoint} ${ax - curveRadius},${branchPoint} L${bx + curveRadius},${branchPoint} Q${bx},${branchPoint} ${bx},${branchPoint + curveRadius} L${bx},${b.y}`;
                }
              }

              return (
                <path
                  key={key}
                  d={path}
                  stroke="var(--secondary-color)"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Nodes */}
            {Object.entries(coords).map(([id, c]) => {
              const node = c.path[c.path.length - 1];
              const isHighlighted = id === highlightedNode.id;
              const isSelected = selectedSibling && id === selectedSibling.id;
              const isGenerating = inFlight.has(id);
              const isOnFavoritePath = currentPath.some(
                (pathNode) => pathNode.id === id,
              );

              return (
                <g
                  key={id}
                  onClick={() => onSelectNode?.(c.path)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    className={`minimap-dot ${isGenerating ? "generating" : ""}`}
                    cx={c.x + rootOffset}
                    cy={c.y}
                    r={NODE_RADIUS}
                    fill={
                      isGenerating
                        ? "var(--secondary-color)"
                        : isHighlighted
                          ? "var(--font-color)"
                          : isSelected
                            ? "var(--primary-color)"
                            : isOnFavoritePath
                              ? "rgba(128, 128, 128, 0.4)"
                              : "var(--background-color)"
                    }
                    stroke="var(--secondary-color)"
                    strokeWidth={isHighlighted || isSelected ? 2 : 1}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <Minibuffer
        text={
          selectedSibling
            ? selectedSibling.text.split("\n")[0]
            : highlightedNode.text.split("\n")[0]
        }
      />
    </div>
  );
};
