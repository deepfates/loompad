import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/postcss";

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
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
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
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  base: "/",
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
    host: "0.0.0.0",
    port: 5000,
    hmr: {
      clientPort: 443,
      protocol: "wss",
    },
    fs: {
      // Allow serving files from node_modules
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      srcl: path.resolve(__dirname, "../node_modules/srcl"),
      "@": path.resolve(__dirname, "../node_modules/srcl/src"),
      "@common": path.resolve(__dirname, "../node_modules/srcl/common"),
      "@components": path.resolve(__dirname, "../node_modules/srcl/components"),
      "@lib": path.resolve(__dirname, "../node_modules/srcl/lib"),
      "@modules": path.resolve(__dirname, "../node_modules/srcl/modules"),
    },
  },
  optimizeDeps: {
    exclude: ["srcl"],
  },
});
