# Textile operations

This runbook is for maintainers and deployment operators. Product use begins in
the [README](../README.md); data contracts live under
[`docs/reference/`](reference/raw-lync.md).

## Local development

Textile requires Bun 1.2.18 in CI; `.bun-version` records the same version.

```sh
bun install --frozen-lockfile
bun run dev
```

The development server listens on `localhost:5173` on macOS and
`localhost:5000` elsewhere. `PORT` overrides that choice. Replit proxy markers
select the non-macOS default and secure HMR settings.

`OPENROUTER_API_KEY` is optional. Without it, development uses a placeholder so
the UI can start; live generation fails clearly, while import, reading,
curation, sync, and export remain available.

## Verification

```sh
bun run verify       # lint, unit/integration tests, production build
bun run test:e2e     # Playwright Chromium browser suite
```

The opt-in indexed projector scale test is intentionally outside the ordinary
gate:

```sh
TEXTILE_SCALE_TEST=1 bun test client/interface/lync/__tests__/indexedRawLync.scale.test.ts
```

The cross-repository corpus rehearsal and its sibling-checkout requirements are
documented in the [raw Lync reference](reference/raw-lync.md#cross-repository-rehearsal).

## Production

```sh
bun run build
bun run prod
```

Production protected endpoints require at least one access gate. A private
browser deployment specifically requires `TEXTILE_SITE_PASSWORD`:

- `TEXTILE_SITE_PASSWORD` authenticates browser users with a signed session
  cookie and protects the app shell, APIs, service worker, and normal browser
  websocket sync.
- `TEXTILE_API_AUTH_TOKEN` authenticates trusted HTTP clients as either
  `Authorization: Bearer <token>` or `x-api-key`. Native `/lync` websocket
  clients can send it too. Ordinary browser websocket upgrades cannot attach
  either header. Without a site password, the app shell itself is ungated and
  browser sync is rejected, so an API-token-only configuration is not a private
  browser deployment.

With neither gate, the app shell is ungated, protected production APIs return
503, and durable browser sync is rejected. That configuration is not a
supported deployment. Even with site auth, the declared PWA manifest and icons
remain public so the protected application can be discovered and installed;
the service worker and app shell remain gated.

`TEXTILE_SITE_AUTH_SECRET` overrides the key used to sign the site session. Set
it independently when password or token rotation should not invalidate or
re-key sessions implicitly.

## Relay and persistent state

The `/lync` websocket is a persistent Lync relay. Its default auth mode is
`site-access`, and its heartbeat interval defaults to 30 seconds.

Set `LYNC_AUTH_MODE=public` only when the deployment is intentionally a public
relay for native Lync websocket clients. This does not make protected HTTP
generation or model-mutation APIs public.

Mutable runtime state belongs under `TEXTILE_DATA_DIR`, default `.data`:

- `lync/` holds relay history;
- `models.json` holds the editable model catalog.

`server/data/models.json` is immutable seed data copied into the mutable catalog
on first boot. A corrupt mutable catalog fails visibly rather than being
overwritten. Hosts with ephemeral filesystems must mount `TEXTILE_DATA_DIR` on
persistent storage or relay history and model edits will disappear on restart.

Narrow runtime overrides are available as `LYNC_STORAGE_DIR` and
`TEXTILE_MODELS_FILE`. Prefer one durable `TEXTILE_DATA_DIR` mount unless there
is an explicit operational reason to split them. Server-side `.lore` intake is
separate: `LYNC_LORE_DIR` defaults to `.data/lync-lore` relative to the process
working directory and does not follow a custom `TEXTILE_DATA_DIR`.

For Render, mount persistent storage at `/opt/render/project/src/.data`, keep
`LYNC_AUTH_MODE=site-access` for a private browser deployment, and use:

```sh
bun install --frozen-lockfile && bun run verify
```

as the build command so deployment cannot bypass the repository gate.

## Configuration reference

| Variable | Meaning and default |
| --- | --- |
| `PORT` | HTTP port; 5173 on local macOS, otherwise 5000 |
| `OPENROUTER_API_KEY` | Enables generation and judging |
| `TEXTILE_SITE_PASSWORD` | Browser access gate |
| `TEXTILE_SITE_AUTH_SECRET` | Session-signing secret |
| `TEXTILE_API_AUTH_TOKEN` | Trusted API/native websocket token |
| `TEXTILE_DATA_DIR` | Mutable data root; `.data` |
| `LYNC_STORAGE_DIR` | Relay history override |
| `TEXTILE_MODELS_FILE` | Mutable model catalog override |
| `LYNC_LORE_DIR` | Server-side `.lore` intake; `.data/lync-lore` |
| `LYNC_AUTH_MODE` | `site-access` or explicit `public`; `site-access` |
| `LYNC_KEEPALIVE_INTERVAL_MS` | Positive relay heartbeat interval; 30000 |
| `LYNC_MAX_CONNECTIONS` | Optional positive relay connection cap |
| `CORS_ALLOWED_ORIGINS` | Comma-separated API origin allowlist; unset is permissive |
| `TEXTILE_RATE_LIMIT_WINDOW_MS` | Protected endpoint window; 60000 |
| `TEXTILE_RATE_LIMIT_MAX_REQUESTS` | Requests per protected endpoint/IP window; 30 |
| `TEXTILE_TRUST_PROXY_HOPS` | Trusted proxy hop count; 0 in development, 1 in production |

Rate limiting is process-local and covers generation, judging, and model
mutation endpoints. Configure a bounded proxy hop count for the actual hosting
topology so client IPs cannot be spoofed through forwarded headers.
