import { useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { hierarchy } from "d3-hierarchy";
import { flextree } from "d3-flextree";
import type { StoryNode } from "../types";

/**
 * VISUAL DESIGN:
 * The minimap uses a gameboy/e-paper aesthetic with nodes as vertical "pages" of varying heights.
 * - Node height represents text length (taller = more text)
 * - Nodes are compact rectangles with crisp borders, like pages or circuit components
 * - Uses theme colors (--font-color, --primary-color) for intuitive connection with text view
 * - Visual hierarchy: Current node (solid) > Selected (primary) > Ancestors (diagonal pattern) > Path (dots) > Others (faint)
 * - Connectors are simple "wires" with squircle-style branches (strong shoulders, then straight down)
 * - Layout uses d3-flextree for variable node heights while preventing path crossings
 */
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
// Node heights adapt to the amount of text so the minimap
// conveys relative length at a glance.
const MIN_NODE_HEIGHT = 15;
const MAX_NODE_HEIGHT = 60;
// Exponent used to scale text length into a height signal. Values below 1
// keep very long passages from blowing up the layout while staying closer to a
// linear relationship than a logarithm.
const LENGTH_EXPONENT = 0.75;
const CONNECTOR_LENGTH = 12; // Fixed short connector between nodes
const NODE_WIDTH = 14; // Width of the pill-shaped nodes - compact
const NODE_RADIUS = 2; // Border radius for the pill shape - crisp corners
const ANGLE_RANGE = Math.PI * 1.6; // Spread nodes across 288 degrees for readability
const ANGLE_START = -ANGLE_RANGE / 2; // Center the spread around the vertical axis
const RADIAL_PADDING = 120; // Extra breathing room around the outermost nodes

type BaseCoord = {
  x: number;
  y: number;
  lane: number;
  depth: number;
  path: StoryNode[];
  length: number;
  nodeHeight: number;
};

type PolarCoord = BaseCoord & {
  angle: number;
  radiusTop: number;
  radiusCenter: number;
  radiusBottom: number;
};

type DisplayCoord = PolarCoord & {
  center: { x: number; y: number };
  top: { x: number; y: number };
  bottom: { x: number; y: number };
};

/**
 * Tidy tree layout using d3-hierarchy - no overlaps, optimal spacing
 */
function useCoords(root: StoryNode): Record<string, BaseCoord> {
  return useMemo(() => {
    const coords: Record<string, BaseCoord> = {};

    // Handle empty tree
    if (!root) return coords;

    // Create hierarchy from StoryNode tree
    const rootHierarchy = hierarchy(root, (d) => d.continuations);

    // Calculate connector lengths based on text
    const descendants = rootHierarchy.descendants();
    // Cache scaled lengths to avoid redundant calculations
    const scaledLengthMap: Record<string, number> = {};
    descendants.forEach((node) => {
      scaledLengthMap[node.data.id] = Math.pow(
        (node.data.text || "").length + 1,
        LENGTH_EXPONENT,
      );
    });
    const scaledLengths = Object.values(scaledLengthMap);
    const minScaledLength =
      scaledLengths.length === 0 ? 0 : Math.min(...scaledLengths);
    const maxScaledLength =
      scaledLengths.length === 0 ? 0 : Math.max(...scaledLengths);
    const scaledRange = maxScaledLength - minScaledLength || 1;

    const getNodeHeight = (textLength: number) => {
      const scaledLength = Math.pow(textLength + 1, LENGTH_EXPONENT);
      const normalized =
        maxScaledLength === minScaledLength
          ? 0.5
          : (scaledLength - minScaledLength) / scaledRange;

      return (
        MIN_NODE_HEIGHT +
        normalized * (MAX_NODE_HEIGHT - MIN_NODE_HEIGHT)
      );
    };

    // Apply flextree layout with variable node sizes
    const treeLayout = flextree<StoryNode>({
      spacing: (a, b) => {
        // Tighter spacing for compact layout
        return a.parent === b.parent ? NODE_WIDTH * 1.2 : NODE_WIDTH * 0.8;
      },
      nodeSize: (node) => {
        const textLength = (node.data.text || "").length;
        const nodeHeight = getNodeHeight(textLength);
        // Total height is node height plus connector to next level
        return [NODE_WIDTH, nodeHeight + CONNECTOR_LENGTH];
      }
    });

    const rootPoint = treeLayout(rootHierarchy);
    // Build coords from flextree's calculated positions
    const buildPath = (node: any, path: StoryNode[] = []): StoryNode[] => {
      const currentPath = [...path, node.data];
      const textLength = (node.data.text || "").length;
      const nodeHeight = getNodeHeight(textLength);

      coords[node.data.id] = {
        x: node.x || 0,
        y: node.y || 0,  // Use flextree's calculated Y position
        lane: Math.round((node.x || 0) / LANE_WIDTH),
        depth: node.depth || 0,
        path: currentPath,
        length: textLength,
        nodeHeight,
      };

      // Recursively process children
      if (node.children) {

        node.children.forEach((child: any) =>
          buildPath(child, currentPath),
        );
      }

      return currentPath;
    };

    buildPath(rootPoint);

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

  // Pre-compute polar coordinates derived from the flextree layout
  const { radialCoords, maxRadius } = useMemo(() => {
    const entries = Object.entries(coords);
    if (entries.length === 0) {
      return { radialCoords: {} as Record<string, PolarCoord>, maxRadius: 0 };
    }

    const xs = entries.map(([, c]) => c.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const xRange = maxX - minX || 1;

    let maxRadius = 0;
    const mapped: Record<string, PolarCoord> = {};

    entries.forEach(([id, c]) => {
      const normalizedX = (c.x - minX) / xRange;
      const angle = ANGLE_START + normalizedX * ANGLE_RANGE;
      const radiusTop = c.y;
      const radiusBottom = c.y + c.nodeHeight;
      const radiusCenter = (radiusTop + radiusBottom) / 2;

      maxRadius = Math.max(maxRadius, radiusBottom);

      mapped[id] = {
        ...c,
        angle,
        radiusTop,
        radiusCenter,
        radiusBottom,
      };
    });

    return { radialCoords: mapped, maxRadius };
  }, [coords]);

  const highlightedAngle =
    highlightedNode && radialCoords[highlightedNode.id]
      ? radialCoords[highlightedNode.id].angle
      : 0;
  const rotationOffset = useMemo(
    () => -Math.PI / 2 - highlightedAngle,
    [highlightedAngle],
  );

  const svgRadius = maxRadius + RADIAL_PADDING;
  const svgDiameter = Math.max(600, svgRadius * 2);
  const svgWidth = svgDiameter;
  const svgHeight = svgDiameter;
  const centerPoint = svgDiameter / 2;

  const displayCoords = useMemo(() => {
    const convert = (angle: number, radius: number) => {
      const rotated = angle + rotationOffset;
      return {
        x: centerPoint + radius * Math.cos(rotated),
        y: centerPoint + radius * Math.sin(rotated),
      };
    };

    const mapped: Record<string, DisplayCoord> = {};

    Object.entries(radialCoords).forEach(([id, c]) => {
      const center = convert(c.angle, c.radiusCenter);
      mapped[id] = {
        ...c,
        center,
        top: convert(c.angle, Math.max(0, c.radiusTop)),
        bottom: convert(c.angle, c.radiusBottom),
      };
    });

    return mapped;
  }, [centerPoint, radialCoords, rotationOffset]);

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
      !displayCoords[highlightedNode.id]
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
      const nodeCoord = displayCoords[node.id];
      const nodeX = nodeCoord.center.x;
      const nodeY = nodeCoord.center.y;

      let minX = nodeX,
        maxX = nodeX,
        minY = nodeY,
        maxY = nodeY;

      if (sibling && displayCoords[sibling.id]) {
        const siblingCoord = displayCoords[sibling.id];
        const siblingX = siblingCoord.center.x;
        const siblingY = siblingCoord.center.y;
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

      if (
        nodeChangedSinceLastOpen &&
        lastMapNodeId &&
        displayCoords[lastMapNodeId]
      ) {
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
    displayCoords,
    coords,
    isVisible,
    lastMapNodeId,
  ]);

  return (
    <div className="minimap-container view-fade">
      <div ref={viewportRef} className="minimap-viewport">
        <div style={{ width: svgWidth, minWidth: "100%" }}>
          <svg width={svgWidth} height={svgHeight}>
            {/* Define patterns for different node states */}
            <defs>
              {/* Subtle stripe pattern for ancestors - they've been read */}
              <pattern id="ancestorPattern" patternUnits="userSpaceOnUse" width="4" height="4">
                <rect width="4" height="4" fill="var(--surface-color)" />
                <line x1="0" y1="0" x2="0" y2="4" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3"/>
                <line x1="2" y1="0" x2="2" y2="4" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
              {/* Dots for favorite path - breadcrumb trail */}
              <pattern id="pathPattern" patternUnits="userSpaceOnUse" width="4" height="4">
                <rect width="4" height="4" fill="var(--surface-color)" />
                <circle cx="2" cy="2" r="0.4" fill="var(--secondary-color)"/>
              </pattern>
            </defs>
            {/* Render edges first so they sit behind nodes */}
            {edges.map(({ from, to, key }) => {
              const a = displayCoords[from.id];
              const b = displayCoords[to.id];
              if (!a || !b) return null;

              // Check if this edge is part of the ancestor path
              const isAncestorEdge =
                highlightedNode &&
                currentPath.some((node) => node.id === from.id) &&
                currentPath.some((node) => node.id === to.id);

              const start = a.bottom;
              const end = b.top;

              const midRadius = Math.max(a.radiusBottom, b.radiusTop) + CONNECTOR_LENGTH;
              const midAngle = (a.angle + b.angle) / 2;
              const rotatedMidAngle = midAngle + rotationOffset;
              const midPoint = {
                x: centerPoint + midRadius * Math.cos(rotatedMidAngle),
                y: centerPoint + midRadius * Math.sin(rotatedMidAngle),
              };

              const path = `M${start.x},${start.y} Q${midPoint.x},${midPoint.y} ${end.x},${end.y}`;

              return (
                <path
                  key={key}
                  d={path}
                  stroke={
                    isAncestorEdge ? "var(--secondary-color)" : "var(--border-color)"
                  }
                  strokeWidth={isAncestorEdge ? 1.2 : 0.8}
                  fill="none"
                  strokeLinecap="round"
                  opacity={isAncestorEdge ? 0.8 : 0.4}
                />
              );
            })}

            {/* Nodes */}
            {Object.entries(displayCoords).map(([id, c]) => {
              const node = c.path[c.path.length - 1];
              const isHighlighted = id === highlightedNode.id;
              const isSelected = selectedSibling && id === selectedSibling.id;
              const isGenerating = inFlight.has(id);
              const isOnFavoritePath = currentPath.some(
                (pathNode) => pathNode.id === id,
              );
              // Check if this node is an ancestor of the highlighted node
              const isAncestor = coords[highlightedNode.id] &&
                id !== highlightedNode.id &&
                coords[highlightedNode.id].path.some((pathNode: StoryNode) => pathNode.id === id);

              return (
                <g
                  key={id}
                  onClick={() => onSelectNode?.(c.path)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Draw node as an elongated pill/capsule shape */}
                  <rect
                    className={`minimap-node ${isGenerating ? "generating" : ""}`}
                    x={c.center.x - NODE_WIDTH / 2}
                    y={c.center.y - c.nodeHeight / 2}
                    width={NODE_WIDTH}
                    height={c.nodeHeight}
                    rx={NODE_RADIUS}
                    ry={NODE_RADIUS}
                    fill={
                      isHighlighted
                        ? "var(--surface-color)"  // Current - white/bright text color in dark mode
                        : isSelected
                          ? "var(--primary-color)"  // Next option - blue/primary
                          : isGenerating
                              ? "var(--primary-color)"  // Generating - pulsing blue
                              : isAncestor || isOnFavoritePath
                                ? "var(--surface-color)"  // Already read or on breadcrumb trail
                                : "var(--background-color)"  // Unvisited - empty
                    }
                    stroke="var(--font-color)"
                    strokeWidth={
                      isHighlighted || isSelected ? 1.5 : 0.8
                    }
                    opacity={
                      isHighlighted
                        ? 1  // Current - full brightness
                        : isSelected
                          ? 0.9  // Next - prominent but not current
                        : isGenerating
                            ? 1  // Generating - full brightness with pulse animation
                            : isAncestor
                              ? 0.6 // Already read - visible but less prominent
                              : isOnFavoritePath
                                ? 0.5  // Path - semi-visible
                                : 0.4  // Unvisited - barely visible
                    }
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
