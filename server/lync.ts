import type http from "http";
import {
  attachLyncServer as attachLyncRelay,
  type AttachLyncServerOptions,
} from "@deepfates/lync/relay";
import { hasProtectedSyncAccess } from "./siteAuth";
import { resolveLyncStorageDir } from "./runtimeData";

let attached = false;
let relay: ReturnType<typeof attachLyncRelay> | null = null;
const DEFAULT_LYNC_KEEPALIVE_INTERVAL_MS = 30_000;
type LyncAuthMode = "site-access" | "public";

function parsePositiveInt(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolveLyncAuthMode(value = process.env.LYNC_AUTH_MODE): LyncAuthMode {
  return value?.trim().toLowerCase() === "public" ? "public" : "site-access";
}

export function attachLyncServer(server: http.Server) {
  if (attached) return relay;
  attached = true;
  const authMode = resolveLyncAuthMode();
  const options: AttachLyncServerOptions = {
    path: "/lync",
    storageDir: resolveLyncStorageDir(),
    keepAliveInterval:
      parsePositiveInt(process.env.LYNC_KEEPALIVE_INTERVAL_MS) ??
      DEFAULT_LYNC_KEEPALIVE_INTERVAL_MS,
    maxConnections: parsePositiveInt(process.env.LYNC_MAX_CONNECTIONS),
    authenticate: authMode === "public" ? undefined : hasProtectedSyncAccess,
  };
  relay = attachLyncRelay(server, options);
  console.log(`[Lync] relay auth mode: ${authMode}`);
  console.log(`[Lync] relay storage: ${options.storageDir}`);
  // Connection lifecycle and errors are logged by the relay via its `log`
  // option; the relay owns its WebSocket server internally.
  return relay;
}

export async function closeLyncServer() {
  if (!relay) return;
  await relay.close();
  relay = null;
  attached = false;
}
