# Persistent Story API (alpha)

This repository now ships a minimal persistent store for Loompad stories powered by SQLite. The API is Express-based and lives under `/api/stories`.

## Data model
- Stories are persisted to `server/data/stories.db` (auto-created if missing)
- Default seed story: slug `loompad`, id `loompad-default`, root node id `root`
- Nodes include `text`, `choiceIndex`, `children`, and optional `activeChildId` for favored-path hints

### Shared types
Types are defined in `shared/storyTypes.ts` and reused by both server and client API helpers.

## Endpoints
- `GET /api/stories` → list `StorySummary` records
- `POST /api/stories` → create story (body: `title?`, `slug?`, `rootText?`)
- `GET /api/stories/:storyId` → full story record (nodes map)
- `GET /api/stories/:storyId/nodes/:nodeId` → single node
- `GET /api/stories/:storyId/nodes/:nodeId/window?ancestors=&descendants=&siblings=` → loom window with ancestors, favored path, and sibling slices
- `POST /api/stories/:storyId/nodes/:nodeId/children` → create child (body: `text`, optional `choiceIndex`, `makeActive`)
- `PATCH /api/stories/:storyId/nodes/:nodeId` → update `text` and/or `activeChildId`

## Client helpers
`client/interface/api/storyApi.ts` exposes fetch wrappers for all endpoints to ease integration into the React interface.
