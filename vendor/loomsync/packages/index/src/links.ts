import type { LoomIndex, LoomIndexes } from "./types.js";

export interface IndexUrlOptions {
  indexParam?: string;
  legacyIndexParam?: string;
  rootParams?: string[];
}

export function getIndexIdFromUrl(
  location: Location | URL,
  options: IndexUrlOptions = {},
): string | null {
  const indexParam = options.indexParam ?? "index";
  const legacyIndexParam = options.legacyIndexParam ?? "worlds";
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get(indexParam) ?? params.get(legacyIndexParam);
  if (fromQuery) return fromQuery;

  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  const hashParams = new URLSearchParams(hash.includes("=") ? hash : "");
  return hashParams.get(indexParam) ?? hashParams.get(legacyIndexParam);
}

export function createIndexShareUrl(
  indexId: string,
  location: Location | URL,
  options: IndexUrlOptions = {},
) {
  const indexParam = options.indexParam ?? "index";
  const legacyIndexParam = options.legacyIndexParam ?? "worlds";
  const rootParams = options.rootParams ?? ["story", "root"];
  const url = new URL(location.href);
  for (const param of rootParams) url.searchParams.delete(param);
  url.searchParams.delete(legacyIndexParam);
  url.searchParams.set(indexParam, indexId);
  url.hash = "";
  return url.toString();
}

export interface OpenIndexWithRetryOptions {
  attempts?: number;
  delayMs?: number;
}

export async function openIndexWithRetry<TEntryMeta, TIndexMeta>(
  indexes: LoomIndexes<TEntryMeta, TIndexMeta>,
  indexId: string,
  options: OpenIndexWithRetryOptions = {},
): Promise<LoomIndex<TEntryMeta, TIndexMeta>> {
  const attempts = options.attempts ?? 8;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await indexes.openIndex(indexId);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await delay(delayMs);
    }
  }

  throw lastError;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
