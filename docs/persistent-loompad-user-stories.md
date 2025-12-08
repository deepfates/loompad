# Persistent Loompad TODOs by User Story

This backlog translates the new "infinite book" experience into actionable work that builds on the current local-storage PWA and the migration plan in `docs/persistent-loompad-plan.md`.

## Primary user stories
- **Author publishes an infinitely expandable book**
  - I can publish a story with a stable permalink that anyone can read without my local storage.
  - I can keep writing new branches or depths after publishing; readers see updates without losing existing URLs.
  - I can export backups and restore them if something goes wrong.
- **Reader explores and shares a vantage point**
  - I can open a link to any node, see context (ancestors/siblings/descendants), and copy/share my current vantage point.
  - Navigation feels immediate; scrolling or keypresses never strand me on a loading spinner.
  - I can read offline if I’ve opened the story before.
- **Collaborator seeds or curates**
  - I can import a JSON tree to seed a story and let the engine continue weaving from there.
  - I can pin/curate a favored line so the spine reflects editorial intent.
- **Maintainer operates the system**
  - I can observe generation volume, cache hit rates, and failures.
  - I can clear or rebuild bad nodes and rate-limit abuse.

## TODOs mapped to user stories

### Publishing an infinite book
- Stand up durable storage with schema for stories/nodes (slug, parent, choice index, depth, content, timestamps) and migrations.
- Implement `getOrCreateNode` service that reads/writes storage and normalizes content to the current client `StoryNode` shape.
- Create story import/export endpoints and CLI to move JSON trees between local files and server, remapping node IDs to UUIDs.
- Add story creation endpoint plus minimal auth/owner tag so authorship is tracked (even if unauthenticated is allowed for now).
- Wire SSR/ISR for `/stories/:slug/nodes/:id` pages so published content loads fast and is crawlable.
- Add background revalidation and cache bust controls so newly written branches become visible quickly without stale views.

### Reader sharing and navigation
- Expose REST API to fetch a window around a cursor (ancestors, siblings, favored descendant chain) with pagination/limits.
- Add client data facade that prefers server data but caches windows locally for snappy navigation and offline reads.
- Ensure the gamepad controls update the URL cursor and hydrate correctly on refresh/SSR.
- Implement copy-link UI and ensure deep links restore the same vantage point, including favored line.
- Add prefetch hooks (IntersectionObserver-based) for siblings/descendants to hide latency as the reader moves.

### Offline + resilience
- Keep local cache of fetched windows and metadata; fall back to local generation only when offline.
- Provide a background sync that uploads offline writes when connectivity returns and flags conflicts.
- Offer manual and scheduled exports for author backups; include a restore path that preserves slugs and remaps IDs safely.

### Collaboration and curation
- Support optional per-node metadata for curation (e.g., `pinnedChoiceIndex`, `labels`) and expose it in window responses.
- Allow an editor view to set the favored line from root → leaf and persist it server-side.
- Add import pipeline that validates schema, prunes dangerous content, and enqueues missing generations rather than blocking the UI.

### Operations and safeguards
- Instrument generation and window endpoints with request logs, latency metrics, and cache hit/miss counters.
- Add health checks, minimal auth/rate limiting (API token or session), and abuse caps on generation endpoints.
- Provide maintenance scripts/APIs to quarantine or rebuild a node subtree and to invalidate cached windows.
- Document rollback/recovery: how to restore from backup, rotate keys, or re-run migrations.
