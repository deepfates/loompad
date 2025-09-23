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

/**
 * Props for StoryMinimap
 */
interface StoryMinimapProps {
  /**
   * Tree node data structure
   * @internal Passed by parent from current tree state
   */
  tree: StoryNode;

  /**
   * Currently displayed node
   * @internal Tracked from global state
   */
  currentNode: StoryNode;

  /**
   * User-selected node in minimap
   * @internal Local to minimap state
   */
  selectedNode: StoryNode | null;

  /**
   * Selection handler
   * @internal Called when user clicks minimap node
   */
  onSelectNode: (node: StoryNode) => void;

  /**
   * Navigate handler
   * @internal Triggered by double-click or enter key
   */
  onNavigateToNode: (node: StoryNode) => void;

  /**
   * Parent reference for viewport calculations
   * @internal Used for scroll syncing with main content
   */
  parentRef: React.RefObject<HTMLElement>;

  /**
   * Main content reference for scroll syncing
   * @internal Auto-scrolls minimap to match main view
   */
  terminalRef?: React.RefObject<HTMLElement>;
}

/**
 * Layout constants for consistent spacing
 */
const LANE_WIDTH = 20;
const ROW_HEIGHT = 10;

// Node dimensions - pages of varying heights
const MIN_NODE_HEIGHT = 6;
const MAX_NODE_HEIGHT = 30;
const CONNECTOR_LENGTH = 8;
const NODE_WIDTH = 14;
const NODE_RADIUS = 1;

/**
 * Calculate node positions using d3 tree layout
 */
function useCoords(
  tree: StoryNode,
  currentNode: StoryNode,
): Record<string, any> {
  return useMemo(() => {
    const coords: Record<string, any> = {};

    // Helper to get node height based on text length
    const getNodeHeight = (length: number): number => {
      if (length === 0) return MIN_NODE_HEIGHT;
      // Map text length to height range
      const normalizedLength = Math.min(length / 1000, 1); // Normalize to 0-1
      return (
        MIN_NODE_HEIGHT + normalizedLength * (MAX_NODE_HEIGHT - MIN_NODE_HEIGHT)
      );
    };

    // Create hierarchy from tree data
    const rootHierarchy = hierarchy<StoryNode>(tree, (d) => {
      if (!d.children || d.children.length === 0) return undefined;
      // Sort children to ensure consistent layout
      return [...d.children].sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
        return 0;
      });
    });

    // Count siblings for spacing
    rootHierarchy.each((node) => {
      const parent = node.parent;
      if (!parent) return;

      const siblings = parent.children || [];
      const siblingIndex = siblings.indexOf(node);

      node.data.siblingCount = siblings.length;
      node.data.siblingIndex = siblingIndex;
    });

    // Helper to calculate sizes for flextree
    const size = (node: any) => {
      const textLength = (node.data.text || "").length;
      const nodeHeight = getNodeHeight(textLength);
      return [LANE_WIDTH, nodeHeight + ROW_HEIGHT];
    };

    // Apply flextree layout with variable node sizes
    const treeLayout = flextree<StoryNode>({
      spacing: (a, b) => {
        // Tighter spacing for compact layout
        return a.parent === b.parent ? 0.5 : 1;
      },
      nodeSize: (node) => size(node),
    });

    // Calculate positions
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

    // Add metadata
    coords.root = tree;
    coords.currentNode = currentNode;

    return coords;
  }, [tree, currentNode]);
}

/**
 * Small buffer showing current location text
 * Positioned at bottom of viewport like a status bar
 */
const Minibuffer: React.FC<{ text: string }> = ({ text }) => (
  <div className="minimap-minibuffer">
    <div className="minimap-minibuffer-text">
      {text.slice(0, 80)}
      {text.length > 80 ? "..." : ""}
    </div>
  </div>
);

/**
 * Minimap component for navigating the story tree
 */
