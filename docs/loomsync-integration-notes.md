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
- Story creation/listing now goes through a LoomSync index document.
- Browser runtime uses IndexedDB + BroadcastChannel through Automerge Repo.
- Generation writes append generated continuations to the current LoomSync
  world, then rematerializes the nested tree as a derived UI view.

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

- The package barrel pulled in Automerge/browser modules during vendoring.
  LoomSync now has subpath exports such as `@loomsync/core/memory` and
  `@loomsync/core/types`.
- Vite consumers need WASM support for Automerge via `vite-plugin-wasm` and
  `vite-plugin-top-level-await`.
- Importing nested legacy story trees into an append-only world is useful for
  migration, but not for steady-state editing. The app should write future
  generations with `appendAfter`.
- Generated text splitting creates node chains, so LoomSync text helpers need a
  first-class `appendChain`/`appendStoryNodeChain` path.

## Remaining Cutover Work

- Add share/open-by-root-url flows.
- Replace edit-menu tree rewrites with append-only edit records or a deliberate
  root metadata/story replacement policy.
- Persist and display human-readable story titles from index entries instead of
  showing root IDs as menu keys.
- Add cross-tab/browser sync tests around the IndexedDB + BroadcastChannel
  runtime.
