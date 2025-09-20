/**
 * Story meta utilities
 *
 * Purpose:
 * - Track per-story metadata (createdAt, updatedAt, lastActiveAt, openCount)
 * - Provide reverse-chronological ordering helpers for story lists
 * - Provide a sensible default story to open (most recently active)
 *
 * Storage:
 * - Data is persisted to localStorage under META_STORAGE_KEY
 * - APIs degrade gracefully during SSR (no window); writes are no-ops
 */

const META_STORAGE_KEY = "story-meta-v1";

export type ISODateString = string;

export interface StoryMeta {
  key: string;
  createdAt: ISODateString; // when the story key first appeared
  updatedAt?: ISODateString; // when content changed (generation/edit)
  lastActiveAt?: ISODateString; // when user last focused/opened this story
  openCount?: number; // number of times opened/focused
}

export type StoryMetaMap = Record<string, StoryMeta>;

// Guarded window access for SSR
const hasWindow = typeof window !== "undefined" && !!window.localStorage;

const nowISO = (): ISODateString => new Date().toISOString();

function safeLoad(): StoryMetaMap {
  if (!hasWindow) return {};
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as StoryMetaMap;
    }
  } catch {
    // ignore
  }
  return {};
}

function safeSave(meta: StoryMetaMap): void {
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

function getOrInitMeta(
  meta: StoryMetaMap,
  key: string,
  createdAt?: ISODateString,
): StoryMeta {
  if (!meta[key]) {
    meta[key] = {
      key,
      createdAt: createdAt ?? nowISO(),
      openCount: 0,
    };
  }
  return meta[key];
}

/**
 * Ensure meta exists for every story in the given map and remove stale meta for deleted stories.
 * Optionally persists changes immediately.
 */
export function ensureMetaForTrees(
  trees: Record<string, unknown>,
  { persist = true }: { persist?: boolean } = {},
): StoryMetaMap {
  const meta = safeLoad();
  const keys = Object.keys(trees ?? {});

  // Create defaults for new keys
  const seen = new Set<string>();
  const createdAt = nowISO();
  for (const key of keys) {
    seen.add(key);
    getOrInitMeta(meta, key, createdAt);
  }

  // Prune meta for deleted keys
  for (const key of Object.keys(meta)) {
    if (!seen.has(key)) {
      delete meta[key];
    }
  }

  if (persist) safeSave(meta);
  return meta;
}

/**
 * Mark a story as "active" (e.g., user opened or switched to it).
 * Updates lastActiveAt and increments openCount.
 */
export function touchStoryActive(key: string): StoryMeta {
  const meta = safeLoad();
  const entry = getOrInitMeta(meta, key);
  entry.lastActiveAt = nowISO();
  entry.openCount = (entry.openCount ?? 0) + 1;
  safeSave(meta);
  return entry;
}

/**
 * Mark a story as "updated" (e.g., generation/edit saved).
 * Updates updatedAt. Optionally also update lastActiveAt if desired.
 */
export function touchStoryUpdated(
  key: string,
  { alsoActive = false }: { alsoActive?: boolean } = {},
): StoryMeta {
  const meta = safeLoad();
  const entry = getOrInitMeta(meta, key);
  const t = nowISO();
  entry.updatedAt = t;
  if (alsoActive) {
    entry.lastActiveAt = t;
    entry.openCount = (entry.openCount ?? 0) + 1;
  }
  safeSave(meta);
  return entry;
}

/**
 * Get a metadata snapshot without mutating storage.
 */
export function getStoryMeta(): StoryMetaMap {
  return safeLoad();
}

/**
 * Replace and persist metadata in storage.
 */
export function setStoryMeta(meta: StoryMetaMap): void {
  safeSave(meta);
}

/**
 * Sort story keys by recency:
 * - Primary: lastActiveAt desc
 * - Fallback: updatedAt desc
 * - Fallback: createdAt desc
 * - Stable tie-breaker: key asc
 */
export function orderKeysReverseChronological(
  trees: Record<string, unknown>,
  metaMap?: StoryMetaMap,
): string[] {
  const keys = Object.keys(trees ?? {});
  if (keys.length <= 1) return keys;

  const meta = metaMap ?? ensureMetaForTrees(trees, { persist: false });

  const score = (key: string): [string, string, string] => {
    const m = meta[key];
    const a = m?.lastActiveAt ?? "";
    const u = m?.updatedAt ?? "";
    const c = m?.createdAt ?? "";
    return [a, u, c];
  };

  // ISO strings sort lexicographically by chronology.
  return keys.slice().sort((ka, kb) => {
    const [aA, aU, aC] = score(ka);
    const [bA, bU, bC] = score(kb);

    if (aA !== bA) return bA.localeCompare(aA); // lastActiveAt desc
    if (aU !== bU) return bU.localeCompare(aU); // updatedAt desc
    if (aC !== bC) return bC.localeCompare(aC); // createdAt desc
    return ka.localeCompare(kb); // stable deterministic order
  });
}

/**
 * Return [key, tree] entries sorted reverse-chronologically.
 */
export function sortTreeEntriesByRecency<T extends Record<string, unknown>>(
  trees: T,
  metaMap?: StoryMetaMap,
): Array<[string, T[keyof T]]> {
  const ordered = orderKeysReverseChronological(trees, metaMap);
  return ordered.map((k) => [k, trees[k]] as [string, T[keyof T]]);
}

/**
 * Choose a default story to open:
 * - Prefer most recently active
 * - Else most recently updated
 * - Else most recently created
 * - Else null when there are no stories
 */
export function getDefaultStoryKey(
  trees: Record<string, unknown>,
  metaMap?: StoryMetaMap,
): string | null {
  const keys = orderKeysReverseChronological(trees, metaMap);
  return keys[0] ?? null;
}

/**
 * Utility: mark a story as selected/opened and get an updated reverse-chronological list of keys.
 */
export function selectStoryAndOrder(
  trees: Record<string, unknown>,
  key: string,
): string[] {
  touchStoryActive(key);
  return orderKeysReverseChronological(trees);
}
