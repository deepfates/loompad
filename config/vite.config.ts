import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

console.log("Loading vite config from config/vite.config.ts...");

// this file is needed for React hot reloads
const mode = "production";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assets/icon-*"],
      manifest: {
        name: "LoomPad",
        short_name: "LoomPad",
        description: "An infinite game of choose your own adventure",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#2a2a2a",
        scope: "/",
        icons: [
          { src: "assets/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "assets/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "assets/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,ttf,woff}"],
        runtimeCaching: [
          {
            urlPattern: /\/api\/(models|generate)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api",
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/openrouter\.ai\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "openrouter-api",
              networkTimeoutSeconds: 30,
            },
          },
        ],
      },
    }),
  ],
  base: "/client/",
  root: path.resolve(__dirname, "../"),
  build: {
    outDir: "../dist/",
    rollupOptions: {
      input: path.resolve(__dirname, "../client/index.html"),
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
  server: {
    fs: {
      // Allow serving files from node_modules
      allow: [".."],
    },
  },
});
