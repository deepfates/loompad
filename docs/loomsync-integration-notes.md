# LoomSync Integration Notes

This branch is a practice cutover for testing Loompad against the vendored
LoomSync library. It is not intended to be merge-ready as-is.

## Verified So Far

- LoomSync is vendored under `vendor/loomsync`.
- Loompad installs Automerge Repo and browser/network adapter dependencies.
- `client/interface/loomsync/storyAdapter.ts` can:
  - convert nested Loompad `StoryNode` data into LoomSync snapshots,
  - use an Automerge-backed LoomSync world,
  - materialize a LoomSync world back into the nested shape the current UI reads,
  - append generated `StoryNode` chains into a LoomSync world.
- `lastSelectedIndex` is no longer used by `useStoryTree` as shared content.
  Preferred child selection now lives in session state via
  `storySessionState.ts`.

## Verification Commands

```bash
bun test
bun run lint
bun run build
```

All three currently pass on this branch.

## Design Boundary

Shared world state:

- story text nodes,
- parent pointers,
- canonical child order.

Local session state:

- current depth,
- selected branch indices,
- preferred child per node,
- minimap/viewport focus,
- draft/edit state.

## Lessons For LoomSync

- The package barrel currently pulls in Automerge/browser modules. A consumer
  that only needs memory/types may prefer subpath exports such as
  `@loomsync/core/memory` and `@loomsync/core/types`.
- Importing nested legacy story trees into an append-only world is useful for
  migration, but not for steady-state editing. The app should write future
  generations with `appendAfter`.
- Generated text splitting creates node chains, so LoomSync text helpers need a
  first-class `appendChain`/`appendStoryNodeChain` path.

## Next Cutover Work

- Replace localStorage story-tree persistence with a LoomSync index document.
- Store one Automerge root per story.
- Use IndexedDB + BroadcastChannel in browser by default.
- Add share/open-by-root-url flows.
- Make generation write directly to the current story world, then materialize
  nested UI data as a derived view.
