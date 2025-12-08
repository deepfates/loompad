# Loom Engine Variant Design Brief

## Purpose
This brief translates the multi-node "loom" explorer concept into Loompad's current stack so a coding agent with repository access can ship a minimum viable version. It stays aligned with the existing Bun + Express + Vite server, React client, Wouter routing, and srcl/styled-components UI layer already wired up for SSR and the PWA shell.

## What we are building
- **Multi-node canvas:** Always render a window of the story graph: the cursor node, its ancestors back to the root, and a "favored" descendant path from the cursor toward a leaf.
- **Cursor-synced URL:** The URL encodes `{storySlug}/{nodeId}`; everything else (ancestors, favored path, siblings) is derived relative to that cursor.
- **Live navigation:** Keyboard/gamepad moves the cursor up/down the spine or across siblings; the view reflows to show the new window while updating the URL.
- **Predictive generation:** As the viewport approaches edges, fetch or generate additional siblings and descendants so navigation feels instantaneous.
- **ISR-style persistence:** Nodes generated on-demand are cached (DB/KV) so subsequent fetches serve quickly without re-prompting the model.

## Why this structure
- Loompad's UX centers on seeing branch context, not just a single passage, so the layout must show siblings and depth-wise ancestry/descendency simultaneously.
- Cursor-in-URL enables permalinks and deep links; the rest of the loom derives from that vantage point.
- Lazy generation plus caching matches the current ISR-friendly server: expensive work happens once, and cached HTML/data can be reused.
- Predictive loading keeps the experience responsive and hides LLM latency as users scroll or move focus.

## How it fits the current stack
- **Server/runtime:** Keep using the existing Bun entry (`run.ts`) that bootstraps the Express/Vite server for SSR and static assets; extend HTTP routes under `/api` alongside current generation/model endpoints.
- **Routing:** Continue with Wouter (already used for SSR) to map `/stories/:slug/nodes/:nodeId` to the loom view.
- **UI layer:** Build the loom view as a React component tree under `client/interface`, using srcl primitives plus custom layout CSS for the grid-like loom window.
- **SSR/ISR:** Reuse the existing SSR path (`server/ssr.tsx` and Vite middleware) to server-render an initial window around the requested cursor. Cache responses or enable ISR-like regeneration where supported by hosting.

## Data model sketch
- **Story**: `{ id, slug, title, metadata }`
- **Node**: `{ id, storyId, parentId | null, depth, choiceIndex, content, createdAt }`
- **Edges/children**: store as an array on the node record or a separate `edges` table keyed by `(storyId, parentId, choiceIndex)`.
- **Favored path state**: tracked client-side as the preferred child per depth; persisted optionally for sharing or deterministic reloads.

## API surface (incremental targets)
1. `GET /api/stories/:slug/nodes/:id/window` → returns ancestors to root, siblings near each ancestor/descendant, and a favored descendant chain from the cursor.
2. `POST /api/stories/:slug/nodes` with `{ parentId, choiceIndex }` → `getOrCreateNode` flow: check storage, LLM-generate if missing, persist, and return.
3. `GET /api/stories/:slug/nodes/:id` → fetch a single node by ID (cached path for reloads/permalinks).

## Client behavior
- Maintain an in-memory graph slice around the cursor (ancestors, siblings at each depth, favored descendants).
- Render as a vertical stack of depths with horizontal sibling rows; highlight the favored line.
- Cursor movements (keyboard/gamepad/click) update Wouter location + state; the component re-derives the loom slice from cached data or API responses.
- IntersectionObserver hooks prefetch:
  - **Descendants** when the favored line's deepest node is near the viewport bottom.
  - **Siblings** when the user hovers/selects near the lateral edge of known siblings.

## Generation & caching flow
1. Client requests a node (or window slice) via `/api`.
2. Server handler runs `getOrCreateNode(storyId, parentId, choiceIndex)`:
   - If the node exists in storage, return it immediately.
   - Otherwise, call the configured model provider (OpenRouter, matching current generation endpoint patterns) with parent/context, persist the new node, and return it.
3. Responses are cacheable; subsequent requests reuse stored nodes. ISR-friendly HTML routes can wrap this data to accelerate popular entry points.

## Delivery milestones for an agent
1. **Routes & data plumbing**: Add story/node storage layer, implement `getOrCreateNode`, and expose the window + node endpoints.
2. **Loom view**: New page under `/stories/:slug/nodes/:id` that SSRs an initial window and hydrates to an interactive, virtualized grid.
3. **Navigation & prefetch**: Keyboard/gamepad bindings to move cursor; sibling/descendant preloading hooks to hide generation latency.
4. **Caching & persistence**: Configure storage (SQLite/Postgres/kv) and response caching/ISR per deployment target; ensure URLs remain stable once nodes exist.
