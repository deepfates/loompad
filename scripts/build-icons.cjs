const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Simple SVG-based icon generator for PWA - Game Boy style
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const generateSVG = (size, isMaskable = false) => {
  const padding = isMaskable ? size * 0.1 : 0;
  const iconSize = size - padding * 2;
  const centerX = size / 2;
  const centerY = size / 2;
  const dpadSize = iconSize * 0.7;
  const armThickness = dpadSize * 0.35;
  const armLength = dpadSize * 0.85;
  const cornerRadius = armThickness * 0.15;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${isMaskable ? `<rect width="${size}" height="${size}" fill="#000" rx="${iconSize * 0.2}"/>` : ""}

  <!-- D-pad plus shape - Game Boy style -->
  <!-- Horizontal bar -->
  <rect x="${centerX - armLength / 2}" y="${centerY - armThickness / 2}" width="${armLength}" height="${armThickness}" fill="#FFF" rx="${cornerRadius}"/>

  <!-- Vertical bar -->
  <rect x="${centerX - armThickness / 2}" y="${centerY - armLength / 2}" width="${armThickness}" height="${armLength}" fill="#FFF" rx="${cornerRadius}"/>

  <!-- Single outline path to avoid overlapping stroke joins -->
  <path d="
    M ${centerX - armThickness / 2} ${centerY - armLength / 2}
    L ${centerX - armThickness / 2} ${centerY - armThickness / 2}
    L ${centerX - armLength / 2} ${centerY - armThickness / 2}
    L ${centerX - armLength / 2} ${centerY + armThickness / 2}
    L ${centerX - armThickness / 2} ${centerY + armThickness / 2}
    L ${centerX - armThickness / 2} ${centerY + armLength / 2}
    L ${centerX + armThickness / 2} ${centerY + armLength / 2}
    L ${centerX + armThickness / 2} ${centerY + armThickness / 2}
    L ${centerX + armLength / 2} ${centerY + armThickness / 2}
    L ${centerX + armLength / 2} ${centerY - armThickness / 2}
    L ${centerX + armThickness / 2} ${centerY - armThickness / 2}
    L ${centerX + armThickness / 2} ${centerY - armLength / 2}
    Z
  " fill="none" stroke="#000" stroke-width="${iconSize * 0.04}" stroke-linejoin="round"/>

  <!-- Center ⌥ -->
  <text x="${centerX}" y="${centerY + iconSize * 0.08}" text-anchor="middle" fill="#000" font-family="monospace" font-size="${iconSize * 0.25}" font-weight="bold">⌥</text>
</svg>`;
};

const assetsDir = path.join(__dirname, "../client/assets");

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log("🎮 Generating Game Boy style D-pad icons...");

// Generate SVGs
sizes.forEach((size) => {
  const svg = generateSVG(size);
  const filename = `icon-${size}.svg`;
  fs.writeFileSync(path.join(assetsDir, filename), svg);
});

// Generate maskable icon
const maskableSVG = generateSVG(512, true);
fs.writeFileSync(path.join(assetsDir, "icon-512-maskable.svg"), maskableSVG);

// Convert SVGs to PNGs using sharp-cli
console.log("📸 Converting to PNG...");

try {
  // Check if sharp-cli is available
  execSync("sharp --version", { stdio: "ignore" });

  // Convert regular icons
  sizes.forEach((size) => {
    try {
      execSync(
        `sharp -i ${path.join(assetsDir, `icon-${size}.svg`)} -o ${path.join(assetsDir, `icon-${size}.png`)} resize ${size} ${size}`,
        { cwd: assetsDir },
      );
      console.log(`  ✅ icon-${size}.png`);
    } catch (error) {
      console.log(`  ❌ Failed to generate icon-${size}.png`);
    }
  });

  // Convert maskable icon
  try {
    execSync(
      `sharp -i ${path.join(assetsDir, "icon-512-maskable.svg")} -o ${path.join(assetsDir, "icon-512-maskable.png")} resize 512 512`,
      { cwd: assetsDir },
    );
    console.log("  ✅ icon-512-maskable.png");
  } catch (error) {
    console.log("  ❌ Failed to generate icon-512-maskable.png");
  }
} catch (error) {
  console.log("⚠️  sharp-cli not found, PNG conversion skipped");
  console.log("   Install with: npm install -g sharp-cli");
  console.log("   SVG files generated successfully");
}

console.log("🎯 Icon generation complete!");
