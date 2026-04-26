import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@lync\/core\/automerge$/,
        replacement: new URL(
          "./packages/core/src/automerge.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/core\/browser$/,
        replacement: new URL(
          "./packages/core/src/browser.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/core\/memory$/,
        replacement: new URL(
          "./packages/core/src/memory.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/core$/,
        replacement: new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      },
      {
        find: /^@lync\/index\/automerge$/,
        replacement: new URL(
          "./packages/index/src/automerge.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/index\/memory$/,
        replacement: new URL(
          "./packages/index/src/memory.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/index$/,
        replacement: new URL("./packages/index/src/index.ts", import.meta.url).pathname,
      },
      {
        find: /^@lync\/client\/browser$/,
        replacement: new URL(
          "./packages/client/src/browser.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/client\/node$/,
        replacement: new URL(
          "./packages/client/src/node.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/client\/testing$/,
        replacement: new URL(
          "./packages/client/src/testing.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@lync\/client$/,
        replacement: new URL("./packages/client/src/index.ts", import.meta.url).pathname,
      },
      {
        find: /^@lync\/text$/,
        replacement: new URL("./packages/text/src/index.ts", import.meta.url).pathname,
      },
    ],
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
  },
});
