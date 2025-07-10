import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Sprite, Assets, Spritesheet, Texture, Ticker, Container } from 'pixi.js';
import { useGardenStore } from '../stores/gardenStore';
import type { TreePosition } from '../types/garden';

interface IsometricGardenVisualizerProps {
  width?: number;
  height?: number;
  selectedNodeId?: string; // Add selected node prop
  currentDepth?: number; // Add current depth prop for preview selection
  selectedOptions?: number[]; // Add selected options prop for preview selection
}

interface IsometricTree {
  x: number;
  y: number;
  trunkHeight: number;
  rootId: string; // Add rootId for node mapping
  branches: Array<{
    x: number;
    y: number;
    height: number;
    depth?: number;
    parentId?: string;
    isLeaf?: boolean;
  }>;
  parentChildMap?: Map<string, string[]>; // Store parent-child relationships
  nodePositionMap?: Map<string, { x: number; y: number; depth: number; isLeaf: boolean }>; // Store node positions
}

const GRID_SIZE = 200; // Increased to 200x200 for more space
const TILE_WIDTH = 32; // Reduced from 64 to 32
const TILE_HEIGHT = 32; // Reduced from 64 to 32
const CAMERA_SPEED = 5; // Speed for arrow key movement
const MOUSE_DRAG_SPEED = 1.5; // Speed for mouse drag
const TRUNK_SCALE = 1.0; // Trunk thickness multiplier
const BRANCH_SCALE = 1.25; // Branch thickness multiplier
// Map old tile names to new tile indices in the 7x7 tileset
const TILESET_MAP = {
  grass: 'tile_0_0',
  dirt: 'tile_0_1',
  sand: 'tile_0_2',
  mud: 'tile_0_3',
  stone: 'tile_0_4',
  bush: 'tile_0_5',
  flowers_red: 'tile_0_6',
  flowers_blue: 'tile_1_0',
};

const TILE_FRAMES = Object.values(TILESET_MAP);
const BRANCH_TEXTURE_KEY = 'tile_2_0';
const PREVIEW_TEXTURE_KEY = 'tile_1_5';
const LEAF_TILE_KEY = 'tile_3_6';
const HIGHLIGHT_TEXTURE_KEY = 'tile_6_6';

function isoToScreen(x: number, y: number) {
  return [
    (x - y) * (TILE_WIDTH / 2),
    (x + y) * (TILE_HEIGHT / 4) // 1/4 for isometric vertical squish
  ];
}

const ATLAS_URL = '/client/assets/sprites/tileset.json';
const IMAGE_URL = '/client/assets/sprites/tileset.png';
// const TILE_FRAMES = [
//   'grass', 'dirt', 'water', 'sand',
//   'tree_small', 'tree_large', 'pine_tree',
//   'bush', 'shrub',
//   'flowers_red', 'flowers_yellow', 'flowers_blue', 'flowers_purple',
//   'stone', 'mud'
// ];

// Generate trees from garden store data
const generateTreesFromStore = (trees: any[], gridSize: number): IsometricTree[] => {
  const isometricTrees: IsometricTree[] = [];
  
  // Gaussian distribution configuration
  const POSITION_SCALE = 0.15; // Scale for mapping 3D to 2D positions
  const BASE_GAUSSIAN_RADIUS = 3; // Base radius for Gaussian distribution
  const DEPTH_RADIUS_MULTIPLIER = 0.75; // How much radius increases with depth
  const BRANCH_HEIGHT_MIN = 8; // Minimum branch height (doubled from 4)
  const BRANCH_HEIGHT_MAX = 10; // Maximum branch height (doubled from 5)
  const TRUNK_HEIGHT_MIN = 16; // Minimum trunk height (doubled from 8)
  const TRUNK_HEIGHT_MAX = 18; // Maximum trunk height (doubled from 9)
  const MAX_BRANCH_DEPTH = 6; // Maximum depth for branch recursion
  const DEPTH_HEIGHT_REDUCTION = 0.7; // How much height reduces with each depth level
  const DEPTH_VERTICAL_OFFSET = 2; // Vertical offset reduction per depth level
  
  // Track parent-child relationships for connection mapping
  const parentChildMap = new Map<string, string[]>();
  const nodePositionMap = new Map<string, { x: number; y: number; depth: number; isLeaf: boolean }>();

  // Map 3D positions to 2D grid positions
  const map3DToGrid = (position: TreePosition): { x: number; y: number } => {
    const offsetX = gridSize / 2;
    const offsetY = gridSize / 2;
    return {
      x: Math.floor((position.x * POSITION_SCALE) + offsetX),
      y: Math.floor((position.z * POSITION_SCALE) + offsetY)
    };
  };

  // Generate Gaussian random position around a center point
  const generateGaussianPosition = (centerX: number, centerY: number, radius: number): { x: number; y: number } => {
    // Box-Muller transform for Gaussian distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    
    // Scale by radius and add to center
    const x = centerX + z0 * radius * 0.5;
    const y = centerY + z1 * radius * 0.5;
    
    return { x: Math.floor(x), y: Math.floor(y) };
  };

  // Ensure position is within grid bounds
  const clampToGrid = (pos: { x: number; y: number }): { x: number; y: number } => {
    return {
      x: Math.max(0, Math.min(gridSize - 1, pos.x)),
      y: Math.max(0, Math.min(gridSize - 1, pos.y))
    };
  };

  // Recursive function to build nodes using Gaussian distribution with depth-based sizing
  function buildBranches(node, parentPosition, parentHeight, depth = 0, maxDepth = MAX_BRANCH_DEPTH, parentNodeId?: string) {
    if (!node) return [];
    if (depth > maxDepth) return [];
    const nodes = [];
    
    // Calculate depth-based height reduction
    const depthHeightMultiplier = Math.pow(DEPTH_HEIGHT_REDUCTION, depth);
    const baseNodeHeight = Math.floor(Math.random() * (BRANCH_HEIGHT_MAX - BRANCH_HEIGHT_MIN + 1)) + BRANCH_HEIGHT_MIN;
    const actualNodeHeight = Math.max(1, Math.floor(baseNodeHeight * depthHeightMultiplier));
    
    // Generate position using Gaussian distribution centered at parent
    const radius = BASE_GAUSSIAN_RADIUS * Math.pow(DEPTH_RADIUS_MULTIPLIER, depth);
    let nodePosition = generateGaussianPosition(parentPosition.x, parentPosition.y, radius);
    nodePosition = clampToGrid(nodePosition);
    
    // Debug: Log parent-child relationship for Gaussian distribution
    if (depth <= 2) { // Only log first few levels to avoid spam
      const nodeType = (!node.continuations || node.continuations.length === 0) ? 'LEAF' : 'BRANCH';
      console.log(`[GAUSSIAN DEBUG] Depth ${depth} (${nodeType}): Parent at (${parentPosition.x}, ${parentPosition.y}) -> Node at (${nodePosition.x}, ${nodePosition.y}), radius: ${radius}`);
    }
    
    // Create node with unified structure
    const isLeaf = !node.continuations || node.continuations.length === 0;
    const nodeData = {
      x: nodePosition.x,
      y: nodePosition.y,
      height: isLeaf ? 1 : actualNodeHeight, // Leaves are always height 1, branches use calculated height
      depth,
      parentId: node.id,
      isLeaf
    };
    nodes.push(nodeData);
    
    // Track parent-child relationship
    if (parentNodeId) {
      if (!parentChildMap.has(parentNodeId)) {
        parentChildMap.set(parentNodeId, []);
      }
      parentChildMap.get(parentNodeId)!.push(node.id);
    }
    
    // Store node position for connection mapping
    nodePositionMap.set(node.id, {
      x: nodePosition.x,
      y: nodePosition.y,
      depth,
      isLeaf
    });
    
    // Recursively build child nodes from this node's position
    if (!isLeaf) {
      for (let i = 0; i < node.continuations.length; i++) {
        const child = node.continuations[i];
        const childNodes = buildBranches(child, nodePosition, actualNodeHeight, depth + 1, maxDepth, node.id);
        nodes.push(...childNodes);
      }
    }
    
    return nodes;
  }

  trees.forEach((tree) => {
    if (!tree.position || !tree.root) return;
    const gridPos = map3DToGrid(tree.position);
    if (gridPos.x < 0 || gridPos.x >= gridSize || gridPos.y < 0 || gridPos.y >= gridSize) return;
    
    // Clear maps for this tree to avoid mixing relationships
    parentChildMap.clear();
    nodePositionMap.clear();
    
    // Use the mapped grid position as trunk position
    let trunkPosition = gridPos;
    trunkPosition = clampToGrid(trunkPosition);
    
    // Generate trunk height
    const trunkHeight = Math.floor(Math.random() * (TRUNK_HEIGHT_MAX - TRUNK_HEIGHT_MIN + 1)) + TRUNK_HEIGHT_MIN;
    
    // Build all nodes recursively from the trunk position
    const trunkPosition2D = { x: trunkPosition.x, y: trunkPosition.y };
    const nodes = [];
    if (tree.root.continuations && tree.root.continuations.length > 0) {
      for (let i = 0; i < tree.root.continuations.length; i++) {
        const child = tree.root.continuations[i];
        const childNodes = buildBranches(child, trunkPosition2D, trunkHeight, 0, MAX_BRANCH_DEPTH, tree.root.id);
        nodes.push(...childNodes);
      }
    }
    
    isometricTrees.push({
      x: trunkPosition.x,
      y: trunkPosition.y,
      trunkHeight,
      rootId: tree.root.id,
      branches: nodes, // Keep the property name as 'branches' for compatibility
      parentChildMap: new Map(parentChildMap), // Store the parent-child relationships
      nodePositionMap: new Map(nodePositionMap) // Store node positions
    });
  });
  
  return isometricTrees;
};

