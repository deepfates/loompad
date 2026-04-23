# LoomSync Roadmap

## Verification Loop

Run this after each implementation slice:

```bash
pnpm verify
```

`verify` runs tests, builds packages, and typechecks emitted package surfaces.

## Current Plan

- [x] Create standalone TypeScript workspace.
- [x] Define `core`, `index`, and `text` package boundaries.
- [x] Implement in-memory `core` backend.
- [x] Implement in-memory `index` backend.
- [x] Implement text helpers for Loompad migration.
- [x] Add meaningful topology, index, and text tests.
- [x] Add Automerge document schema for `core`.
- [x] Implement Automerge `createRoot`, `openRoot`, `appendAfter`, and queries.
- [x] Add Automerge export/import validation.
- [x] Add Automerge subscription event translation.
- [x] Add browser adapter factory for IndexedDB + BroadcastChannel + WebSocket.
- [x] Implement Automerge-backed `index`.
- [x] Add WebSocket sync relay package or example.
- [x] Add Loompad compatibility adapter/hook examples.
- [x] Add package subpath exports from Loompad integration feedback.
