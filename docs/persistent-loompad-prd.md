# Persistent Loompad Spec & PRD

## Context & goals
- **Objective:** Transform Loompad from a local-only PWA into a persistent, URL-addressable loom that renders a multi-node canvas around a cursor, supports infinite expansion, and keeps navigation responsive through predictive generation.
- **Why now:** Current app stores story trees in browser storage and lacks shareable links, durable history, or collaborative access. Persisted storage + addressing unlock publishing, SEO, and multiplayer futures.
- **Success criteria:**
  - Cursor-linked URLs (`/stories/:slug/nodes/:nodeId`) reliably recreate the same vantage point.
  - Server-backed nodes are stable once generated; the UI feels immediate with prefetching and ISR-like caching.
  - Story graphs can grow unbounded while remaining navigable on mobile/desktop gamepad/keyboard controls.

## Scope
- **In scope:**
  - Server data layer for stories/nodes and `getOrCreateNode` LLM-backed generation.
  - API surface to fetch a graph window, individual nodes, and create missing siblings/children.
  - Loom view that SSRs a window and hydrates to an interactive, virtualized grid showing ancestors, cursor, and a favored descendant chain.
  - Predictive prefetch (siblings + descendants) using viewport/headroom heuristics.
  - Offline-aware client that can reconcile local drafts with server state and cache recently viewed nodes.
- **Out of scope (for MVP):**
  - Rich collaboration (presence, locking), moderation tooling, billing.
  - Arbitrary DAG merges; tree structure assumed (optional soft-links can come later).

## Personas & user stories
- **Author/Publisher:** wants to grow an “infinite book,” share deep links, and trust that generated passages persist. Needs quick generation when exploring new branches.
- **Reader/Explorer:** wants to browse without creating an account, load fast from shared links, and move fluidly through branches without stalls.
- **Collaborator (future):** invited editor who can branch/edit; may arrive post-MVP.

Representative stories (superset of existing backlog):
- Shareable vantage: “As a reader, when I open `/stories/loom/nodes/abc`, I see the same node, its ancestors, and a highlighted forward path.”
- Predictive smoothness: “As I near the bottom/right edge, new nodes appear without waiting for a spinner.”
- Durable publishing: “As an author, once a node exists, it never changes its ID/URL and loads fast later.”
- Offline resilience: “If I lose connection mid-read, I can still scroll the already-loaded window; when back online, generation resumes.”
- Safety rails: “Generation requests are bounded (rate/size) so the service stays healthy.”

## Functional requirements
1. **Addressing & routing**
   - Routes: `/stories/:slug/nodes/:nodeId` SSRs initial window; `/api/stories/:slug/nodes/:id` returns a node; `/api/stories/:slug/nodes/:id/window` returns the loom slice; `/api/stories/:slug/nodes` (POST) creates/fetches a child/sibling via `getOrCreateNode`.
   - URL is the source of truth for cursor; client state mirrors it.

2. **Graph window computation**
   - Include ancestors to root, cursor node, favored descendant chain (one child per depth), and lateral siblings near each displayed node.
   - Support configurable depth/lateral span (e.g., `depthAbove`, `depthBelow`, `siblingRadius`).
   - Window response includes enough metadata to re-derive favored path client-side.

3. **Generation & storage**
   - `getOrCreateNode(storyId, parentId, choiceIndex)` checks storage first; on miss, invokes LLM with prompt context (story metadata + ancestor text) and persists the result.
   - Nodes are immutable once created; store timestamps and choice ordering.
   - Storage backend: pick pragmatic default (e.g., SQLite/Postgres via Prisma) but hide behind an interface for future KV/edge swaps.

4. **Client loom view**
   - React loom component renders vertical depths with horizontal siblings; highlight favored spine.
   - Keyboard/gamepad/click/touch navigation updates cursor and Wouter location; view reflows without full reload.
   - Virtualization to keep DOM light; animations optional but avoid jank.

5. **Prefetch & headroom**
   - Descendant prefetch: when favored line’s deepest rendered node is within a threshold of viewport bottom, request next depth (optionally multiple steps).
   - Sibling prefetch: when selection/hover nears lateral edge, request next sibling indices.
   - Prefetch uses same APIs; generation happens server-side.

6. **Offline & caching**
   - Cache recent nodes/window responses (IndexDB/service worker) for quick back/forward.
   - Retry generation/fetch when connectivity returns; display optimistic placeholders while pending.
   - Enable ISR-like caching on SSR HTML where hosting allows; otherwise cache API responses with ETags and short TTLs.

7. **Observability & safeguards**
   - Log generation events, cache hits/misses, prefetch triggers, and navigation actions.
   - Enforce rate limits per story/user/IP for generation endpoints; cap prompt size by trimming ancestor context.
   - Basic health checks for data store and model provider.

