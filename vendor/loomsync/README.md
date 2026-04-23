# LoomSync

LoomSync is a TypeScript workspace for local-first branching worlds.

## Packages

- `@loomsync/core`: one append-only rooted branching world.
- `@loomsync/index`: an index document that links to many worlds.
- `@loomsync/text`: helpers for text payload worlds.

The current implementation includes in-memory backends and shared interfaces. The
Automerge-backed backend is the next implementation target.

## Development

```bash
pnpm install
pnpm test
pnpm build
```
