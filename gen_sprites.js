// generate_tileset.js
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const TILE_WIDTH = 32; // Reduced from 64 to 32
const TILE_HEIGHT = 32; // Reduced from 64 to 32
const BLOCK_HEIGHT = 16; // Reduced from 32 to 16 for smaller tiles
const TILES = [
  // Base terrain tiles
  { name: 'grass', top: '#4A5D23', left: '#35501a', right: '#6A7B43' },
  { name: 'dirt',  top: '#8B4513', left: '#5a2d0c', right: '#b86b3a' },
  { name: 'water', top: '#4A90E2', left: '#27649b', right: '#6ec6ff' },
  { name: 'sand',  top: '#F4D03F', left: '#D4AC0D', right: '#F7DC6F' },
  
  // Foliage tiles - trees
  { name: 'tree_small', top: '#2E8B57', left: '#228B22', right: '#32CD32', hasFoliage: true },
  { name: 'tree_large', top: '#006400', left: '#228B22', right: '#32CD32', hasFoliage: true },
  { name: 'pine_tree', top: '#228B22', left: '#006400', right: '#32CD32', hasFoliage: true },
  
  // Foliage tiles - bushes and shrubs
  { name: 'bush', top: '#90EE90', left: '#32CD32', right: '#98FB98', hasFoliage: true },
  { name: 'shrub', top: '#228B22', left: '#006400', right: '#32CD32', hasFoliage: true },
  
  // Foliage tiles - flowers
  { name: 'flowers_red', top: '#FF6B6B', left: '#FF5252', right: '#FF8A80', hasFoliage: true },
  { name: 'flowers_yellow', top: '#FFD93D', left: '#FFC107', right: '#FFEB3B', hasFoliage: true },
  { name: 'flowers_blue', top: '#4ECDC4', left: '#26C6DA', right: '#29B6F6', hasFoliage: true },
  { name: 'flowers_purple', top: '#9C27B0', left: '#7B1FA2', right: '#AB47BC', hasFoliage: true },
  
  // Special terrain
  { name: 'stone', top: '#696969', left: '#4A4A4A', right: '#808080' },
  { name: 'mud', top: '#8B4513', left: '#654321', right: '#A0522D' }
];

const outDir = path.join('client', 'assets', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

const canvas = createCanvas(TILE_WIDTH * TILES.length, TILE_HEIGHT);
const ctx = canvas.getContext('2d');

TILES.forEach((tile, i) => {
  const offsetX = i * TILE_WIDTH;
  ctx.save();
  ctx.translate(offsetX, 0);

  // Draw top face (diamond)
  ctx.beginPath();
  ctx.moveTo(TILE_WIDTH / 2, 0);
  ctx.lineTo(TILE_WIDTH, TILE_HEIGHT / 4);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT / 2);
  ctx.lineTo(0, TILE_HEIGHT / 4);
  ctx.closePath();
  ctx.fillStyle = tile.top;
  ctx.fill();

  // Draw left face (parallelogram)
  ctx.beginPath();
  ctx.moveTo(0, TILE_HEIGHT / 4);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT / 2);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
  ctx.lineTo(0, TILE_HEIGHT * 3 / 4);
  ctx.closePath();
  ctx.fillStyle = tile.left;
  ctx.fill();

  // Draw right face (parallelogram)
  ctx.beginPath();
  ctx.moveTo(TILE_WIDTH, TILE_HEIGHT / 4);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT / 2);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT);
  ctx.lineTo(TILE_WIDTH, TILE_HEIGHT * 3 / 4);
  ctx.closePath();
  ctx.fillStyle = tile.right;
  ctx.fill();

  // Add foliage details for foliage tiles
  if (tile.hasFoliage) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = tile.top;
    // Draw 3-5 small circles on the top face for foliage/flowers
    for (let j = 0; j < 3 + Math.floor(Math.random() * 3); j++) {
      const angle = Math.random() * Math.PI * 2;
      const r = TILE_WIDTH / 6 + Math.random() * (TILE_WIDTH / 8);
      const cx = TILE_WIDTH / 2 + Math.cos(angle) * r;
      const cy = TILE_HEIGHT / 4 + Math.sin(angle) * r / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

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