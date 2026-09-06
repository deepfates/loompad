# Textile on Replit

The product and demo are in [`README.md`](README.md); production access,
persistence, and environment variables are in
[`docs/operations.md`](docs/operations.md). This file contains only the Replit
differences.

- Install with `bun install --frozen-lockfile`.
- Run development with `bun run dev`; Replit binds through its configured
  proxy and uses secure HMR settings, while `PORT=` overrides the local port.
- Build with `bun run build` and start production with `bun run prod`.

The checked-in provider-free demo starts at
`examples/twitter-archive/README.md`.
