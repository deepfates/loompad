import { useMemo, useRef, useEffect, useLayoutEffect } from "react";
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
  /**
   * Whether the minimap is currently visible.
   */
  isVisible?: boolean;
  /**
   * The ID of the node that was highlighted when map was last opened.
   */
  lastMapNodeId: string | null;
  /**
   * The ID of the currently highlighted node.
   */
  currentNodeId: string;
}

/**
 * Size constants – tweak for aesthetics.
 */
const LANE_WIDTH = 30;
const ROW_HEIGHT = 50;
// Vertical spacing adapts to the amount of text in each node so the minimap
// conveys relative length at a glance.
const MIN_CONNECTOR_LENGTH = ROW_HEIGHT * 0.7;
const MAX_CONNECTOR_LENGTH = ROW_HEIGHT * 3;
const NODE_RADIUS = 5;

/**
 * Tidy tree layout using d3-hierarchy - no overlaps, optimal spacing
 */
function useCoords(root: StoryNode) {
  return useMemo(() => {
    const coords: Record<
      string,
      {
        x: number;
        y: number;
        lane: number;
        depth: number;
        path: StoryNode[];
        length: number;
        connectorLength: number;
      }
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

    const descendants = rootHierarchy.descendants();
    const logLengths = descendants.map((node) => Math.log((node.data.text || "").length + 1));
    const minLogLength = Math.min(...logLengths);
    const maxLogLength = Math.max(...logLengths);
    const logRange = maxLogLength - minLogLength || 1;

    const getConnectorLength = (textLength: number) => {
      const logLength = Math.log(textLength + 1);
      const normalized =
        maxLogLength === minLogLength
          ? 0.5
          : (logLength - minLogLength) / logRange;

      return (
        MIN_CONNECTOR_LENGTH +
        normalized * (MAX_CONNECTOR_LENGTH - MIN_CONNECTOR_LENGTH)
      );
    };

    const buildPath = (
      node: any,
      path: StoryNode[] = [],
      parentY = 0,
    ): StoryNode[] => {
      const currentPath = [...path, node.data];
      const textLength = (node.data.text || "").length;
      const connectorLength = getConnectorLength(textLength);
      const parentConnectorLength =
        node.parent && coords[node.parent.data.id]
          ? coords[node.parent.data.id].connectorLength
          : node.parent
            ? getConnectorLength((node.parent.data.text || "").length)
            : 0;
      const y = node.parent ? parentY + parentConnectorLength : 0;

      coords[node.data.id] = {
        x: node.x || 0,
        y,
        lane: Math.round((node.x || 0) / LANE_WIDTH),
        depth: node.depth || 0,
        path: currentPath,
        length: textLength,
        connectorLength,
      };

      // Recursively process children
      if (node.children) {
        node.children.forEach((child: any) =>
          buildPath(child, currentPath, y),
        );
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
  isVisible,
  lastMapNodeId,
  currentNodeId,
}: StoryMinimapProps) => {
  const { root } = tree;
  const coords = useCoords(root);
  const edges = useEdges(root);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastHighlightedNodeRef = useRef<string | null>(null);

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
  const coordValues = Object.values(coords);
  const xCoords = coordValues.map((c) => c.x);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const maxY = Math.max(...coordValues.map((c) => c.y));

  // Add padding around the tree
  const padding = LANE_WIDTH * 2;
  const svgWidth = Math.max(600, maxX - minX + padding * 2); // Ensure minimum width
  const svgHeight = Math.max(maxY + MAX_CONNECTOR_LENGTH, ROW_HEIGHT * 4);

  // Center the tree horizontally - offset all x coords so tree is centered
  const centerX = svgWidth / 2;
  const treeCenter = (minX + maxX) / 2;
  const rootOffset = centerX - treeCenter;

  // Track initial positioning so opening the map doesn't animate
  const hasPositionedRef = useRef(false);
  // Reset hasPositionedRef when map becomes invisible
  useEffect(() => {
    if (!isVisible) {
      hasPositionedRef.current = false;
    }
  }, [isVisible]);

  // Position viewport to keep highlighted/selected in view
  // Use layout effect so the map appears already positioned on open
  useLayoutEffect(() => {
    if (
      !viewportRef.current ||
      !highlightedNode ||
      !coords[highlightedNode.id]
    ) {
      return;
    }

    const viewport = viewportRef.current;
    const viewportRect = viewport.getBoundingClientRect();

    // A function to calculate the ideal scroll position to center a node (and its sibling)
    const getTargetScrollPosition = (
      node: StoryNode,
      sibling: StoryNode | null,
    ) => {
      const nodeCoord = coords[node.id];
      const nodeX = nodeCoord.x + rootOffset;
      const nodeY = nodeCoord.y;

      let minX = nodeX,
        maxX = nodeX,
        minY = nodeY,
        maxY = nodeY;

      if (sibling && coords[sibling.id]) {
        const siblingCoord = coords[sibling.id];
        const siblingX = siblingCoord.x + rootOffset;
        const siblingY = siblingCoord.y;
        minX = Math.min(minX, siblingX);
        maxX = Math.max(maxX, siblingX);
        minY = Math.min(minY, siblingY);
        maxY = Math.max(maxY, siblingY);
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const targetLeft = centerX - viewportRect.width / 2;
      const targetTop = centerY - viewportRect.height / 2;

      return {
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
      };
    };

    const isFirstPositioning = !hasPositionedRef.current;
    const nodeChangedSinceLastOpen =
      lastMapNodeId !== null && lastMapNodeId !== highlightedNode.id;

    // Calculate where we want to scroll TO
    const newTarget = getTargetScrollPosition(highlightedNode, selectedSibling);

    if (isFirstPositioning) {
      hasPositionedRef.current = true; // Mark as positioned

      if (nodeChangedSinceLastOpen && lastMapNodeId && coords[lastMapNodeId]) {
        // This is the key: we just opened the map after navigating.
        // We need to animate from the LAST position to the NEW one.
        const lastNode = coords[lastMapNodeId].path.slice(-1)[0];

        if (lastNode) {
          // 1. Calculate the scroll position of the OLD node.
          const oldTarget = getTargetScrollPosition(lastNode, null);

          // 2. JUMP to the old position instantly. The user won't see this frame.
          viewport.scrollLeft = oldTarget.left;
          viewport.scrollTop = oldTarget.top;

          // 3. In the NEXT frame, smoothly scroll to the new position.
          requestAnimationFrame(() => {
            viewport.scrollTo({
              left: newTarget.left,
              top: newTarget.top,
              behavior: "smooth",
            });
          });
        } else {
          // Fallback: last node not found, just jump to new position.
          viewport.scrollLeft = newTarget.left;
          viewport.scrollTop = newTarget.top;
        }
      } else {
        // It's the first time, but the node hasn't changed, or there's no history.
        // Just jump to the correct position without animation.
        viewport.scrollLeft = newTarget.left;
        viewport.scrollTop = newTarget.top;
      }
    } else {
      // The map is already open, so any change should be smooth.
      // This handles navigation within the map itself (if that feature is added)
      // or other reactive changes.
      if (
        viewport.scrollLeft !== newTarget.left ||
        viewport.scrollTop !== newTarget.top
      ) {
        viewport.scrollTo({
          left: newTarget.left,
          top: newTarget.top,
          behavior: "smooth",
        });
      }
    }
  }, [
    highlightedNode.id,
    selectedSibling?.id,
    coords,
    rootOffset,
    isVisible,
    lastMapNodeId,
  ]);

  return (
    <div className="minimap-container view-fade">
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
              const verticalGap = Math.max(0, b.y - a.y);

              if (a.lane === b.lane || verticalGap < 8) {
                // Straight line for same lane or very small spacing
                path = `M${ax},${a.y} L${bx},${b.y}`;
              } else {
                // Smooth curve whose depth reflects the spacing between nodes
                const horizontalGap = Math.abs(bx - ax);
                const baseVerticalControl = Math.min(
                  Math.max(verticalGap * 0.45, 18),
                  verticalGap - 8,
                );
                const controlYOffset1 = Math.min(
                  baseVerticalControl,
                  verticalGap / 2,
                );
                const controlYOffset2 = Math.min(
                  baseVerticalControl * 0.75,
                  verticalGap / 2,
                );
                const controlXShift = Math.min(
                  Math.max(horizontalGap * 0.35, 10),
                  60,
                );
                const controlX1 = bx > ax ? ax + controlXShift : ax - controlXShift;
                const controlX2 = bx > ax ? bx - controlXShift : bx + controlXShift;
                const controlY1 = a.y + controlYOffset1;
                const controlY2 = b.y - controlYOffset2;

                if (controlY2 <= controlY1) {
                  const midpoint = a.y + verticalGap / 2;
                  path = `M${ax},${a.y} C${controlX1},${midpoint} ${controlX2},${midpoint} ${bx},${b.y}`;
                } else {
                  path = `M${ax},${a.y} C${controlX1},${controlY1} ${controlX2},${controlY2} ${bx},${b.y}`;
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