const StoryMinimap: React.FC<StoryMinimapProps> = ({
  tree,
  currentNode,
  selectedNode,
  onSelectNode,
  onNavigateToNode,
  parentRef,
  terminalRef,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const coords = useCoords(tree, currentNode);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedNode) return;

      if (e.key === "Enter") {
        onNavigateToNode(selectedNode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, onNavigateToNode]);

  // Auto-scroll to keep current node in view
  useLayoutEffect(() => {
    if (!viewportRef.current || !coords[currentNode.id]) return;

    const viewport = viewportRef.current;
    const nodeCoord = coords[currentNode.id];

    // Calculate node position in viewport coordinates
    const nodeX = nodeCoord.x;
    const viewportWidth = viewport.clientWidth;
    const scrollLeft = viewport.scrollLeft;

    // Check if node is outside viewport
    if (nodeX < scrollLeft || nodeX > scrollLeft + viewportWidth - NODE_WIDTH) {
      // Center the node in viewport
      viewport.scrollLeft = nodeX - viewportWidth / 2 + NODE_WIDTH / 2;
    }
  }, [currentNode.id, coords]);

  // Handle empty tree by rendering an empty viewport; dimensions below are guarded

  // Bounds for <svg> viewBox - ensure it's wide enough for scrolling
  const coordValues = Object.values(coords);
  const xCoords = coordValues.map((c) => c.x);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const maxY = Math.max(...coordValues.map((c) => c.y));

  // Add padding around the tree
  const padding = LANE_WIDTH * 2;
  const viewBoxWidth = Math.max(maxX - minX + padding * 2, 200);
  const viewBoxHeight = maxY + padding * 2;
  const viewBoxX = minX - padding;
  const viewBoxY = -padding;

  // Draw connector path between parent and child
  const drawConnector = (parentCoord: any, childCoord: any) => {
    const x1 = parentCoord.x + NODE_WIDTH / 2;
    const y1 = parentCoord.y + parentCoord.nodeHeight;
    const x2 = childCoord.x + NODE_WIDTH / 2;
    const y2 = childCoord.y;

    // Squircle-style connector: strong shoulders, then straight down
    const controlPointOffset = Math.min(CONNECTOR_LENGTH, (y2 - y1) * 0.3);

    return `
      M ${x1} ${y1}
      C ${x1} ${y1 + controlPointOffset},
        ${x2} ${y2 - controlPointOffset},
        ${x2} ${y2}
    `;
  };

  // Get visual properties for a node
  const getNodeClass = (node: StoryNode): string => {
    const classes = ["minimap-node"];

    if (node.id === currentNode.id) {
      classes.push("current");
    } else if (selectedNode && node.id === selectedNode.id) {
      classes.push("selected");
    } else if (coords[currentNode.id]?.path?.some((n: StoryNode) => n.id === node.id)) {
      classes.push("ancestor");
    } else if (coords[node.id]?.path?.some((n: StoryNode) => n.id === currentNode.id)) {
      classes.push("descendant");
    }

    return classes.join(" ");
  };

  const getConnectorClass = (parentNode: StoryNode, childNode: StoryNode): string => {
    const classes = ["minimap-connector"];
    const currentPath = coords[currentNode.id]?.path || [];

    // Check if this edge is part of the current path
    const parentInPath = currentPath.some((n: StoryNode) => n.id === parentNode.id);
    const childInPath = currentPath.some((n: StoryNode) => n.id === childNode.id);

    if (parentInPath && childInPath) {
      // Check if they're consecutive in the path
      const parentIndex = currentPath.findIndex((n: StoryNode) => n.id === parentNode.id);
      const childIndex = currentPath.findIndex((n: StoryNode) => n.id === childNode.id);
      if (Math.abs(parentIndex - childIndex) === 1) {
        classes.push("active-path");
      }
    }

    return classes.join(" ");
  };

  // If the tree is not loaded, show loading state
  if (!tree || Object.keys(coords).length === 0) {
    return (
      <div className="minimap-container">
        <div className="minimap-viewport loading">
          <div>Loading tree...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="minimap-container">
      <div className="minimap-viewport" ref={viewportRef}>
        <svg
          ref={svgRef}
          viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: `${viewBoxWidth}px`,
            height: `${viewBoxHeight}px`,
          }}
        >
          {/* Define patterns for visual effects */}
          <defs>
            {/* Diagonal lines pattern for ancestors */}
            <pattern
              id="diagonal-lines"
              patternUnits="userSpaceOnUse"
              width="3"
              height="3"
            >
              <path
                d="M0,3 L3,0"
                stroke="var(--font-color)"
                strokeWidth="0.5"
                opacity="0.3"
              />
            </pattern>

            {/* Dot pattern for path nodes */}
            <pattern
              id="dot-pattern"
              patternUnits="userSpaceOnUse"
              width="4"
              height="4"
            >
              <circle
                cx="2"
                cy="2"
                r="0.5"
                fill="var(--font-color)"
                opacity="0.3"
              />
            </pattern>

            {/* Solid pattern for current node */}
            <pattern
              id="solid-pattern"
              patternUnits="userSpaceOnUse"
              width="1"
              height="1"
            >
              <rect width="1" height="1" fill="var(--font-color)" />
            </pattern>
          </defs>

          {/* Render connectors first (behind nodes) */}
          {Object.entries(coords).map(([nodeId, coord]) => {
            if (typeof coord !== "object" || !coord.path) return null;
            const node = coord.path[coord.path.length - 1];
            if (!node.children) return null;

            return node.children.map((child) => {
              const childCoord = coords[child.id];
              if (!childCoord) return null;

              return (
                <path
                  key={`${nodeId}-${child.id}`}
                  d={drawConnector(coord, childCoord)}
                  className={getConnectorClass(node, child)}
                  fill="none"
                />
              );
            });
          })}

          {/* Render nodes */}
          {Object.entries(coords).map(([nodeId, coord]) => {
            if (typeof coord !== "object" || !coord.path) return null;
            const node = coord.path[coord.path.length - 1];
            const nodeClass = getNodeClass(node);
            const isCurrentNode = node.id === currentNode.id;
            const isSelectedNode = selectedNode && node.id === selectedNode.id;

            // Determine fill based on node state
            let fill = "none";
            if (isCurrentNode) {
              fill = "url(#solid-pattern)";
            } else if (coords[currentNode.id]?.path?.some((n: StoryNode) => n.id === node.id)) {
              fill = "url(#diagonal-lines)";
            } else if (isSelectedNode) {
              fill = "none";
            }

            return (
              <g
                key={nodeId}
                transform={`translate(${coord.x}, ${coord.y})`}
                className={nodeClass}
                onClick={() => onSelectNode(node)}
                onDoubleClick={() => onNavigateToNode(node)}
                style={{ cursor: "pointer" }}
              >
                {/* Node background - gameboy page style */}
                <rect
                  x={0}
                  y={0}
                  width={NODE_WIDTH}
                  height={coord.nodeHeight}
                  rx={NODE_RADIUS}
                  ry={NODE_RADIUS}
                  fill={fill}
                  stroke="var(--font-color)"
                  strokeWidth={isCurrentNode || isSelectedNode ? 1.5 : 0.5}
                  opacity={isCurrentNode ? 1 : isSelectedNode ? 0.9 : 0.6}
                />

                {/* Add subtle corner detail for page effect */}
                {(isCurrentNode || isSelectedNode) && (
                  <path
                    d={`M ${NODE_WIDTH - 3} 0 L ${NODE_WIDTH} 0 L ${NODE_WIDTH} 3`}
                    fill="none"
                    stroke="var(--font-color)"
                    strokeWidth={0.5}
                    opacity={0.5}
                  />
                )}

                {/* Text length indicator - small bars inside node */}
                {coord.length > 0 && (
                  <g opacity={0.3}>
                    {/* Create 1-3 bars based on text length */}
                    {Array.from({
                      length: Math.min(3, Math.ceil(coord.length / 333)),
                    }).map((_, i) => (
                      <rect
                        key={i}
                        x={3}
                        y={3 + i * 3}
                        width={NODE_WIDTH - 6}
                        height={1}
                        fill="var(--font-color)"
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {selectedNode && <Minibuffer text={selectedNode.text || ""} />}
    </div>
  );
};

export default StoryMinimap;