## Non-functional requirements
- **Performance:** Initial SSR of window ≤ 2s on cold cache; client interactions render <16ms per frame; generation latency hidden by prefetch when possible.
- **Stability:** No mutation of existing node content/IDs; migrations keep data shape stable.
- **Security:** Input sanitization on story/node titles; authenticated writes for author actions when accounts arrive; safe model prompts.
- **Compatibility:** Preserve current PWA shell and theming; keep bundle size reasonable by reusing srcl primitives.

## Architecture & system design
- **Server runtime:** Keep Bun/Express/Vite SSR entry (`run.ts`, `server/ssr.tsx`). Add API routes under `server/routes` or equivalent, mounted in existing Express app.
- **Data layer:** Introduce persistence module (e.g., `server/data/stories.ts`, `server/data/nodes.ts`) using Prisma or lightweight SQL client. Provide interfaces for `getStoryBySlug`, `getNodeById`, `getChildrenByParent`, and `createNode`.
- **Generation service:** `server/services/generation.ts` exports `getOrCreateNode`, wired to current model provider conventions (OpenRouter, env-based config).
- **API handlers:**
  - `GET /api/stories/:slug/nodes/:id` → node fetch
  - `GET /api/stories/:slug/nodes/:id/window` → window slice (ancestors + siblings + favored descendants)
  - `POST /api/stories/:slug/nodes` → `{ storyId, parentId, choiceIndex }`
- **Client bridge:** Add `shared/types/story.ts` and fetch helpers in `client/shared/api.ts`. SSR passes initial window as props/hydration payload.
- **Loom view:** New route component under `client/interface/pages/story-node.tsx` (or similar) that consumes initial window, keeps graph slice in context/state, and renders via virtualization.
- **Prefetch hooks:** `usePrefetchDescendants`, `usePrefetchSiblings` hooks in `client/interface/hooks/` using IntersectionObserver and navigation state.
- **Caching layer:** Optional in-memory LRU on server for hot nodes; client-side cache keyed by node IDs; ISR/ETag headers on responses.

## Data contracts
- **Node payload:** `{ id, storyId, parentId, depth, choiceIndex, title?, content, metadata, createdAt }`
- **Window payload:** `{ story, cursorId, ancestors: Node[], cursor: Node, favoredDescendants: Node[], siblingMap: Record<nodeId, Node[]> , depthAbove, depthBelow, siblingRadius }`
- **Generation request:** `{ storyId, parentId, choiceIndex, promptContext? }` → returns `{ node, created: boolean }`

## UX & interaction notes
- **Layout:** Grid-like loom with depth on Y-axis, siblings on X-axis. Favored spine styled distinctly. Cursor node shows focus ring; ancestors visually connected.
- **Controls:** Up/down to move along favored path; left/right to change sibling at current depth; enter/tap to follow favored child. URL updates on cursor change.
- **Loading states:** Skeleton cells for prefetching; minimal spinners only when generation is unavoidable. Errors surface inline with retry.
- **Accessibility:** Keyboard reachable nodes, ARIA labels for navigation, ensure focus order matches visual cursor.

## Rollout plan
1. **Data & APIs:** Implement persistence, `getOrCreateNode`, and node/window endpoints with tests.
2. **SSR bridge:** Wire `/stories/:slug/nodes/:nodeId` page to fetch window server-side, hydrate on client, and keep Wouter routing stable.
3. **Loom UI:** Build virtualized loom view with cursor navigation and favored spine rendering.
4. **Prefetch:** Add observer-driven prefetch hooks and server-side safeguards (rate limits, prompt caps).
5. **Offline/cache:** Layer client cache + retry; add ISR/ETag headers; document hosting knobs.
6. **Polish:** Telemetry, error states, doc updates, and authoring safeguards.

## Risks & mitigations
- **LLM latency or cost spikes:** Prefetch aggressively; batch generation when possible; add server-side throttles.
- **Schema churn:** Version Node payloads; keep migrations additive; adapter layer to allow KV swap.
- **Navigation jank:** Use virtualization and memoized layout calculations; avoid full rerenders on cursor moves.
- **Cache incoherence:** Use immutable nodes and content hashing; prefer cache-aside reads with clear invalidation rules (mainly for story metadata changes).

## Acceptance checklist
- URLs recreate the same vantage and render within budget on cold cache.
- Generating new branches never mutates existing nodes; IDs remain stable.
- Moving to edges triggers prefetch such that navigation rarely waits on generation.
- Offline mode preserves already-fetched nodes and resumes gracefully when back online.
- Metrics exist for generation hit/miss, navigation, and prefetch coverage.
