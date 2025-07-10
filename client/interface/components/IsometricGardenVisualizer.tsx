import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Sprite, Assets, Spritesheet, Texture, Ticker, Container } from 'pixi.js';

interface IsometricGardenVisualizerProps {
  width?: number;
  height?: number;
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

const IsometricGardenVisualizer: React.FC<IsometricGardenVisualizerProps> = ({
  width = 1200, // Increased from 800 to 1200 for larger view
  height = 800   // Increased from 600 to 800 for larger view
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>();
  const tilesRef = useRef<Sprite[][]>([]);
  const tickerRef = useRef<Ticker>();
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const keysPressedRef = useRef<Set<string>>(new Set());

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

    const initPixiJS = async () => {
      try {
        const app = new Application();
        await app.init({
          width,
          height,
          backgroundColor: 0x2A2A2A,
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

        // Create 50x50 grid of tiles
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
        });
        ticker.start();
        tickerRef.current = ticker;

        if (!destroyed) {
          containerRef.current.appendChild(app.canvas);
          appRef.current = app;
        } else {
          app.destroy(true);
          ticker.stop();
          ticker.destroy();
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
      
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = undefined;
      }
      if (tickerRef.current) {
        tickerRef.current.stop();
        tickerRef.current.destroy();
        tickerRef.current = undefined;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [width, height, handleKeyDown, handleKeyUp, handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: '2px solid #333',
        backgroundColor: '#2A2A2A',
        position: 'relative',
        cursor: 'grab'
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