import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@loomsync\/core\/automerge$/,
        replacement: new URL(
          "./packages/core/src/automerge.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/core\/browser$/,
        replacement: new URL(
          "./packages/core/src/browser.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/core\/memory$/,
        replacement: new URL(
          "./packages/core/src/memory.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/core$/,
        replacement: new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      },
      {
        find: /^@loomsync\/index\/automerge$/,
        replacement: new URL(
          "./packages/index/src/automerge.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/index\/memory$/,
        replacement: new URL(
          "./packages/index/src/memory.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/index$/,
        replacement: new URL("./packages/index/src/index.ts", import.meta.url).pathname,
      },
      {
        find: /^@loomsync\/client\/browser$/,
        replacement: new URL(
          "./packages/client/src/browser.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/client\/node$/,
        replacement: new URL(
          "./packages/client/src/node.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/client\/testing$/,
        replacement: new URL(
          "./packages/client/src/testing.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@loomsync\/client$/,
        replacement: new URL("./packages/client/src/index.ts", import.meta.url).pathname,
      },
      {
        find: /^@loomsync\/text$/,
        replacement: new URL("./packages/text/src/index.ts", import.meta.url).pathname,
      },
    ],
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
  },
});
