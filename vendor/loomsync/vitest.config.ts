import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@loomsync/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@loomsync/index": new URL("./packages/index/src/index.ts", import.meta.url).pathname,
      "@loomsync/text": new URL("./packages/text/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
  },
});
