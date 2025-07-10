import React, { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

interface IsometricGardenVisualizerProps {
  width?: number;
  height?: number;
}

const TILE_SIZE = 64;
const GRID_SIZE = 5;
const COLORS = [0x4A5D23, 0x5A6B33, 0x6A7B43, 0x8B4513, 0x4A90E2];

/**
 * IsometricGardenVisualizer - Simple PixiJS v8 Scene
 * 
 * Creates a blank PixiJS scene using v8 async initialization.
 */
const IsometricGardenVisualizer: React.FC<IsometricGardenVisualizerProps> = ({
  width = TILE_SIZE * GRID_SIZE,
  height = TILE_SIZE * GRID_SIZE
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application>();

  useEffect(() => {
    if (!containerRef.current) return;

    const initPixiJS = async () => {
      try {
        const app = new Application();
        await app.init({
          width,
          height,
          backgroundColor: 0x2A2A2A,
          antialias: false,
          resolution: 1,
          autoDensity: true
        });

        // Draw 5x5 grid of tiles
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const g = new Graphics();
            const color = COLORS[(x + y) % COLORS.length];
            g.rect(0, 0, TILE_SIZE - 2, TILE_SIZE - 2).fill(color);
            g.x = x * TILE_SIZE;
            g.y = y * TILE_SIZE;
            app.stage.addChild(g);
          }
        }

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