# Persistent Loompad Migration Plan

This is a multi-pass TODO list for evolving the current local-storage-only Loompad PWA into a globally addressable, persistent loom (cursor-in-URL) with server-backed storage and generation. Each pass is meant to be small, shippable, and reversible.

## Pass 0: Baseline + seams
- Map the current tree shape and storage touchpoints:
  - Story data lives in `trees` and a `storyTree` mirror stored via `useLocalStorage("story-trees", DEFAULT_TREES)` inside `useStoryTree`.
  - Story nodes are plain `{ id, text, continuations?, lastSelectedIndex? }` objects; navigation depth + `selectedOptions` determine the active path.
  - Per-story metadata (last active/updated) is also in `localStorage` via `storyMeta` utilities.
- Inventory the server shell (Bun + Express + Vite SSR) and confirm where to add APIs (likely `server/apis` and `server/vite.ts` middleware wiring).
- Capture the “loom window” requirements from `docs/loom-engine-brief.md` as acceptance criteria for later passes.

## Pass 1: Persistent data model + storage adapter
- Choose storage that Bun/Express can talk to easily (SQLite/Postgres via Prisma or a lightweight SQL client; or a KV layer if deploying to edge).
- Define durable schemas:
  - `stories` table: `id (uuid)`, `slug`, `title`, `created_at`, `updated_at`, metadata JSON.
  - `nodes` table: `id (uuid)`, `story_id`, `parent_id`, `choice_index`, `depth`, `content` (text/JSON), `created_at`.
  - Index `(story_id, parent_id, choice_index)` for fast `getOrCreate`.
- Build a storage adapter with pure functions (e.g., `getStoryBySlug`, `listNodes`, `createNode`, `upsertStoryMeta`) to keep Express handlers thin and to enable future swapping (SQL vs KV).
- Add minimal migrations/seed script to create the schema.

## Pass 2: Service layer for generation + retrieval
- Implement `getOrCreateNode(storyId, parentId, choiceIndex)` that:
  - Looks up an existing node by `(storyId, parentId, choiceIndex)`.
  - Calls the existing model/generation pipeline when missing, persists, and returns the new node.
  - Normalizes content to the current `StoryNode` shape (id/text/continuations optional) to minimize client change.
- Add read services for “window” materialization: fetch ancestors-to-root, siblings for each ancestor, favored descendant chain, and nearby siblings per depth.
- Wire logging/metrics around LLM calls to monitor cache hit/miss and latency.

## Pass 3: API surface (server)
- Add REST endpoints under `/api/stories` using the Express server:
  - `GET /api/stories/:slug/nodes/:id/window` → graph slice around cursor.
  - `GET /api/stories/:slug/nodes/:id` → single node fetch.
  - `POST /api/stories/:slug/nodes` → `getOrCreateNode` with `{ parentId, choiceIndex }`.
  - `POST /api/stories` → create/import a story (optionally accept a local JSON export to migrate user data).
- Thread storage adapter into handlers; reuse current request/response helpers if any exist in `server/apis`.
- Add SSR data hydration: when `wouter` matches `/stories/:slug/nodes/:id`, server-render with an initial window payload baked into HTML.

## Pass 4: Client data bridge (from local-only to client/server hybrid)
- Introduce a data facade in the client (e.g., `usePersistentStories`) that:
  - Falls back to current local storage APIs offline but prefers server reads/writes when online.
  - Caches fetched nodes/windows in-memory to preserve the current snappy navigation behavior.
  - Persists per-story metadata to the server (activity, titles) and keeps local cache in sync for offline mode.
- Update `useStoryTree` to load the initial tree from the server by cursor URL, populate `trees` cache, and refresh local metadata with server values.
- Swap generation actions to hit the server’s `POST /nodes` instead of direct client-side generation; keep local optimistic updates so the UI still responds instantly.
- Preserve the existing navigation model (depth + `selectedOptions`) but source nodes from the shared cache, not only local `trees`.

## Pass 5: Addressing + permalink UX
- Enforce URL structure `/stories/:slug/nodes/:id` everywhere (menus, share buttons, SSR) and ensure cursor changes push history updates.
- Add a story selector that lists server stories (ordered by activity) and routes to the latest cursor for that story.
- Implement import/export flows:
  - Import: upload a local JSON tree to create a server story and remap node IDs to server-generated UUIDs.
  - Export: download a window or full story as JSON for offline backups.
- Add “copy link to cursor” and ensure deep links hydrate correctly from SSR payload.

## Pass 6: Prefetching + ISR-style caching
- Add client IntersectionObserver hooks to prefetch descendants/siblings via the new API and stash them in the shared cache.
- Implement server-side caching for window responses (per story/node), with revalidation knobs to match hosting (Edge cache, CDN, or in-proc LRU).
- Add background pre-generation hooks that enqueue `getOrCreateNode` calls when the client signals headroom is low.

## Pass 7: Migration + ops hardening
- Provide a one-time migration that uploads existing local stories to the server (batch POST) and rewrites local storage to point at server IDs.
- Add rate limiting and auth (even a simple API token/session) to protect shared storage.
- Add health checks and basic observability (request logs, error tracker, metrics for generation hit/miss, cache revalidate counts).
- Document rollout steps and recovery: how to clear a bad node, rebuild a story, or reindex the window cache.
