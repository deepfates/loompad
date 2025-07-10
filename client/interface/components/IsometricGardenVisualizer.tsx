import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Sprite, Assets, Spritesheet, Texture, Ticker, Container } from 'pixi.js';
import { useGardenStore } from '../stores/gardenStore';
import type { TreePosition } from '../types/garden';

interface IsometricGardenVisualizerProps {
  width?: number;
  height?: number;
}

interface IsometricTree {
  x: number;
  y: number;
  trunkHeight: number;
  branches: Array<{
    x: number;
    y: number;
    height: number;
  }>;
}

const GRID_SIZE = 100; // Increased from 50x50 to 100x100 for smaller tiles
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
  
  // Map 3D positions to 2D grid positions
  const map3DToGrid = (position: TreePosition): { x: number; y: number } => {
    // Scale and offset the 3D position to fit in our grid
    const scale = 0.1; // Scale down the 3D coordinates
    const offsetX = gridSize / 2;
    const offsetY = gridSize / 2;
    
    return {
      x: Math.floor((position.x * scale) + offsetX),
      y: Math.floor((position.z * scale) + offsetY) // Use Z as Y for isometric view
    };
  };

  trees.forEach((tree, treeIndex) => {
    if (!tree.position || !tree.root) return;
    
    const gridPos = map3DToGrid(tree.position);
    
    // Ensure position is within grid bounds
    if (gridPos.x < 0 || gridPos.x >= gridSize || gridPos.y < 0 || gridPos.y >= gridSize) {
      return;
    }
    
    // Check if position is available
    if (occupiedPositions.has(`${gridPos.x},${gridPos.y}`)) {
      return;
    }
    
    // Mark position as occupied
    occupiedPositions.add(`${gridPos.x},${gridPos.y}`);
    
    // Generate tree structure based on story node
    const trunkHeight = Math.floor(Math.random() * 3) + 6; // 6-8 blocks tall
    const branches: Array<{x: number, y: number, height: number}> = [];
    
    // Generate branches based on story node continuations
    if (tree.root.continuations && tree.root.continuations.length > 0) {
      const numBranches = Math.min(tree.root.continuations.length, 4); // Max 4 branches for visual clarity
      const branchPositions = [
        {x: -1, y: 0}, {x: 1, y: 0}, {x: 0, y: -1}, {x: 0, y: 1}, // Adjacent positions
        {x: -1, y: -1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: 1, y: 1} // Diagonal positions
      ];
      
      // Use deterministic positioning based on node ID
      const seed = tree.root.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const seededRandom = ((seed * 9301 + 49297) % 233280) / 233280;
      
      // Shuffle positions deterministically
      const shuffledPositions = [...branchPositions].sort(() => seededRandom - 0.5);
      
      for (let i = 0; i < numBranches && i < shuffledPositions.length; i++) {
        const pos = shuffledPositions[i];
        const branchX = gridPos.x + pos.x;
        const branchY = gridPos.y + pos.y;
        
        // Check if branch position is available
        if (branchX >= 0 && branchX < gridSize && branchY >= 0 && branchY < gridSize && 
            !occupiedPositions.has(`${branchX},${branchY}`)) {
          occupiedPositions.add(`${branchX},${branchY}`);
          
          branches.push({
            x: branchX,
            y: branchY,
            height: Math.floor(Math.random() * 4) + 1 // 1-4 blocks tall
          });
        }
      }
    }
    
    isometricTrees.push({
      x: gridPos.x,
      y: gridPos.y,
      trunkHeight,
      branches
    });
  });
  
  return isometricTrees;
};

const IsometricGardenVisualizer: React.FC<IsometricGardenVisualizerProps> = ({
  width = 800,
  height = 640
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>();
  const tilesRef = useRef<Sprite[][]>([]);
  const treeSpritesRef = useRef<Sprite[]>([]);
  const tickerRef = useRef<Ticker>();
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const keysPressedRef = useRef<Set<string>>(new Set());

  // Get trees from garden store
  const { trees } = useGardenStore();

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

        // Create a container for all tiles
        const tileContainer = new Container();
        app.stage.addChild(tileContainer);

        const centerX = width / 2;
        const centerY = height / 2;

        // Generate trees from garden store data
        const isometricTrees = generateTreesFromStore(trees, GRID_SIZE);
        console.log(`Generated ${isometricTrees.length} trees from garden store`);
        
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
        isometricTrees.forEach(tree => {
          // Create trunk (1x1 vertically stacked blocks)
          const trunkX = tree.x;
          const trunkY = tree.y;
          
          if (trunkX < GRID_SIZE && trunkY < GRID_SIZE) {
            // Create trunk blocks (brown)
            for (let height = 0; height < tree.trunkHeight; height++) {
              const trunkTexture = spritesheet.textures['stone']; // Use stone for trunk
              const [screenX, screenY] = isoToScreen(trunkX, trunkY);
              const trunkSprite = new Sprite(trunkTexture);
              trunkSprite.anchor.set(0.5, 1);
              trunkSprite.x = screenX;
              trunkSprite.y = screenY - height * (TILE_HEIGHT / 4); // Stack vertically
              trunkSprite.tint = 0x8B4513; // Brown tint
              tileContainer.addChild(trunkSprite);
              treeSprites.push(trunkSprite);
            }
          }
          
          // Create branches based on story node structure
          tree.branches.forEach(branch => {
            if (branch.x >= 0 && branch.x < GRID_SIZE && branch.y >= 0 && branch.y < GRID_SIZE) {
              // Branches start at the same level as the highest trunk block
              const branchStartHeight = tree.trunkHeight - 1; // Start at the top of the trunk
              
              // Create branch blocks (darker brown)
              for (let height = 0; height < branch.height; height++) {
                const branchTexture = spritesheet.textures['stone'];
                const [screenX, screenY] = isoToScreen(branch.x, branch.y);
                const branchSprite = new Sprite(branchTexture);
                branchSprite.anchor.set(0.5, 1);
                branchSprite.x = screenX;
                branchSprite.y = screenY - (branchStartHeight + height) * (TILE_HEIGHT / 4);
                branchSprite.tint = 0x654321; // Darker brown tint
                tileContainer.addChild(branchSprite);
                treeSprites.push(branchSprite);
              }
              
              // Add leaf at the top of branch (green)
              const leafTexture = spritesheet.textures['bush']; // Use bush for leaves
              const [screenX, screenY] = isoToScreen(branch.x, branch.y);
              const leafSprite = new Sprite(leafTexture);
              leafSprite.anchor.set(0.5, 1);
              leafSprite.x = screenX;
              leafSprite.y = screenY - (branchStartHeight + branch.height) * (TILE_HEIGHT / 4);
              leafSprite.tint = 0x32CD32; // Lime green tint
              tileContainer.addChild(leafSprite);
              treeSprites.push(leafSprite);
            }
          });
        });
        
        treeSpritesRef.current = treeSprites;
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
          if (keysPressedRef.current.has('arrowleft') || keysPressedRef.current.has('a')) {
            cameraRef.current.x += CAMERA_SPEED;
          }
          if (keysPressedRef.current.has('arrowright') || keysPressedRef.current.has('d')) {
            cameraRef.current.x -= CAMERA_SPEED;
          }
          if (keysPressedRef.current.has('arrowup') || keysPressedRef.current.has('w')) {
            cameraRef.current.y += CAMERA_SPEED;
          }
          if (keysPressedRef.current.has('arrowdown') || keysPressedRef.current.has('s')) {
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