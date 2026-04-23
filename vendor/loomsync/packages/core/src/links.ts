import type { LoomRootId, LoomWorld, LoomWorlds } from "./types.js";

export interface RootUrlOptions {
  rootParam?: string;
  legacyRootParam?: string;
}

export function getRootIdFromUrl(
  location: Location | URL,
  options: RootUrlOptions = {},
): LoomRootId | null {
  const rootParam = options.rootParam ?? "story";
  const legacyRootParam = options.legacyRootParam ?? "root";
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get(rootParam) ?? params.get(legacyRootParam);
  if (fromQuery) return fromQuery;

  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  const hashParams = new URLSearchParams(
    hash.includes("=") ? hash : `${rootParam}=${hash}`,
  );
  return hashParams.get(rootParam) ?? hashParams.get(legacyRootParam);
}

export function createRootShareUrl(
  rootId: LoomRootId,
  location: Location | URL,
  options: RootUrlOptions = {},
) {
  const rootParam = options.rootParam ?? "story";
  const legacyRootParam = options.legacyRootParam ?? "root";
  const url = new URL(location.href);
  url.searchParams.delete(legacyRootParam);
  url.searchParams.set(rootParam, rootId);
  url.hash = "";
  return url.toString();
}

export interface OpenWithRetryOptions {
  attempts?: number;
  delayMs?: number;
}

export async function openRootWithRetry<TPayload, TRootMeta, TNodeMeta>(
  worlds: LoomWorlds<TPayload, TRootMeta, TNodeMeta>,
  rootId: LoomRootId,
  options: OpenWithRetryOptions = {},
): Promise<LoomWorld<TPayload, TRootMeta, TNodeMeta>> {
  const attempts = options.attempts ?? 8;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await worlds.openRoot(rootId);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await delay(delayMs);
    }
  }

  throw lastError;
}

export async function tryOpenRootWithRetry<TPayload, TRootMeta, TNodeMeta>(
  worlds: LoomWorlds<TPayload, TRootMeta, TNodeMeta>,
  rootId: LoomRootId,
  options: OpenWithRetryOptions = {},
): Promise<LoomWorld<TPayload, TRootMeta, TNodeMeta> | null> {
  try {
    return await openRootWithRetry(worlds, rootId, options);
  } catch {
    return null;
  }
}

export interface TryOpenRootFromUrlOptions
  extends RootUrlOptions,
    OpenWithRetryOptions {}

export async function tryOpenRootFromUrl<TPayload, TRootMeta, TNodeMeta>(
  worlds: LoomWorlds<TPayload, TRootMeta, TNodeMeta>,
  location: Location | URL,
  options: TryOpenRootFromUrlOptions = {},
): Promise<
  | {
      rootId: LoomRootId;
      world: LoomWorld<TPayload, TRootMeta, TNodeMeta>;
    }
  | null
> {
  const rootId = getRootIdFromUrl(location, options);
  if (!rootId) return null;
  const world = await tryOpenRootWithRetry(worlds, rootId, options);
  return world ? { rootId, world } : null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
