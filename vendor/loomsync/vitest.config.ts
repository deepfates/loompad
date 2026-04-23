import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@loomsync/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@loomsync/core/automerge": new URL(
        "./packages/core/src/automerge.ts",
        import.meta.url,
      ).pathname,
      "@loomsync/core/browser": new URL(
        "./packages/core/src/browser.ts",
        import.meta.url,
      ).pathname,
      "@loomsync/index": new URL("./packages/index/src/index.ts", import.meta.url).pathname,
      "@loomsync/index/browser": new URL(
        "./packages/index/src/browser.ts",
        import.meta.url,
      ).pathname,
      "@loomsync/text": new URL("./packages/text/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
  },
});
