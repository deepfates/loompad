# LoomSync

LoomSync is a TypeScript workspace for local-first addressable looms.

## Packages

- `@loomsync/core`: append-only looms, turns, threads, and references.
- `@loomsync/index`: an index document that links to many looms.
- `@loomsync/text`: helpers for text payload looms.

The implementation includes in-memory and Automerge-backed looms and indexes,
with browser persistence and sync helpers for local-first apps.

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
import { createAutomergeLooms } from "@loomsync/core/automerge";
import type { Loom } from "@loomsync/core/types";
```

If a browser app needs looms, indexes, references, and one shared Automerge repo,
`@loomsync/index/browser` provides a turnkey client:

```ts
import { createBrowserLoomClient } from "@loomsync/index/browser";

const client = createBrowserLoomClient({
  browser: {
    indexedDb: { database: "my-app", store: "documents" },
    broadcastChannel: { channelName: "my-app" },
    syncPath: "/loomsync",
  },
});

const info = await client.looms.create({ title: "Story 1" });
const loom = await client.looms.open(info.id);
const first = await loom.appendTurn(null, { text: "Once" });
const ref = client.references.thread(info.id, first.id);
const url = client.references.toUrl(ref, window.location);
```

## Development

```bash
pnpm install
pnpm test
pnpm build
```