// Pathfinding and connection system
interface ConnectionPath {
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  pathPoints: Array<{ x: number; y: number; z: number }>;
  sprites: Sprite[];
}

interface NodePosition {
  x: number;
  y: number;
  z: number;
  nodeId: string;
  isTop: boolean; // true for top of node, false for bottom
}

// Calculate the top and bottom positions of a node
const calculateNodePositions = (tree: IsometricTree, node: any, trunkBaseZ: number): { top: NodePosition; bottom: NodePosition } => {
  // Calculate accumulated height from trunk and parent nodes
  let accumulatedHeight = tree.trunkHeight;
  const depth = node.depth || 0;
  
  // Add height from parent nodes at lower depths
  tree.branches.forEach(parentNode => {
    if (parentNode.depth !== undefined && parentNode.depth < depth && !parentNode.isLeaf) {
      accumulatedHeight += parentNode.height;
    }
  });
  
  const nodeBaseZ = trunkBaseZ + accumulatedHeight - 1;
  const nodeTopZ = nodeBaseZ + node.height;
  
  const [screenX, screenY] = isoToScreen(node.x, node.y);
  
  return {
    top: {
      x: screenX,
      y: screenY - nodeTopZ * (TILE_HEIGHT / 4),
      z: nodeTopZ,
      nodeId: node.parentId,
      isTop: true
    },
    bottom: {
      x: screenX,
      y: screenY - nodeBaseZ * (TILE_HEIGHT / 4),
      z: nodeBaseZ,
      nodeId: node.parentId,
      isTop: false
    }
  };
};

// Calculate trunk positions
const calculateTrunkPositions = (tree: IsometricTree, trunkBaseZ: number): { top: NodePosition; bottom: NodePosition } => {
  const [screenX, screenY] = isoToScreen(tree.x, tree.y);
  const trunkTopZ = trunkBaseZ + tree.trunkHeight;
  
  return {
    top: {
      x: screenX,
      y: screenY - trunkTopZ * (TILE_HEIGHT / 4),
      z: trunkTopZ,
      nodeId: tree.rootId,
      isTop: true
    },
    bottom: {
      x: screenX,
      y: screenY - trunkBaseZ * (TILE_HEIGHT / 4),
      z: trunkBaseZ,
      nodeId: tree.rootId,
      isTop: false
    }
  };
};

// Simple pathfinding algorithm to connect two points with sprite blocks
const createConnectionPath = (start: NodePosition, end: NodePosition): ConnectionPath => {
  const pathPoints: Array<{ x: number; y: number; z: number }> = [];
  
  // Start from the top of parent node
  let currentX = start.x;
  let currentY = start.y;
  let currentZ = start.z;
  
  // Add start point
  pathPoints.push({ x: currentX, y: currentY, z: currentZ });
  
  // Step 1: Move up slightly from parent top
  const upOffset = 2;
  currentZ += upOffset;
  pathPoints.push({ x: currentX, y: currentY, z: currentZ });
  
  // Step 2: Move horizontally towards child (X direction) - more dense
  const xDiff = end.x - currentX;
  const xSteps = Math.max(12, Math.abs(xDiff) / 6); // Even more dense: 6 pixels per step, minimum 12 steps
  const xStepSize = xDiff / Math.max(1, xSteps);
  
  for (let i = 0; i < xSteps; i++) {
    currentX += xStepSize;
    pathPoints.push({ x: currentX, y: currentY, z: currentZ });
    
    // Add intermediate points for even more density
    if (i < xSteps - 1) {
      const midX = currentX + xStepSize * 0.5;
      pathPoints.push({ x: midX, y: currentY, z: currentZ });
    }
  }
  
  // Step 3: Move horizontally towards child (Y direction) - more dense
  const yDiff = end.y - currentY;
  const ySteps = Math.max(12, Math.abs(yDiff) / 6); // Even more dense: 6 pixels per step, minimum 12 steps
  const yStepSize = yDiff / Math.max(1, ySteps);
  
  for (let i = 0; i < ySteps; i++) {
    currentY += yStepSize;
    pathPoints.push({ x: currentX, y: currentY, z: currentZ });
    
    // Add intermediate points for even more density
    if (i < ySteps - 1) {
      const midY = currentY + yStepSize * 0.5;
      pathPoints.push({ x: currentX, y: midY, z: currentZ });
    }
  }
  
  // Step 4: Move down to child bottom
  const downOffset = 2;
  currentZ = end.z - downOffset;
  pathPoints.push({ x: currentX, y: currentY, z: currentZ });
  
  // Add end point
  pathPoints.push({ x: end.x, y: end.y, z: end.z });
  
  return {
    startX: start.x,
    startY: start.y,
    startZ: start.z,
    endX: end.x,
    endY: end.y,
    endZ: end.z,
    pathPoints,
    sprites: []
  };
};

