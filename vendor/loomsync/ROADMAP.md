# LoomSync Roadmap

## Verification Loop

Run this after each implementation slice:

```bash
pnpm verify
```

`verify` runs tests, builds packages, and typechecks emitted package surfaces.

## Completed v0.2 Cutover

- [x] Create standalone TypeScript workspace.
- [x] Define `core`, `index`, `text`, and `sync-server` package boundaries.
- [x] Implement in-memory loom backend.
- [x] Implement in-memory index backend.
- [x] Implement text helpers for Loompad migration.
- [x] Add meaningful topology, reference, index, sync, and text tests.
- [x] Add Automerge document schema for looms.
- [x] Implement Automerge `create`, `open`, `appendTurn`, and queries.
- [x] Add Automerge export/import validation.
- [x] Add Automerge subscription event translation.
- [x] Add browser client for IndexedDB, BroadcastChannel, and WebSocket sync.
- [x] Implement Automerge-backed indexes.
- [x] Add WebSocket sync relay package.
- [x] Cut public language to `loom`, `turn`, `thread`, `reference`, and `index`.
- [x] Fold Loompad integration learnings into docs and payload boundaries.

## Likely Next Work

- [ ] Publish packages once the vendored Loompad integration is stable.
- [ ] Add a small example app that demonstrates loom, index, and thread links.
- [ ] Add docs for recommended app-level turn metadata conventions.
- [ ] Add sync-server deployment notes.
- [ ] Decide whether a MessageChannel adapter is worth adding after real usage.
