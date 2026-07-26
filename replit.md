# Textile environment note

The canonical product, setup, controls, privacy boundary, and demo are in
[`README.md`](README.md). This file exists only for Replit-specific operation;
it is not a second product specification.

- Install with `bun install --frozen-lockfile`.
- Run development with `bun run dev`; Replit binds through its configured
  proxy, while `PORT=` overrides the local port.
- Build with `bun run build` and start production with `bun run prod`.
- `OPENROUTER_API_KEY` is optional. Without it, archive import, reading,
  curation, sync, and export remain available; generation and judging are
  explicitly disabled.
- A deployed browser sync service should set `TEXTILE_SITE_PASSWORD`. An API
  token gates trusted HTTP/native websocket clients but does not authenticate
  ordinary browser websocket upgrades.

The project is Bun + React/Vite + Express with Lync-backed browser storage and
relay sync. The checked-in provider-free demo starts at
`examples/twitter-archive/README.md`.