// Create sprites for connection path
const createConnectionSprites = (path: ConnectionPath, spritesheet: Spritesheet, container: Container): Sprite[] => {
  const connectionSprites: Sprite[] = [];
  
  // Use the same texture as branches ("stone")
  const connectionTexture = spritesheet.textures[BRANCH_TEXTURE_KEY];
  
  path.pathPoints.forEach((point, index) => {
    if (index === 0 || index === path.pathPoints.length - 1) return; // Skip start and end points
    
    // Only create sprites for every other point to avoid overcrowding
    if (index % 2 === 0) {
      const sprite = new Sprite(connectionTexture);
      sprite.anchor.set(0.5, 1);
      sprite.x = point.x;
      sprite.y = point.y;
      sprite.scale.set(0.5, 0.5); // Consistent thin size for connections and branches
      sprite.tint = 0x8B7355; // Brown color for connections
      sprite.alpha = 1.0; // Fully opaque for consistency
      
      container.addChild(sprite);
      connectionSprites.push(sprite);
    }
  });
  
  return connectionSprites;
};

// Define biomes and their tile groups (user-specified tile assignments)
const BIOMES = {
  grassland: ['tile_0_0', 'tile_0_1', 'tile_0_2', 'tile_0_3', 'tile_0_4'],
  desert:    ['tile_2_5', 'tile_2_6', 'tile_3_5', 'tile_4_1', 'tile_4_2'],
  forest:    ['tile_3_0', 'tile_3_1', 'tile_3_6'],
  tundra:    ['tile_0_6', 'tile_5_0', 'tile_5_1'],
  swamp:     ['tile_2_2', 'tile_3_2', 'tile_4_2', 'tile_4_3'],
  rock:      ['tile_2_4', 'tile_2_5', 'tile_3_4', 'tile_3_5'],
  light_grass: [
    'tile_6_1', 'tile_6_1', 'tile_6_1', 'tile_6_1', 'tile_6_1', 'tile_6_1', 'tile_6_1', // 5x more likely
    'tile_6_4',
  ],
};
const BIOME_LIST = ['light_grass'];
const wave_amplitude = 0;

// Generate a stochastic biome map (random-walk smoothing)
function generateBiomeMap(size: number) {
  const map: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (x === 0 && y === 0) {
        map[x][y] = BIOME_LIST[Math.floor(Math.random() * BIOME_LIST.length)];
      } else if (x === 0) {
        map[x][y] = Math.random() < 0.85 ? map[x][y-1] : BIOME_LIST[Math.floor(Math.random() * BIOME_LIST.length)];
      } else if (y === 0) {
        map[x][y] = Math.random() < 0.85 ? map[x-1][y] : BIOME_LIST[Math.floor(Math.random() * BIOME_LIST.length)];
      } else {
        const neighbors = [map[x-1][y], map[x][y-1]];
        map[x][y] = Math.random() < 0.7 ? neighbors[Math.floor(Math.random() * neighbors.length)] : BIOME_LIST[Math.floor(Math.random() * BIOME_LIST.length)];
      }
    }
  }
  return map;
}

// Generate a stochastic tile map for each biome region
function generateStochasticTileMap(biomeMap, biomes) {
  const size = biomeMap.length;
  const tileMap = Array.from({ length: size }, () => Array(size).fill(null));
  for (const biome of Object.keys(biomes)) {
    const tileGroup = biomes[biome];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        if (biomeMap[x][y] !== biome) continue;
        if (x === 0 && y === 0) {
          tileMap[x][y] = tileGroup[Math.floor(Math.random() * tileGroup.length)];
        } else if (x === 0) {
          tileMap[x][y] = Math.random() < 0.85 ? tileMap[x][y-1] : tileGroup[Math.floor(Math.random() * tileGroup.length)];
        } else if (y === 0) {
          tileMap[x][y] = Math.random() < 0.85 ? tileMap[x-1][y] : tileGroup[Math.floor(Math.random() * tileGroup.length)];
        } else {
          const neighbors = [tileMap[x-1][y], tileMap[x][y-1]].filter(t => t && tileGroup.includes(t));
          tileMap[x][y] = (neighbors.length && Math.random() < 0.7)
            ? neighbors[Math.floor(Math.random() * neighbors.length)]
            : tileGroup[Math.floor(Math.random() * tileGroup.length)];
        }
      }
    }
  }
  return tileMap;
}

