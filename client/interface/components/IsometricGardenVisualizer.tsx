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
}

const GRID_SIZE = 120; // Increased to 120x120 for better spacing
const TILE_WIDTH = 32; // Reduced from 64 to 32
const TILE_HEIGHT = 32; // Reduced from 64 to 32
const CAMERA_SPEED = 5; // Speed for arrow key movement
const MOUSE_DRAG_SPEED = 1.5; // Speed for mouse drag

function isoToScreen(x: number, y: number) {
  return [
    (x - y) * (TILE_WIDTH / 2),
    (x + y) * (TILE_HEIGHT / 4) // 1/4 for isometric vertical squish
  ];
}

const ATLAS_URL = '/client/assets/sprites/tileset.json';
const IMAGE_URL = '/client/assets/sprites/tileset.png';
const TILE_FRAMES = [
  'grass', 'dirt', 'water', 'sand',
  'tree_small', 'tree_large', 'pine_tree',
  'bush', 'shrub',
  'flowers_red', 'flowers_yellow', 'flowers_blue', 'flowers_purple',
  'stone', 'mud'
];

// Generate trees from garden store data
const generateTreesFromStore = (trees: any[], gridSize: number): IsometricTree[] => {
  const isometricTrees: IsometricTree[] = [];
  const occupiedPositions = new Set<string>();
  const treeSpacing = 3; // Minimum distance between tree elements

  // Map 3D positions to 2D grid positions with better spacing
  const map3DToGrid = (position: TreePosition): { x: number; y: number } => {
    const scale = 0.15; // Increased scale for better spacing
    const offsetX = gridSize / 2;
    const offsetY = gridSize / 2;
    return {
      x: Math.floor((position.x * scale) + offsetX),
      y: Math.floor((position.z * scale) + offsetY)
    };
  };

  // Check if a position and its surrounding area is available
  const isPositionAvailable = (x: number, y: number, radius: number = 1): boolean => {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const checkX = x + dx;
        const checkY = y + dy;
        if (checkX < 0 || checkX >= gridSize || checkY < 0 || checkY >= gridSize) {
          return false;
        }
        if (occupiedPositions.has(`${checkX},${checkY}`)) {
          return false;
        }
      }
    }
    return true;
  };

  // Mark a position and its surrounding area as occupied
  const markPositionOccupied = (x: number, y: number, radius: number = 1): void => {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const markX = x + dx;
        const markY = y + dy;
        if (markX >= 0 && markX < gridSize && markY >= 0 && markY < gridSize) {
          occupiedPositions.add(`${markX},${markY}`);
        }
      }
    }
  };

  // Find the best available position near a given point
  const findAvailablePosition = (centerX: number, centerY: number, maxRadius: number = 8): { x: number; y: number } | null => {
    // Search in expanding circles
    for (let radius = 1; radius <= maxRadius; radius++) {
      const positions = [];
      
      // Generate all positions at this radius
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) === radius) { // Only positions at exact radius
            positions.push({ dx, dy });
          }
        }
      }
      
      // Sort by distance to center for better placement
      positions.sort((a, b) => {
        const distA = Math.sqrt(a.dx * a.dx + a.dy * a.dy);
        const distB = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
        return distA - distB;
      });
      
      for (const { dx, dy } of positions) {
        const testX = centerX + dx;
        const testY = centerY + dy;
        if (isPositionAvailable(testX, testY)) {
          return { x: testX, y: testY };
        }
      }
    }
    return null;
  };

  // Recursive function to build branches with improved spacing
  function buildBranches(node, parentTop, parentHeight, depth = 0, maxDepth = 6) {
    if (!node) return [];
    if (depth > maxDepth) return [];
    const branches = [];
    
    if (!node.continuations || node.continuations.length === 0) {
      // Leaf node: find a position that doesn't overlap
      let leafPosition = findAvailablePosition(parentTop.x, parentTop.y, 6);
      
      if (!leafPosition) {
        console.warn(`[LEAF DEBUG] Could not find position for leaf node ${node.id}, skipping`);
        return [];
      }
      
      branches.push({
        x: leafPosition.x,
        y: leafPosition.y,
        height: 1,
        depth,
        parentId: node.id,
        isLeaf: true
      });
      
      // Mark leaf position as occupied (smaller radius for leaves)
      markPositionOccupied(leafPosition.x, leafPosition.y, 1);
      return branches;
    }
    
    // For non-leaf nodes, create a vertical branch
    const branchHeight = Math.floor(Math.random() * 2) + 4; // 4-5 blocks tall (reduced)
    
    // Find a position for the branch that's not too close to parent
    let branchBase = findAvailablePosition(parentTop.x, parentTop.y, 8);
    
    if (!branchBase) {
      console.warn(`[BRANCH DEBUG] Could not find position for branch node ${node.id}, skipping`);
      return [];
    }
    
    // Mark all blocks of this branch as occupied
    for (let h = 0; h < branchHeight; h++) {
      markPositionOccupied(branchBase.x, branchBase.y, 1);
    }
    
    branches.push({
      x: branchBase.x,
      y: branchBase.y,
      height: branchHeight,
      depth,
      parentId: node.id,
      isLeaf: false
    });
    
    // The top of this branch
    const branchTop = { x: branchBase.x, y: branchBase.y };
    
    // Recursively build child branches from the top of this branch
    for (let i = 0; i < node.continuations.length; i++) {
      const child = node.continuations[i];
      const childBranches = buildBranches(child, branchTop, branchHeight, depth + 1, maxDepth);
      branches.push(...childBranches);
    }
    
    return branches;
  }

  trees.forEach((tree) => {
    if (!tree.position || !tree.root) return;
    const gridPos = map3DToGrid(tree.position);
    if (gridPos.x < 0 || gridPos.x >= gridSize || gridPos.y < 0 || gridPos.y >= gridSize) return;
    
    // Find a good position for the trunk
    let trunkPosition = gridPos;
    if (!isPositionAvailable(trunkPosition.x, trunkPosition.y, 2)) {
      trunkPosition = findAvailablePosition(gridPos.x, gridPos.y, 10);
      if (!trunkPosition) {
        console.warn(`[TREE DEBUG] Could not find position for tree ${tree.root.id}, skipping`);
        return;
      }
    }
    
    // Mark trunk positions as occupied
    const trunkHeight = Math.floor(Math.random() * 2) + 8; // 8-9 blocks tall (reduced)
    for (let h = 0; h < trunkHeight; h++) {
      markPositionOccupied(trunkPosition.x, trunkPosition.y, 2);
    }
    
    // Build all branches recursively from the top of the trunk
    const parentTop = { x: trunkPosition.x, y: trunkPosition.y };
    const branches = [];
    if (tree.root.continuations && tree.root.continuations.length > 0) {
      for (let i = 0; i < tree.root.continuations.length; i++) {
        const child = tree.root.continuations[i];
        const childBranches = buildBranches(child, parentTop, trunkHeight, 0, 6);
        branches.push(...childBranches);
      }
    }
    
    isometricTrees.push({
      x: trunkPosition.x,
      y: trunkPosition.y,
      trunkHeight,
      rootId: tree.root.id,
      branches
    });
  });
  
  return isometricTrees;
};

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
  const tickerRef = useRef<Ticker>();
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // Map nodeId to sprite(s) for highlighting
  const nodeSpriteMap = useRef<Record<string, Sprite[]>>({});
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
        highlightTextureRef.current = spritesheet.textures['flowers_red'];
        // Set up preview texture for child preview selection - use a different color
        previewTextureRef.current = spritesheet.textures['flowers_blue'];

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
    
    tree.branches.forEach((branch, branchIndex) => {
      const branchPos = `${branch.x},${branch.y}`;
      if (allPositions.has(branchPos)) {
        console.warn(`[OVERLAP DEBUG] Tree ${treeIndex} branch ${branchIndex} overlaps at ${branchPos}`);
        hasOverlaps = true;
      } else {
        allPositions.add(branchPos);
      }
    });
  });
  
  console.log(`[POSITION DEBUG] Total unique positions: ${allPositions.size}, Has overlaps: ${hasOverlaps}`);
  
  // Summary of what was generated
  let totalBranches = 0;
  let totalLeaves = 0;
  isometricTrees.forEach(tree => {
    tree.branches.forEach(branch => {
      if (branch.isLeaf) {
        totalLeaves++;
      } else {
        totalBranches++;
      }
    });
  });
  console.log(`[SUMMARY] Generated ${isometricTrees.length} trees with ${totalBranches} branches and ${totalLeaves} leaves`);
  
  setTreesGenerated(true);
        
        // Create 100x100 grid of tiles
        const tiles: Sprite[][] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
          tiles[x] = [];
          for (let y = 0; y < GRID_SIZE; y++) {
            // Use mainly ground tiles with occasional other elements
            let frame;
            const rand = Math.random();
            if (rand < 0.7) {
              // 70% chance for grass (ground)
              frame = 'grass';
            } else if (rand < 0.8) {
              // 10% chance for dirt
              frame = 'dirt';
            } else if (rand < 0.85) {
              // 5% chance for sand
              frame = 'sand';
            } else if (rand < 0.9) {
              // 5% chance for mud
              frame = 'mud';
            } else {
              // 10% chance for other elements (trees, flowers, etc.)
              const otherFrames = ['tree_small', 'tree_large', 'pine_tree', 'bush', 'shrub', 'flowers_red', 'flowers_yellow', 'flowers_blue', 'flowers_purple', 'stone'];
              frame = otherFrames[Math.floor(Math.random() * otherFrames.length)];
            }
            
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
        
        // First pass: render trunks and branches
        isometricTrees.forEach(tree => {
          // Trunk
          const trunkX = tree.x;
          const trunkY = tree.y;
          const trunkBaseZ = 6;
          let trunkSprites: Sprite[] = [];
          if (trunkX < GRID_SIZE && trunkY < GRID_SIZE) {
            for (let height = 0; height < tree.trunkHeight; height++) {
              const trunkTexture = spritesheet.textures['stone'];
              const [screenX, screenY] = isoToScreen(trunkX, trunkY);
              const trunkSprite = new Sprite(trunkTexture);
              trunkSprite.anchor.set(0.5, 1);
              trunkSprite.x = screenX;
              trunkSprite.y = screenY - (trunkBaseZ + height) * (TILE_HEIGHT / 4);
              trunkSprite.tint = 0x8B4513;
              tileContainer.addChild(trunkSprite);
              treeSprites.push(trunkSprite);
              trunkSprites.push(trunkSprite);
              spriteOriginalTints.current.set(trunkSprite, trunkSprite.tint);
              spriteOriginalTextures.current.set(trunkSprite, trunkSprite.texture);
            }
            // Map root node id to all trunk sprites
            if (tree.rootId) {
              nodeSpriteMap.current[tree.rootId] = trunkSprites;
            }
          }
          
          // Branches (non-leaf)
          tree.branches.forEach(branch => {
            if (branch.x >= 0 && branch.x < GRID_SIZE && branch.y >= 0 && branch.y < GRID_SIZE && !branch.isLeaf) {
              const branchBaseZ = trunkBaseZ + tree.trunkHeight - 1;
              let branchSprites: Sprite[] = [];
              for (let h = 0; h < branch.height; h++) {
                const branchTexture = spritesheet.textures['stone'];
                const [screenX, screenY] = isoToScreen(branch.x, branch.y);
                const branchSprite = new Sprite(branchTexture);
                branchSprite.anchor.set(0.5, 1);
                branchSprite.x = screenX;
                branchSprite.y = screenY - (branchBaseZ + h) * (TILE_HEIGHT / 4);
                const depth = branch.depth || 0;
                const colorVariation = Math.min(0.3, depth * 0.1);
                const baseColor = 0x654321;
                const r = Math.min(255, Math.floor((baseColor >> 16) * (1 + colorVariation)));
                const g = Math.min(255, Math.floor(((baseColor >> 8) & 0xFF) * (1 + colorVariation)));
                const b = Math.min(255, Math.floor((baseColor & 0xFF) * (1 + colorVariation)));
                branchSprite.tint = (r << 16) | (g << 8) | b;
                tileContainer.addChild(branchSprite);
                treeSprites.push(branchSprite);
                branchSprites.push(branchSprite);
                spriteOriginalTints.current.set(branchSprite, branchSprite.tint);
                spriteOriginalTextures.current.set(branchSprite, branchSprite.texture);
              }
              // Map node id to all branch sprites
              if (branch.parentId) {
                nodeSpriteMap.current[branch.parentId] = branchSprites;
              }
            }
          });
        });
        
        // Second pass: render leaves (always last to appear on top)
        isometricTrees.forEach(tree => {
          const trunkBaseZ = 6;
          tree.branches.forEach(branch => {
            if (branch.x >= 0 && branch.x < GRID_SIZE && branch.y >= 0 && branch.y < GRID_SIZE && branch.isLeaf) {
              const leafTexture = spritesheet.textures['bush'];
              const [screenX, screenY] = isoToScreen(branch.x, branch.y);
              const leafSprite = new Sprite(leafTexture);
              leafSprite.anchor.set(0.5, 1);
              leafSprite.x = screenX;
              leafSprite.y = screenY - (trunkBaseZ + tree.trunkHeight - 1 + branch.height) * (TILE_HEIGHT / 4);
              const depth = branch.depth || 0;
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
              if (branch.parentId) {
                nodeSpriteMap.current[branch.parentId] = [leafSprite];
              }
            }
          });
        });
        
        // Combine all sprites for animation (leaves will be rendered on top)
        treeSpritesRef.current = [...treeSprites, ...leafSprites];
        tilesRef.current = tiles;

        // Set initial camera position to center the grid
        cameraRef.current = {
          x: centerX - (GRID_SIZE * TILE_WIDTH) / 4,
          y: centerY - (GRID_SIZE * TILE_HEIGHT) / 8
        };

        // Update camera position
        const updateCamera = () => {
          tileContainer.x = cameraRef.current.x;
          tileContainer.y = cameraRef.current.y;
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
              sprite.y = baseY + Math.cos(time + x + y) * 4; // Reduced amplitude from 8 to 2
            }
          }
          
          // Wave animation for tree sprites
          treeSpritesRef.current.forEach(sprite => {
            const baseY = sprite.y;
            sprite.y = baseY + Math.cos(time + sprite.x + sprite.y) * 2; // Subtle wave for trees
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
  }, [width, height, handleKeyDown, handleKeyUp, handleMouseDown, handleMouseMove, handleMouseUp, trees]);

  // Snap camera to selected tree
  useEffect(() => {
    if (!selectedTree || !appRef.current || !isSceneInitialized) return;

    // Map 3D position to 2D grid position
    const scale = 0.1;
    const offsetX = GRID_SIZE / 2;
    const offsetY = GRID_SIZE / 2;
    
    const gridX = Math.floor((selectedTree.position.x * scale) + offsetX);
    const gridY = Math.floor((selectedTree.position.z * scale) + offsetY);
    
    // Convert grid position to screen position
    const [screenX, screenY] = isoToScreen(gridX, gridY);
    
    // Calculate camera position to center the selected tree
    const centerX = width / 2;
    const centerY = height / 2;
    
    cameraRef.current = {
      x: centerX - screenX,
      y: centerY - screenY
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
    
    // Remove highlight from all
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
    
    // Highlight selected node (red flowers)
    if (nodeToHighlight && nodeSpriteMap.current[nodeToHighlight]) {
      console.log(`[HIGHLIGHT DEBUG] Found sprites for nodeId=${nodeToHighlight}, count=${nodeSpriteMap.current[nodeToHighlight].length}`);
      nodeSpriteMap.current[nodeToHighlight].forEach(sprite => {
        if (sprite && spriteOriginalTextures.current.has(sprite)) {
          // Swap to highlight texture (flowers_red) and add visual enhancement
          if (highlightTextureRef.current) {
            sprite.texture = highlightTextureRef.current;
            // Make the highlighted sprite larger and brighter
            sprite.scale.set(1.1, 1.1);
            sprite.tint = 0xFFFF00; // Bright yellow tint
            // Log highlighting
            console.log(`[HIGHLIGHT] Highlighted nodeId=${nodeToHighlight} at sprite position x=${sprite.x} y=${sprite.y}`);
          } else {
            console.log(`[HIGHLIGHT DEBUG] highlightTextureRef.current is null`);
          }
        } else {
          console.log(`[HIGHLIGHT DEBUG] Sprite or original texture not found for nodeId=${nodeToHighlight}`);
        }
      });
    } else {
      console.log(`[HIGHLIGHT DEBUG] No sprites found for nodeId=${nodeToHighlight}`);
    }
    
    // Preview highlight child node (yellow flowers)
    if (previewNodeId && nodeSpriteMap.current[previewNodeId]) {
      console.log(`[PREVIEW DEBUG] Found sprites for previewNodeId=${previewNodeId}, count=${nodeSpriteMap.current[previewNodeId].length}`);
      nodeSpriteMap.current[previewNodeId].forEach(sprite => {
        if (sprite && spriteOriginalTextures.current.has(sprite)) {
          // Swap to preview texture (flowers_yellow) and add visual enhancement
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