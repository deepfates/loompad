import React, { useEffect, useRef } from 'react';
import { Application, Sprite, Assets, Spritesheet, Texture, Ticker } from 'pixi.js';

interface IsometricGardenVisualizerProps {
  width?: number;
  height?: number;
}

const GRID_SIZE = 8;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 64; // match your generated tile size

function isoToScreen(x: number, y: number) {
  return [
    (x - y) * (TILE_WIDTH / 2),
    (x + y) * (TILE_HEIGHT / 4) // 1/4 for isometric vertical squish
  ];
}

const ATLAS_URL = '/client/assets/sprites/tileset.json';
const IMAGE_URL = '/client/assets/sprites/tileset.png';
const TILE_FRAMES = ['grass', 'dirt', 'water'];

const IsometricGardenVisualizer: React.FC<IsometricGardenVisualizerProps> = ({
  width = 600,
  height = 400
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>();
  const tilesRef = useRef<Sprite[][]>([]);
  const tickerRef = useRef<Ticker>();

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
          // Load atlas as raw JSON data, not as a spritesheet
          const response = await fetch(ATLAS_URL);
          atlas = await response.json();
          console.log('Atlas loaded:', atlas);
        } catch (e) {
          console.error('Failed to load atlas JSON:', e);
          return;
        }
        
        let spritesheet;
        try {
          // Load the texture first, then create spritesheet
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

        const offsetX = width / 2;
        const offsetY = 80;

        // Store references to all tiles for animation
        const tiles: Sprite[][] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
          tiles[x] = [];
          for (let y = 0; y < GRID_SIZE; y++) {
            // Randomize tile type for demo
            const frame = TILE_FRAMES[Math.floor(Math.random() * TILE_FRAMES.length)];
            const tileTexture = spritesheet.textures[frame];
            const [screenX, screenY] = isoToScreen(x, y);
            const sprite = new Sprite(tileTexture);
            sprite.anchor.set(0.5, 1); // Center bottom
            sprite.x = offsetX + screenX;
            sprite.y = offsetY + screenY;
            app.stage.addChild(sprite);
            tiles[x][y] = sprite;
          }
        }
        tilesRef.current = tiles;

        // Animation ticker for wave effect
        let time = 0;
        const ticker = new Ticker();
        ticker.add(() => {
          time += 0.05;
          for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
              const sprite = tilesRef.current[x][y];
              sprite.y = offsetY + isoToScreen(x, y)[1] + Math.cos(time + x + y) * 8;
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

    return () => {
      destroyed = true;
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
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: '2px solid #333',
        backgroundColor: '#2A2A2A',
        position: 'relative'
      }}
    />
  );
};

export default IsometricGardenVisualizer; 