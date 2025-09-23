import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

if (process.env.NODE_ENV !== "production") {
  console.log("Loading vite config from config/vite.config.ts...");
}

// this file is needed for React hot reloads
const mode = "production";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assets/icon-*"],
      manifest: false, // Use existing manifest.webmanifest file
      injectRegister: "auto",
      devOptions: {
        enabled: false, // Disable PWA in development to avoid JSON parsing errors
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