const IsometricGardenVisualizer: React.FC<IsometricGardenVisualizerProps> = ({
  width = 800,
  height = 640,
  selectedNodeId, // Add prop
  currentDepth = 0, // Add current depth prop
  selectedOptions = [] // Add selected options prop
}) => {
  console.log(`[COMPONENT DEBUG] IsometricGardenVisualizer received selectedNodeId:`, selectedNodeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>();
  const tilesRef = useRef<Sprite[][]>([]);
  const treeSpritesRef = useRef<Sprite[]>([]);
  const connectionSpritesRef = useRef<Sprite[]>([]); // Store connection sprites
  const tickerRef = useRef<Ticker>();
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1.0); // Add zoom level reference
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const keysPressedRef = useRef<Set<string>>(new Set());
  const [isSceneInitialized, setIsSceneInitialized] = useState(false);
  const [treesGenerated, setTreesGenerated] = useState(false);

  // Get trees from garden store
  const { trees, selectedTree, getPathFromRoot } = useGardenStore();

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    keysPressedRef.current.add(event.key.toLowerCase());
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysPressedRef.current.delete(event.key.toLowerCase());
  }, []);

  // Handle mouse events
  const handleMouseDown = useCallback((event: MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isDraggingRef.current) {
      const deltaX = event.clientX - lastMousePosRef.current.x;
      const deltaY = event.clientY - lastMousePosRef.current.y;
      
      cameraRef.current.x += deltaX * MOUSE_DRAG_SPEED;
      cameraRef.current.y += deltaY * MOUSE_DRAG_SPEED;
      
      lastMousePosRef.current = { x: event.clientX, y: event.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    
    const zoomSpeed = 0.1;
    const zoomDelta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const newZoom = Math.max(0.1, Math.min(3.0, zoomRef.current + zoomDelta));
    
    // Calculate mouse position relative to the container
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate zoom center point
    const zoomCenterX = mouseX - cameraRef.current.x;
    const zoomCenterY = mouseY - cameraRef.current.y;
    
    // Update camera position to zoom towards mouse cursor
    cameraRef.current.x = mouseX - zoomCenterX * (newZoom / zoomRef.current);
    cameraRef.current.y = mouseY - zoomCenterY * (newZoom / zoomRef.current);
    
    zoomRef.current = newZoom;
    
    console.log(`[ZOOM] Zoom level: ${zoomRef.current.toFixed(2)}`);
  }, []);

  // Map nodeId to sprite(s) for highlighting
  const nodeSpriteMap = useRef<Record<string, Sprite[]>>({});
  // Map connection sprites to node relationships (parentId -> childId -> sprites[])
  const connectionSpriteMap = useRef<Record<string, Record<string, Sprite[]>>>({});
  // Store original tints using WeakMap
  const spriteOriginalTints = useRef<WeakMap<Sprite, number>>(new WeakMap());
  // Store original textures using WeakMap
  const spriteOriginalTextures = useRef<WeakMap<Sprite, Texture>>(new WeakMap());
  // Store highlight texture reference
  const highlightTextureRef = useRef<Texture | null>(null);
  // Store preview texture reference for child preview selection
  const previewTextureRef = useRef<Texture | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    let resizeObserver: ResizeObserver | null = null;
    let isInitialized = false;

    // Handle resize with debouncing
    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastWidth = 0;
    let lastHeight = 0;
    const handleResize = () => {
      if (!containerRef.current || !appRef.current) return;
      
      // Clear existing timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Debounce resize to prevent infinite loops
      resizeTimeout = setTimeout(() => {
        const container = containerRef.current;
        if (!container || !appRef.current || !isInitialized) return;
        
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        
        // Only resize if dimensions actually changed significantly and are valid
        const widthChanged = Math.abs(newWidth - lastWidth) > 5;
        const heightChanged = Math.abs(newHeight - lastHeight) > 5;
        
        if (newWidth > 0 && newHeight > 0 && !isNaN(newWidth) && !isNaN(newHeight) && (widthChanged || heightChanged)) {
          appRef.current.renderer.resize(newWidth, newHeight);
          lastWidth = newWidth;
          lastHeight = newHeight;
          console.log('IsometricGardenVisualizer resized:', { width: newWidth, height: newHeight });
        }
      }, 100); // 100ms debounce
    };

    const initPixiJS = async () => {
      try {
        const app = new Application();
        await app.init({
          width: width,
          height: height,
          backgroundColor: 0x00000000, // Transparent background
          antialias: true,
          resolution: 1,
          autoDensity: true
        });

        // Load the atlas and image
        let atlas;
        try {
          const response = await fetch(ATLAS_URL);
          atlas = await response.json();
          console.log('Atlas loaded:', atlas);
        } catch (e) {
          console.error('Failed to load atlas JSON:', e);
          return;
        }
        
        let spritesheet;
        try {
          const texture = await Assets.load(IMAGE_URL);
          console.log('Texture loaded:', texture);
          if (!texture) {
            console.error('Texture is undefined');
            return;
          }
          spritesheet = new Spritesheet(texture, atlas);
          await spritesheet.parse();
          console.log('Spritesheet parsed successfully');
        } catch (e) {
          console.error('Failed to parse spritesheet:', e);
          return;
        }

        // Check all frames exist
        for (const frame of TILE_FRAMES) {
          if (!spritesheet.textures[frame]) {
            console.error(`Frame '${frame}' not found in atlas`);
            return;
          }
        }

        // Set up highlight texture for node selection - use a more visible texture
        highlightTextureRef.current = spritesheet.textures[HIGHLIGHT_TEXTURE_KEY];
        // Set up preview texture for child preview selection - use PREVIEW_TEXTURE_KEY
        previewTextureRef.current = spritesheet.textures[PREVIEW_TEXTURE_KEY];

        // Create a container for all tiles
        const tileContainer = new Container();
        app.stage.addChild(tileContainer);

        const centerX = width / 2;
        const centerY = height / 2;

          // Generate trees from garden store data
  const isometricTrees = generateTreesFromStore(trees, GRID_SIZE);
  console.log(`Generated ${isometricTrees.length} trees from garden store`);
  
  // Debug: Log tree positions to verify no overlaps
  const allPositions = new Set<string>();
  let hasOverlaps = false;
  isometricTrees.forEach((tree, treeIndex) => {
    const trunkPos = `${tree.x},${tree.y}`;
    if (allPositions.has(trunkPos)) {
      console.warn(`[OVERLAP DEBUG] Tree ${treeIndex} trunk overlaps at ${trunkPos}`);
      hasOverlaps = true;
    } else {
      allPositions.add(trunkPos);
    }
    
    tree.branches.forEach((node, nodeIndex) => {
      const nodePos = `${node.x},${node.y}`;
      if (allPositions.has(nodePos)) {
        console.warn(`[OVERLAP DEBUG] Tree ${treeIndex} node ${nodeIndex} overlaps at ${nodePos}`);
        hasOverlaps = true;
      } else {
        allPositions.add(nodePos);
      }
    });
  });
  
  console.log(`[POSITION DEBUG] Total unique positions: ${allPositions.size}, Has overlaps: ${hasOverlaps}`);
  
  // Summary of what was generated
  let totalNonLeafNodes = 0;
  let totalLeafNodes = 0;
  isometricTrees.forEach(tree => {
    tree.branches.forEach(node => {
      if (node.isLeaf) {
        totalLeafNodes++;
      } else {
        totalNonLeafNodes++;
      }
    });
  });
  console.log(`[SUMMARY] Generated ${isometricTrees.length} trees with ${totalNonLeafNodes} non-leaf nodes and ${totalLeafNodes} leaf nodes`);
  
  // Debug: Log tree structure to verify parent-child relationships
  isometricTrees.forEach((tree, treeIndex) => {
    console.log(`[TREE ${treeIndex}] Root at (${tree.x}, ${tree.y}) with ${tree.branches.length} nodes`);
    tree.branches.forEach((node, nodeIndex) => {
      if (nodeIndex < 5) { // Only log first 5 nodes per tree to avoid spam
        console.log(`  [NODE ${nodeIndex}] at (${node.x}, ${node.y}), depth: ${node.depth}, isLeaf: ${node.isLeaf}`);
      }
    });
  });
  
  setTreesGenerated(true);
        
        // Create 100x100 grid of tiles
        const tiles: Sprite[][] = [];
        // Generate biome map for the grid
        const biomeMap = generateBiomeMap(GRID_SIZE);
        // Generate stochastic tile map for the grid
        const tileMap = generateStochasticTileMap(biomeMap, BIOMES);
        for (let x = 0; x < GRID_SIZE; x++) {
          tiles[x] = [];
          for (let y = 0; y < GRID_SIZE; y++) {
            // Use tileMap for tile selection within the biome
            const frame = tileMap[x][y];
            const tileTexture = spritesheet.textures[frame];
            const [screenX, screenY] = isoToScreen(x, y);
            const sprite = new Sprite(tileTexture);
            sprite.anchor.set(0.5, 1); // Center bottom
            sprite.x = screenX;
            sprite.y = screenY;
            tileContainer.addChild(sprite);
            tiles[x][y] = sprite;
          }
        }

        // Add tree structures based on garden store data
        const treeSprites: Sprite[] = [];
        const leafSprites: Sprite[] = []; // Separate array for leaves to render last
        nodeSpriteMap.current = {};
        
        // Track occupied positions to prevent overlaps
        const occupiedPositions = new Set<string>();
        
        // Helper function to check and mark position as occupied
        const checkAndMarkPosition = (x: number, y: number, z: number): boolean => {
          const positionKey = `${x},${y},${z}`;
          if (occupiedPositions.has(positionKey)) {
            return false; // Position already occupied
          }
          occupiedPositions.add(positionKey);
          return true; // Position is now occupied
        };
        
        // First pass: render trunks and non-leaf nodes
        isometricTrees.forEach(tree => {
          // Trunk
          const trunkX = tree.x;
          const trunkY = tree.y;
          const trunkBaseZ = 6;
          let trunkSprites: Sprite[] = [];
          if (trunkX < GRID_SIZE && trunkY < GRID_SIZE) {
            for (let height = 0; height < tree.trunkHeight; height++) {
              // Check if this trunk segment position is available
              if (checkAndMarkPosition(trunkX, trunkY, trunkBaseZ + height)) {
                const trunkTexture = spritesheet.textures[BRANCH_TEXTURE_KEY];
                const [screenX, screenY] = isoToScreen(trunkX, trunkY);
                const trunkSprite = new Sprite(trunkTexture);
                trunkSprite.anchor.set(0.5, 1);
                trunkSprite.x = screenX;
                trunkSprite.y = screenY - (trunkBaseZ + height) * (TILE_HEIGHT / 4);
                trunkSprite.scale.set(TRUNK_SCALE, TRUNK_SCALE);
                trunkSprite.tint = 0x8B4513;
                tileContainer.addChild(trunkSprite);
                treeSprites.push(trunkSprite);
                trunkSprites.push(trunkSprite);
                spriteOriginalTints.current.set(trunkSprite, trunkSprite.tint);
                spriteOriginalTextures.current.set(trunkSprite, trunkSprite.texture);
              } else {
                console.warn(`[OVERLAP PREVENTION] Skipped trunk segment at (${trunkX}, ${trunkY}, ${trunkBaseZ + height}) - position occupied`);
              }
            }
            // Map root node id to all trunk sprites
            if (tree.rootId) {
              nodeSpriteMap.current[tree.rootId] = trunkSprites;
            }
          }
          
          // Non-leaf nodes - render with depth-based vertical positioning
          tree.branches.forEach(node => {
            if (node.x >= 0 && node.x < GRID_SIZE && node.y >= 0 && node.y < GRID_SIZE && !node.isLeaf) {
              // Calculate accumulated height from trunk and parent nodes
              let accumulatedHeight = tree.trunkHeight;
              const depth = node.depth || 0;
              
              // Add height from parent nodes at lower depths
              tree.branches.forEach(parentNode => {
                if (parentNode.depth !== undefined && parentNode.depth < depth && !parentNode.isLeaf) {
                  accumulatedHeight += parentNode.height;
                }
              });
              
              const nodeBaseZ = trunkBaseZ + accumulatedHeight - 1;
              let nodeSprites: Sprite[] = [];
              let nodeRendered = false;
              
              for (let h = 0; h < node.height; h++) {
                // Check if this node segment position is available
                if (checkAndMarkPosition(node.x, node.y, nodeBaseZ + h)) {
                  const nodeTexture = spritesheet.textures[BRANCH_TEXTURE_KEY];
                  const [screenX, screenY] = isoToScreen(node.x, node.y);
                  const nodeSprite = new Sprite(nodeTexture);
                  nodeSprite.anchor.set(0.5, 1);
                  nodeSprite.x = screenX;
                  nodeSprite.y = screenY - (nodeBaseZ + h) * (TILE_HEIGHT / 4);
                  nodeSprite.scale.set(0.5, 0.5); // Consistent thin size for branches
                  const colorVariation = Math.min(0.3, depth * 0.1);
                  const baseColor = 0x654321;
                  const r = Math.min(255, Math.floor((baseColor >> 16) * (1 + colorVariation)));
                  const g = Math.min(255, Math.floor(((baseColor >> 8) & 0xFF) * (1 + colorVariation)));
                  const b = Math.min(255, Math.floor((baseColor & 0xFF) * (1 + colorVariation)));
                  nodeSprite.tint = (r << 16) | (g << 8) | b;
                  tileContainer.addChild(nodeSprite);
                  treeSprites.push(nodeSprite);
                  nodeSprites.push(nodeSprite);
                  spriteOriginalTints.current.set(nodeSprite, nodeSprite.tint);
                  spriteOriginalTextures.current.set(nodeSprite, nodeSprite.texture);
                  nodeRendered = true;
                } else {
                  console.warn(`[OVERLAP PREVENTION] Skipped node segment at (${node.x}, ${node.y}, ${nodeBaseZ + h}) - position occupied`);
                }
              }
              
              // Map node id to all node sprites (only if at least one segment was rendered)
              if (node.parentId && nodeRendered) {
                nodeSpriteMap.current[node.parentId] = nodeSprites;
              }
            }
          });
        });
        
        // Second pass: render leaf nodes (always last to appear on top) with depth-based positioning
        isometricTrees.forEach(tree => {
          const trunkBaseZ = 6;
          tree.branches.forEach(node => {
            if (node.x >= 0 && node.x < GRID_SIZE && node.y >= 0 && node.y < GRID_SIZE && node.isLeaf) {
              // Calculate accumulated height from trunk and parent nodes
              let accumulatedHeight = tree.trunkHeight;
              const depth = node.depth || 0;
              
              // Add height from parent nodes at lower depths
              tree.branches.forEach(parentNode => {
                if (parentNode.depth !== undefined && parentNode.depth < depth && !parentNode.isLeaf) {
                  accumulatedHeight += parentNode.height;
                }
              });
              
              const leafZ = trunkBaseZ + accumulatedHeight - 1 + node.height;
              
              // Check if this leaf position is available
              if (checkAndMarkPosition(node.x, node.y, leafZ)) {
                const leafTexture = spritesheet.textures[LEAF_TILE_KEY];
                const [screenX, screenY] = isoToScreen(node.x, node.y);
                const leafSprite = new Sprite(leafTexture);
                leafSprite.anchor.set(0.5, 1);
                leafSprite.x = screenX;
                leafSprite.y = screenY - leafZ * (TILE_HEIGHT / 4);
                const scaleVariation = Math.max(0.6, 1 - depth * 0.1);
                leafSprite.scale.set(scaleVariation, scaleVariation);
                const greenVariation = Math.min(0.4, depth * 0.15);
                const baseGreen = 0x32CD32;
                const r = Math.min(255, Math.floor((baseGreen >> 16) * (1 + greenVariation)));
                const g = Math.min(255, Math.floor(((baseGreen >> 8) & 0xFF) * (1 + greenVariation)));
                const b = Math.min(255, Math.floor((baseGreen & 0xFF) * (1 + greenVariation)));
                leafSprite.tint = (r << 16) | (g << 8) | b;
                tileContainer.addChild(leafSprite);
                leafSprites.push(leafSprite);
                spriteOriginalTints.current.set(leafSprite, leafSprite.tint);
                spriteOriginalTextures.current.set(leafSprite, leafSprite.texture);
                // Map leaf node id to this leaf sprite
                if (node.parentId) {
                  nodeSpriteMap.current[node.parentId] = [leafSprite];
                }
              } else {
                console.warn(`[OVERLAP PREVENTION] Skipped leaf at (${node.x}, ${node.y}, ${leafZ}) - position occupied`);
              }
            }
          });
        });
        
        // Combine all sprites for animation (leaves will be rendered on top)
        treeSpritesRef.current = [...treeSprites, ...leafSprites];
        tilesRef.current = tiles;
        
        // Create connection paths between parent nodes and their children
        const connectionSprites: Sprite[] = [];
        const trunkBaseZ = 6;
        
        // Create a separate container for connections that will be rendered before leaves
        const connectionContainer = new Container();
        tileContainer.addChild(connectionContainer);
        
        isometricTrees.forEach(tree => {
          // Create connections from trunk to first level children
          const trunkPositions = calculateTrunkPositions(tree, trunkBaseZ);
          
          // Find first level children (depth 0)
          const firstLevelChildren = tree.branches.filter(node => node.depth === 0);
          
          firstLevelChildren.forEach(child => {
            const childPositions = calculateNodePositions(tree, child, trunkBaseZ);
            const connectionPath = createConnectionPath(trunkPositions.top, childPositions.bottom);
            const pathSprites = createConnectionSprites(connectionPath, spritesheet, connectionContainer);
            connectionSprites.push(...pathSprites);
            connectionPath.sprites = pathSprites;
            
            // Store original textures and tints for connection sprites
            pathSprites.forEach(sprite => {
              spriteOriginalTints.current.set(sprite, sprite.tint);
              spriteOriginalTextures.current.set(sprite, sprite.texture);
            });
            
            // Store connection sprites mapping for highlighting
            if (!connectionSpriteMap.current[tree.rootId]) {
              connectionSpriteMap.current[tree.rootId] = {};
            }
            connectionSpriteMap.current[tree.rootId][child.parentId] = pathSprites;
          });
          
          // Create connections between parent nodes and their children using tracked relationships
          tree.branches.forEach(parentNode => {
            if (parentNode.isLeaf) return; // Skip leaf nodes
            
            // Get children using the tracked parent-child relationships
            const children = tree.parentChildMap?.get(parentNode.parentId) || [];
            
            children.forEach(childId => {
              // Find the child node in the tree branches
              const childNode = tree.branches.find(node => node.parentId === childId);
              if (!childNode) return;
              
              const parentPositions = calculateNodePositions(tree, parentNode, trunkBaseZ);
              const childPositions = calculateNodePositions(tree, childNode, trunkBaseZ);
              const connectionPath = createConnectionPath(parentPositions.top, childPositions.bottom);
              const pathSprites = createConnectionSprites(connectionPath, spritesheet, connectionContainer);
              connectionSprites.push(...pathSprites);
              connectionPath.sprites = pathSprites;
              
              // Store original textures and tints for connection sprites
              pathSprites.forEach(sprite => {
                spriteOriginalTints.current.set(sprite, sprite.tint);
                spriteOriginalTextures.current.set(sprite, sprite.texture);
              });
              
              // Store connection sprites mapping for highlighting
              if (!connectionSpriteMap.current[parentNode.parentId]) {
                connectionSpriteMap.current[parentNode.parentId] = {};
              }
              connectionSpriteMap.current[parentNode.parentId][childId] = pathSprites;
            });
          });
        });
        
        // Store connection sprites for animation
        connectionSpritesRef.current = connectionSprites;
        
        console.log(`[CONNECTIONS] Created ${connectionSprites.length} connection sprites`);
        
        // Ensure all leaves are rendered on top
        leafSprites.forEach(leafSprite => {
          tileContainer.addChild(leafSprite); // This moves each leaf to the top of the display list
        });
        
        // Log overlap prevention statistics
        console.log(`[OVERLAP PREVENTION] Total occupied positions: ${occupiedPositions.size}`);
        console.log(`[OVERLAP PREVENTION] Rendered ${treeSprites.length} tree sprites and ${leafSprites.length} leaf sprites`);

        // Set initial camera position to center the grid
        cameraRef.current = {
          x: centerX - (GRID_SIZE * TILE_WIDTH) / 4,
          y: centerY - (GRID_SIZE * TILE_HEIGHT) / 8
        };

        // Update camera position
        const updateCamera = () => {
          tileContainer.x = cameraRef.current.x;
          tileContainer.y = cameraRef.current.y;
          tileContainer.scale.set(zoomRef.current, zoomRef.current);
        };
        
        // Initialize last dimensions
        lastWidth = width;
        lastHeight = height;
        
        // Mark as initialized before setting up resize handlers
        isInitialized = true;
        
        // Listen to window resize only (ResizeObserver seems to cause issues)
        window.addEventListener('resize', handleResize);
        
        // Don't use ResizeObserver for now as it seems to cause infinite loops
        // resizeObserver = new ResizeObserver(handleResize);
        // if (containerRef.current) {
        //   resizeObserver.observe(containerRef.current);
        // }

        // Animation ticker for wave effect and camera updates
        let time = 0;
        const ticker = new Ticker();
        ticker.add(() => {
          time += 0.01; // Significantly slowed down from 0.05 to 0.01
          
          // Handle keyboard input
          if (keysPressedRef.current.has('arrowleft')) {
            cameraRef.current.x += CAMERA_SPEED;
          }
          if (keysPressedRef.current.has('arrowright')) {
            cameraRef.current.x -= CAMERA_SPEED;
          }
          if (keysPressedRef.current.has('arrowup')) {
            cameraRef.current.y += CAMERA_SPEED;
          }
          if (keysPressedRef.current.has('arrowdown')) {
            cameraRef.current.y -= CAMERA_SPEED;
          }

          // Update camera position
          updateCamera();

          // Wave animation for visible tiles only - much slower and subtler
          for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
              const sprite = tilesRef.current[x][y];
              const baseY = isoToScreen(x, y)[1];
              sprite.y = baseY + Math.cos(time + x + y) * wave_amplitude; // Reduced amplitude from 8 to 2
            }
          }
          
          // Wave animation for tree sprites
          treeSpritesRef.current.forEach(sprite => {
            const baseY = sprite.y;
            sprite.y = baseY + Math.cos(time + sprite.x + sprite.y) * 2; // Subtle wave for trees
          });
          
          // Wave animation for connection sprites
          connectionSpritesRef.current.forEach(sprite => {
            const baseY = sprite.y;
            sprite.y = baseY + Math.cos(time + sprite.x + sprite.y) * 1; // Very subtle wave for connections
          });
        });
        
        // Only start ticker if component is not destroyed
        if (!destroyed) {
          ticker.start();
          tickerRef.current = ticker;
        } else {
          ticker.destroy();
        }

        if (!destroyed) {
          containerRef.current.appendChild(app.canvas);
          appRef.current = app;
          setIsSceneInitialized(true);
          
          // Trigger initial highlighting after scene is ready
          setTimeout(() => {
            if (!destroyed) {
              console.log('[INIT] Scene initialized, triggering initial highlighting');
              // Force a re-render of the highlighting effect
              const event = new Event('highlightUpdate');
              window.dispatchEvent(event);
            }
          }, 100);
        } else {
          app.destroy(true);
          // Don't destroy ticker here as it's handled in the cleanup function
        }
      } catch (error) {
        console.error('Failed to initialize PixiJS:', error);
      }
    };

    initPixiJS();

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      destroyed = true;
      setIsSceneInitialized(false);
      setTreesGenerated(false);
      
      // Remove event listeners
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      
      // Clear resize timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Disconnect resize observer
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = undefined;
      }
      if (tickerRef.current) {
        try {
          tickerRef.current.stop();
          tickerRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying ticker:', error);
        }
        tickerRef.current = undefined;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [width, height, handleKeyDown, handleKeyUp, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, trees]);

  // Snap camera to selected tree
  useEffect(() => {
    if (!selectedTree || !appRef.current || !isSceneInitialized) return;

    // Map 3D position to 2D grid position - use same scale as tree generation
    const POSITION_SCALE = 0.15; // Same as used in tree generation
    const offsetX = GRID_SIZE / 2;
    const offsetY = GRID_SIZE / 2;
    
    const gridX = Math.floor((selectedTree.position.x * POSITION_SCALE) + offsetX);
    const gridY = Math.floor((selectedTree.position.z * POSITION_SCALE) + offsetY);
    
    // Convert grid position to screen position
    const [screenX, screenY] = isoToScreen(gridX, gridY);
    
    // Calculate camera position to center the selected tree with custom vertical offset
    const centerX = width / 2;
    const centerY = height / 2;
    const verticalOffset = 300; // Custom offset to position tree lower vertically
    
    cameraRef.current = {
      x: centerX - screenX,
      y: centerY - screenY + verticalOffset
    };
    
    console.log('📷 IsometricGardenVisualizer: Camera snapped to tree:', {
      treeName: selectedTree.name,
      gridPosition: { x: gridX, y: gridY },
      screenPosition: { x: screenX, y: screenY },
      cameraPosition: cameraRef.current
    });
  }, [selectedTree, width, height, isSceneInitialized]);

  // Highlighting effect for selected node and preview selection
  useEffect(() => {
    console.log(`[HIGHLIGHT DEBUG] selectedNodeId=${selectedNodeId}, currentDepth=${currentDepth}, selectedOptions=${selectedOptions}`);
    console.log(`[HIGHLIGHT DEBUG] nodeSpriteMap keys:`, Object.keys(nodeSpriteMap.current));
    console.log(`[HIGHLIGHT DEBUG] nodeSpriteMap values:`, Object.values(nodeSpriteMap.current).map(sprites => sprites.length));
    
    // Remove highlight from all nodes
    Object.values(nodeSpriteMap.current).forEach(sprites => {
      sprites.forEach(sprite => {
        if (sprite && spriteOriginalTextures.current.has(sprite)) {
          sprite.texture = spriteOriginalTextures.current.get(sprite)!;
          // Restore original scale and tint
          sprite.scale.set(1, 1);
          sprite.tint = spriteOriginalTints.current.get(sprite) || 0xFFFFFF;
        }
      });
    });
    
    // Remove highlight from all connection sprites
    Object.values(connectionSpriteMap.current).forEach(childMap => {
      Object.values(childMap).forEach(sprites => {
        sprites.forEach(sprite => {
          if (sprite && spriteOriginalTextures.current.has(sprite)) {
            sprite.texture = spriteOriginalTextures.current.get(sprite)!;
            sprite.scale.set(0.5, 0.5); // Restore original scale
            sprite.tint = 0x8B7355; // Restore original brown color
          }
        });
      });
    });
    
    // Calculate which node should be preview highlighted (yellow)
    let previewNodeId: string | null = null;
    if (selectedTree && currentDepth >= 0 && selectedOptions.length > currentDepth) {
      const currentPath = getPathFromRoot(selectedNodeId || '');
      if (currentPath.length > currentDepth) {
        const currentNodeAtDepth = currentPath[currentDepth];
        if (currentNodeAtDepth && currentNodeAtDepth.continuations) {
          const selectedOptionIndex = selectedOptions[currentDepth] ?? 0;
          if (selectedOptionIndex >= 0 && selectedOptionIndex < currentNodeAtDepth.continuations.length) {
            previewNodeId = currentNodeAtDepth.continuations[selectedOptionIndex].id;
          }
        }
      }
    }
    
    console.log(`[PREVIEW DEBUG] previewNodeId=${previewNodeId}`);
    
    // Determine which node to highlight
    let nodeToHighlight = selectedNodeId;
    
    // If no specific node is selected, highlight the root node (first tree's root)
    if (!nodeToHighlight && Object.keys(nodeSpriteMap.current).length > 0) {
      // Find the root node (usually starts with 'root_')
      const rootKeys = Object.keys(nodeSpriteMap.current).filter(key => key.startsWith('root_'));
      if (rootKeys.length > 0) {
        nodeToHighlight = rootKeys[0];
        console.log(`[HIGHLIGHT DEBUG] No selectedNodeId provided, defaulting to root: ${nodeToHighlight}`);
      }
    }
    
    // Get the path from root to the selected node
    let pathFromRoot: any[] = [];
    if (nodeToHighlight && selectedTree) {
      pathFromRoot = getPathFromRoot(nodeToHighlight);
      console.log(`[PATH DEBUG] Path from root to ${nodeToHighlight}:`, pathFromRoot.map(node => node.id));
    }
    
    // Highlight all nodes in the path from root to selected node
    const nodesToHighlight = new Set<string>();
    if (pathFromRoot.length > 0) {
      pathFromRoot.forEach(node => {
        nodesToHighlight.add(node.id);
      });
    } else if (nodeToHighlight) {
      // If no path found, just highlight the selected node
      nodesToHighlight.add(nodeToHighlight);
    }
    
    console.log(`[PATH HIGHLIGHT] Nodes to highlight:`, Array.from(nodesToHighlight));
    
    // Highlight all nodes in the path
    nodesToHighlight.forEach(nodeId => {
      if (nodeSpriteMap.current[nodeId]) {
        console.log(`[PATH HIGHLIGHT] Highlighting nodeId=${nodeId}, count=${nodeSpriteMap.current[nodeId].length}`);
        nodeSpriteMap.current[nodeId].forEach(sprite => {
          if (sprite && spriteOriginalTextures.current.has(sprite)) {
            // Swap to highlight texture (flowers_red) and add visual enhancement
            if (highlightTextureRef.current) {
              sprite.texture = highlightTextureRef.current;
              // Make the highlighted sprite larger and brighter
              sprite.scale.set(1.1, 1.1);
              sprite.tint = 0xFFFF00; // Bright yellow tint
              // Log highlighting
              console.log(`[PATH HIGHLIGHT] Highlighted nodeId=${nodeId} at sprite position x=${sprite.x} y=${sprite.y}`);
            } else {
              console.log(`[PATH HIGHLIGHT DEBUG] highlightTextureRef.current is null`);
            }
          } else {
            console.log(`[PATH HIGHLIGHT DEBUG] Sprite or original texture not found for nodeId=${nodeId}`);
          }
        });
      } else {
        console.log(`[PATH HIGHLIGHT DEBUG] No sprites found for nodeId=${nodeId}`);
      }
    });
    
    // Highlight all connections in the path
    for (let i = 0; i < pathFromRoot.length - 1; i++) {
      const parentNode = pathFromRoot[i];
      const childNode = pathFromRoot[i + 1];
      
      if (connectionSpriteMap.current[parentNode.id] && connectionSpriteMap.current[parentNode.id][childNode.id]) {
        const connectionSprites = connectionSpriteMap.current[parentNode.id][childNode.id];
        console.log(`[PATH HIGHLIGHT] Highlighting connection from ${parentNode.id} to ${childNode.id}, count=${connectionSprites.length}`);
        
        connectionSprites.forEach(sprite => {
          if (sprite && spriteOriginalTextures.current.has(sprite)) {
            // Use highlight texture for connections too
            if (highlightTextureRef.current) {
              sprite.texture = highlightTextureRef.current;
              // Make the highlighted connection sprite larger and brighter
              sprite.scale.set(0.6, 0.6); // Slightly larger than original 0.5
              sprite.tint = 0xFFFF00; // Bright yellow tint
              console.log(`[PATH HIGHLIGHT] Highlighted connection sprite at position x=${sprite.x} y=${sprite.y}`);
            }
          }
        });
      } else {
        console.log(`[PATH HIGHLIGHT DEBUG] No connection sprites found from ${parentNode.id} to ${childNode.id}`);
      }
    }
    
    // Preview highlight child node (blue flowers)
    if (previewNodeId && nodeSpriteMap.current[previewNodeId]) {
      console.log(`[PREVIEW DEBUG] Found sprites for previewNodeId=${previewNodeId}, count=${nodeSpriteMap.current[previewNodeId].length}`);
      nodeSpriteMap.current[previewNodeId].forEach(sprite => {
        if (sprite && spriteOriginalTextures.current.has(sprite)) {
          // Swap to preview texture (flowers_blue) and add visual enhancement
          if (previewTextureRef.current) {
            sprite.texture = previewTextureRef.current;
            // Make the preview sprite slightly larger and with a different tint
            sprite.scale.set(1.05, 1.05);
            sprite.tint = 0x87CEEB; // Sky blue tint for preview
            // Log preview highlighting
            console.log(`[PREVIEW] Preview highlighted nodeId=${previewNodeId} at sprite position x=${sprite.x} y=${sprite.y}`);
          } else {
            console.log(`[PREVIEW DEBUG] previewTextureRef.current is null`);
          }
        } else {
          console.log(`[PREVIEW DEBUG] Sprite or original texture not found for previewNodeId=${previewNodeId}`);
        }
      });
    } else {
      console.log(`[PREVIEW DEBUG] No sprites found for previewNodeId=${previewNodeId}`);
    }
    
    // Preview highlight connection sprites leading to the previewed node
    if (previewNodeId && pathFromRoot.length > 0) {
      // Find the parent of the previewed node in the path
      const previewNodeIndex = pathFromRoot.findIndex(node => node.id === previewNodeId);
      if (previewNodeIndex === -1) {
        // If preview node is not in the current path, find its parent from the current depth
        if (currentDepth >= 0 && pathFromRoot.length > currentDepth) {
          const parentNode = pathFromRoot[currentDepth];
          if (connectionSpriteMap.current[parentNode.id] && connectionSpriteMap.current[parentNode.id][previewNodeId]) {
            const previewConnectionSprites = connectionSpriteMap.current[parentNode.id][previewNodeId];
            console.log(`[PREVIEW CONNECTION] Highlighting connection to previewNodeId=${previewNodeId}, count=${previewConnectionSprites.length}`);
            
            previewConnectionSprites.forEach(sprite => {
              if (sprite && spriteOriginalTextures.current.has(sprite)) {
                // Use preview texture for connection sprites too
                if (previewTextureRef.current) {
                  sprite.texture = previewTextureRef.current;
                  // Make the preview connection sprite slightly larger and with blue tint
                  sprite.scale.set(0.55, 0.55); // Slightly larger than original 0.5
                  sprite.tint = 0x87CEEB; // Sky blue tint for preview
                  console.log(`[PREVIEW CONNECTION] Preview highlighted connection sprite at position x=${sprite.x} y=${sprite.y}`);
                }
              }
            });
          } else {
            console.log(`[PREVIEW CONNECTION DEBUG] No connection sprites found to previewNodeId=${previewNodeId}`);
          }
        }
      } else if (previewNodeIndex > 0) {
        // If preview node is in the path, highlight the connection from its parent
        const parentNode = pathFromRoot[previewNodeIndex - 1];
        if (connectionSpriteMap.current[parentNode.id] && connectionSpriteMap.current[parentNode.id][previewNodeId]) {
          const previewConnectionSprites = connectionSpriteMap.current[parentNode.id][previewNodeId];
          console.log(`[PREVIEW CONNECTION] Highlighting connection to previewNodeId=${previewNodeId}, count=${previewConnectionSprites.length}`);
          
          previewConnectionSprites.forEach(sprite => {
            if (sprite && spriteOriginalTextures.current.has(sprite)) {
              // Use preview texture for connection sprites too
              if (previewTextureRef.current) {
                sprite.texture = previewTextureRef.current;
                // Make the preview connection sprite slightly larger and with blue tint
                sprite.scale.set(0.55, 0.55); // Slightly larger than original 0.5
                sprite.tint = 0x87CEEB; // Sky blue tint for preview
                console.log(`[PREVIEW CONNECTION] Preview highlighted connection sprite at position x=${sprite.x} y=${sprite.y}`);
              }
            }
          });
        } else {
          console.log(`[PREVIEW CONNECTION DEBUG] No connection sprites found to previewNodeId=${previewNodeId}`);
        }
      }
    }
  }, [selectedNodeId, currentDepth, selectedOptions, isSceneInitialized, treesGenerated, selectedTree, getPathFromRoot]);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: 'none',
        backgroundColor: 'transparent',
        position: 'relative',
        cursor: 'grab',
        overflow: 'hidden'
      }}
      onMouseDown={() => {
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grabbing';
        }
      }}
      onMouseUp={() => {
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grab';
        }
      }}
    />
  );
};

export default IsometricGardenVisualizer; 