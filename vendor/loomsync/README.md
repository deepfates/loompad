# LoomSync

LoomSync is a TypeScript workspace for local-first branching worlds.

## Packages

- `@loomsync/core`: one append-only rooted branching world.
- `@loomsync/index`: an index document that links to many worlds.
- `@loomsync/text`: helpers for text payload worlds.

The current implementation includes in-memory backends and shared interfaces. The
Automerge-backed backend is the next implementation target.

## Browser Bundling

Automerge uses a WASM bundle. Vite consumers should include:

```ts
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
});
```

Packages expose subpaths so apps can import only the surface they need:

```ts
import { createAutomergeLoomWorlds } from "@loomsync/core/automerge";
import type { LoomWorld } from "@loomsync/core/types";
```

If a browser app needs both worlds and indexes on one shared Automerge repo,
`@loomsync/index/browser` provides a turnkey runtime helper:

```ts
import { createBrowserAutomergeLoomRuntime } from "@loomsync/index/browser";

const runtime = createBrowserAutomergeLoomRuntime({
  browser: {
    indexedDb: { database: "my-app", store: "documents" },
    broadcastChannel: { channelName: "my-app" },
    syncPath: "/loomsync",
  },
});

const worlds = runtime.worlds;
const indexes = runtime.indexes;
```

## Development

```bash
pnpm install
pnpm test
pnpm build
```
