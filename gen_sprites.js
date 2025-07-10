// generate_tileset.js
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 64;
const BLOCK_HEIGHT = 32; // Height of the block's vertical sides
const TILES = [
  { name: 'grass', top: '#4A5D23', left: '#35501a', right: '#6A7B43' },
  { name: 'dirt',  top: '#8B4513', left: '#5a2d0c', right: '#b86b3a' },
  { name: 'water', top: '#4A90E2', left: '#27649b', right: '#6ec6ff' }
];

const outDir = path.join('public', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

const canvas = createCanvas(TILE_WIDTH * TILES.length, TILE_HEIGHT);
const ctx = canvas.getContext('2d');

TILES.forEach((tile, i) => {
  const offsetX = i * TILE_WIDTH;
  ctx.save();
  ctx.translate(offsetX, 0);

  // Draw left side
  ctx.beginPath();
  ctx.moveTo(0, TILE_HEIGHT / 2);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - BLOCK_HEIGHT);
  ctx.lineTo(0, TILE_HEIGHT / 2 - BLOCK_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = tile.left;
  ctx.fill();

  // Draw right side
  ctx.beginPath();
  ctx.moveTo(TILE_WIDTH, TILE_HEIGHT / 2);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - BLOCK_HEIGHT);
  ctx.lineTo(TILE_WIDTH, TILE_HEIGHT / 2 - BLOCK_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = tile.right;
  ctx.fill();

  // Draw top
  ctx.beginPath();
  ctx.moveTo(TILE_WIDTH / 2, 0);
  ctx.lineTo(TILE_WIDTH, TILE_HEIGHT / 2 - BLOCK_HEIGHT);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT - BLOCK_HEIGHT);
  ctx.lineTo(0, TILE_HEIGHT / 2 - BLOCK_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = tile.top;
  ctx.fill();

  ctx.restore();
});

// Save PNG
const pngPath = path.join(outDir, 'tileset.png');
const out = fs.createWriteStream(pngPath);
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () => console.log('Saved', pngPath));

// Create JSON atlas
const frames = {};
TILES.forEach((tile, i) => {
  frames[tile.name] = {
    frame: { x: i * TILE_WIDTH, y: 0, w: TILE_WIDTH, h: TILE_HEIGHT }
  };
});
const atlas = {
  frames,
  meta: {
    image: 'tileset.png',
    size: { w: TILE_WIDTH * TILES.length, h: TILE_HEIGHT }
  }
};
const jsonPath = path.join(outDir, 'tileset.json');
fs.writeFileSync(jsonPath, JSON.stringify(atlas, null, 2));
console.log('Saved', jsonPath);