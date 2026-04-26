# LoomSync

LoomSync is a small TypeScript toolkit for local-first branching documents.

It gives an app a durable, synced **loom**: an append-only set of **turns** with
parent pointers. From those turns you can materialize **threads**, discover
leaves, export/import deterministic snapshots, and create portable
**references** that work well in URLs.

The implementation is intentionally boring underneath: Automerge documents,
IndexedDB persistence, BroadcastChannel tab sync, and optional WebSocket sync.
The public API stays about looms, turns, threads, references, and indexes.

## Vocabulary

- A **loom** is one shared branching namespace. In Automerge, one loom is one
  document URL.
- A **turn** is one append-only content record in a loom. It has one parent or
  no parent.
- A **thread** is the ordered lineage from a top-level turn to any target turn.
  The target does not need to be a leaf.
- A **reference** is a portable address to a loom, turn, thread, or index.
- An **index** is a synced discovery document that stores loom references plus
  narrow display metadata. It does not duplicate loom contents.

## Boundaries

LoomSync stores durable shared content. It does not store session state.

Keep these in your app, not in LoomSync snapshots or index entries:

- current focus
- preferred child or branch
- viewport state
- drafts and edit mode
- read progress
- presence and cursors

Use the three data lanes deliberately:

- **turn payload**: what the turn says, for example `{ text: string }`
- **turn meta**: what the turn is or relates to, for example role, author,
  provenance, `revises`, `references`, or `respondsTo`
- **loom meta**: mutable chrome for the loom, for example title or color

For story-like apps, the seed text should be a top-level turn:
`appendTurn(null, { text: "Once..." })`. Editing that seed should append another
top-level turn with turn metadata such as `{ revises: seed.id }`, not rewrite
loom metadata or copy a whole subtree.

## Packages

- `@loomsync/core`: looms, turns, threads, references, and snapshots.
- `@loomsync/index`: synced indexes of loom references.
- `@loomsync/client`: browser, Node, and test runtime clients.
- `@loomsync/text`: small helpers for text payload looms.
- `@loomsync/sync-server`: a simple Automerge WebSocket sync relay.

## Quick Start

```ts
import { createTestLoomClient } from "@loomsync/client/testing";

type TextPayload = { text: string };
type LoomMeta = { title: string };
type TurnMeta = {
  role: "prose" | "revision";
  revises?: string;
};

const client = createTestLoomClient<TextPayload, LoomMeta, TurnMeta>();

const info = await client.looms.create({ title: "Story 1" });
const loom = await client.looms.open(info.id);

const seed = await loom.appendTurn(
  null,
  { text: "Once upon a time," },
  { role: "prose" },
);

const next = await loom.appendTurn(
  seed.id,
  { text: " the bell rang." },
  { role: "prose" },
);

await loom.appendTurn(
  null,
  { text: "At the edge of town," },
  { role: "revision", revises: seed.id },
);

const thread = await loom.threadTo(next.id);
const leaves = await loom.leaves();
const snapshot = await loom.export();
```

## Node Scripts

Agents, importers, and command-line tools can write to the same kind of loom
without depending on Loompad:

```ts
import { createNodeLoomClient } from "@loomsync/client/node";

const client = createNodeLoomClient<TextPayload>({
  storageDir: ".loomsync",
  syncUrl: "ws://localhost:3030",
});

const info = await client.looms.create({ title: "Imported thread" });
const loom = await client.looms.open(info.id);
await loom.appendTurn(null, { text: "First imported post" });

await client.close();
```

## Browser Client

Browser apps usually want looms, indexes, references, and one shared Automerge
repo. `@loomsync/client/browser` provides that shape:

```ts
import { createBrowserLoomClient } from "@loomsync/client/browser";

const client = createBrowserLoomClient<TextPayload, LoomMeta, TurnMeta>({
  browser: {
    indexedDb: { database: "my-app", store: "documents" },
    broadcastChannel: { channelName: "my-app" },
    syncPath: "/loomsync",
  },
});

const info = await client.looms.create({ title: "Story 1" });
const loom = await client.looms.open(info.id);
const seed = await loom.appendTurn(null, { text: "Once" });

const index = await client.indexes.create({ title: "My stories" });
await index.addLoom(client.references.loom(info.id), { title: "Story 1" });

const threadUrl = client.references.toUrl(
  client.references.thread(info.id, seed.id),
  window.location,
);

const ref = client.references.fromUrl(window.location);
if (ref) {
  const opened = await client.openReference(ref);
  if (opened.kind === "thread") {
    console.log(opened.thread);
  }
}
```

Default reference URLs use `?ref=<base64url-json>`. They intentionally do not
include slugs or title hints. Human labels belong in app UI and index metadata;
the reference itself is just the durable address.

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
import { createNodeLoomClient } from "@loomsync/client/node";
import { createAutomergeLooms } from "@loomsync/core/automerge";
import type { Loom, Turn } from "@loomsync/core/types";
```

The normal application path is `@loomsync/client/*`. Lower-level core and index
adapter subpaths exist for custom runtimes and focused tests.

## Vendoring Into Apps

Until the packages are published, vendoring the workspace is a practical
integration path. Keep it mechanical:

- mirror this repo into the app under a clear directory such as
  `vendor/loomsync`
- exclude `.git`, `node_modules`, build output, and test-only files if the host
  runner would pick them up
- apply only app-specific import-path shims in the vendored copy
- fold real library fixes back into this repo first, then re-vendor

That keeps LoomSync as the source of truth while still letting apps test against
the exact library code they ship.

## Development

```bash
pnpm install
pnpm test
pnpm build
pnpm verify
```

`pnpm verify` runs tests, builds packages, and typechecks emitted package
surfaces.

## Status

This repo is currently a v0.2 breaking cutover. The public model is
`loom/turn/thread/reference/index`; the Automerge document schema still uses
plain internal fields such as `root`, `nodes`, `children`, and `parentId`.
