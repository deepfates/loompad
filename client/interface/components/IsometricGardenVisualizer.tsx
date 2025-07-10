import React, { useEffect, useRef } from 'react';
import { Application, Graphics, Ticker } from 'pixi.js';

interface IsometricGardenVisualizerProps {
  width?: number;
  height?: number;
}

const GRID_SIZE = 8;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const TILE_COLOR = 0x4A5D23;

function isoToScreen(x: number, y: number) {
  return [
    (x - y) * (TILE_WIDTH / 2),
    (x + y) * (TILE_HEIGHT / 2)
  ];
}

const IsometricGardenVisualizer: React.FC<IsometricGardenVisualizerProps> = ({
  width = 600,
  height = 400
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>();
  const tilesRef = useRef<Graphics[][]>([]);
  const tickerRef = useRef<Ticker>();

  useEffect(() => {
    if (!containerRef.current) return;

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

        const offsetX = width / 2;
        const offsetY = 60;

        // Store references to all tiles for animation
        const tiles: Graphics[][] = [];
        for (let x = 0; x < GRID_SIZE; x++) {
          tiles[x] = [];
          for (let y = 0; y < GRID_SIZE; y++) {
            const [screenX, screenY] = isoToScreen(x, y);
            const g = new Graphics();
            g.moveTo(0, TILE_HEIGHT / 2)
              .lineTo(TILE_WIDTH / 2, 0)
              .lineTo(TILE_WIDTH, TILE_HEIGHT / 2)
              .lineTo(TILE_WIDTH / 2, TILE_HEIGHT)
              .lineTo(0, TILE_HEIGHT / 2)
              .fill(TILE_COLOR);

            g.x = offsetX + screenX;
            g.y = offsetY + screenY;
            app.stage.addChild(g);
            tiles[x][y] = g;
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
              const g = tilesRef.current[x][y];
              // Wave effect: animate y position
              g.y = offsetY + isoToScreen(x, y)[1] + Math.cos(time + x + y) * 12;
            }
          }
        });
        ticker.start();
        tickerRef.current = ticker;

        containerRef.current.appendChild(app.canvas);
        appRef.current = app;
      } catch (error) {
        console.error('Failed to initialize PixiJS:', error);
      }
    };

    initPixiJS();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
      }
      if (tickerRef.current) {
        tickerRef.current.stop();
        tickerRef.current.destroy();
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