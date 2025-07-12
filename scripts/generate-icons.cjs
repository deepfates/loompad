const fs = require('fs');
const path = require('path');

// Simple SVG-based icon generator for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const generateSVG = (size, isMaskable = false) => {
  const padding = isMaskable ? size * 0.1 : 0;
  const iconSize = size - (padding * 2);
  const centerX = size / 2;
  const centerY = size / 2;
  const dpadSize = iconSize * 0.7;
  const armThickness = dpadSize * 0.28;
  const armLength = dpadSize * 0.9;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${isMaskable ? `<rect width="${size}" height="${size}" fill="#000" rx="${iconSize*0.2}"/>` : ''}
  
  <!-- D-pad plus shape - Game Boy style -->
  <!-- Horizontal bar -->
  <rect x="${centerX - armLength/2}" y="${centerY - armThickness/2}" width="${armLength}" height="${armThickness}" fill="#FFF"/>
  
  <!-- Vertical bar -->
  <rect x="${centerX - armThickness/2}" y="${centerY - armLength/2}" width="${armThickness}" height="${armLength}" fill="#FFF"/>
  
  <!-- Center L -->
  <text x="${centerX}" y="${centerY + iconSize*0.06}" text-anchor="middle" fill="#000" font-family="monospace" font-size="${iconSize*0.2}" font-weight="bold">L</text>
</svg>`;
};

const assetsDir = path.join(__dirname, '../client/assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate regular icons
sizes.forEach(size => {
  const svg = generateSVG(size);
  const filename = `icon-${size}.svg`;
  fs.writeFileSync(path.join(assetsDir, filename), svg);
  console.log(`Generated ${filename}`);
});

// Generate maskable icon
const maskableSVG = generateSVG(512, true);
fs.writeFileSync(path.join(assetsDir, 'icon-512-maskable.svg'), maskableSVG);
console.log('Generated icon-512-maskable.svg');

console.log('\nTo convert SVGs to PNGs, you can use a tool like:');
console.log('npm install -g svgexport');
console.log('svgexport icon-72.svg icon-72.png 72:72');