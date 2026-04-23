import {
  createRootShareUrl,
  getRootIdFromUrl,
  openRootWithRetry,
  tryOpenRootFromUrl,
} from "../../../vendor/loomsync/packages/core/src/links";
import type {
  LoomWorld,
  LoomWorlds,
} from "../../../vendor/loomsync/packages/core/src/types";
import { createBrowserAutomergeLoomRuntime } from "../../../vendor/loomsync/packages/index/src/browser";
import { upsertRoot } from "../../../vendor/loomsync/packages/index/src/entries";
import {
  createIndexShareUrl,
  getIndexIdFromUrl,
  openIndexWithRetry,
  tryOpenIndexFromUrl,
} from "../../../vendor/loomsync/packages/index/src/links";
import type { LoomIndex } from "../../../vendor/loomsync/packages/index/src/types";
import type { TextPayload } from "../../../vendor/loomsync/packages/text/src/types";

export type StoryRootMeta = { title: string; rootText: string };
export type StoryEntryMeta = { title: string; rootText: string };
export type StoryWorld = LoomWorld<TextPayload, StoryRootMeta>;
export type StoryIndex = LoomIndex<StoryEntryMeta, { app: "loompad" }>;
type StoryRuntime = ReturnType<
  typeof createBrowserAutomergeLoomRuntime<
    TextPayload,
    StoryRootMeta,
    never,
    StoryEntryMeta,
    { app: "loompad" }
  >
>;

let runtime: StoryRuntime | null = null;
let indexPromise: Promise<StoryIndex> | null = null;

const INDEX_STORAGE_KEY = "loompad-loomsync-index-id";

function getStoryRuntime() {
  runtime ??= createBrowserAutomergeLoomRuntime<
    TextPayload,
    StoryRootMeta,
    never,
    StoryEntryMeta,
    { app: "loompad" }
  >({
    browser:
      typeof window === "undefined"
        ? undefined
        : {
            indexedDb: { database: "loompad-loomsync", store: "documents" },
            broadcastChannel: { channelName: "loompad-loomsync" },
            syncPath: "/loomsync",
          },
  });
  return runtime;
}

export function getStoryWorlds(): LoomWorlds<TextPayload, StoryRootMeta> {
  return getStoryRuntime().worlds;
}

export async function getStoryIndex(): Promise<StoryIndex> {
  indexPromise ??= (async () => {
    const storedId =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(INDEX_STORAGE_KEY);
    if (storedId) {
      const opened = await openIndexWithRetry(getStoryRuntime().indexes, storedId).catch(
        () => null,
      );
      if (opened) return opened;
      window.localStorage.removeItem(INDEX_STORAGE_KEY);
    }
    const index = await getStoryRuntime().indexes.createIndex({ app: "loompad" });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INDEX_STORAGE_KEY, index.id);
    }
    return index;
  })();
  return indexPromise;
}

export function getStoryIndexIdFromLocation(location: Location = window.location) {
  return getIndexIdFromUrl(location);
}

export function createStoryIndexShareUrl(
  indexId: string,
  location: Location = window.location,
) {
  return createIndexShareUrl(indexId, location);
}

export async function importStoryIndexFromUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const result = await tryOpenIndexFromUrl(
    getStoryRuntime().indexes,
    window.location,
  );
  if (!result) return null;
  window.localStorage.setItem(INDEX_STORAGE_KEY, result.indexId);
  indexPromise = Promise.resolve(result.index);
  return result.indexId;
}

export async function createStoryWorld(title: string, rootText: string) {
  const storyWorlds = getStoryWorlds();
  const root = await storyWorlds.createRoot({ title, rootText });
  const world = await storyWorlds.openRoot(root.id);
  const index = await getStoryIndex();
  await upsertRoot(index, root.id, {
    title,
    kind: "story",
    meta: { title, rootText },
  });
  return { root, world };
}

export function getStoryRootIdFromLocation(location: Location = window.location) {
  return getRootIdFromUrl(location);
}

export function createStoryShareUrl(
  rootId: string,
  location: Location = window.location,
) {
  return createRootShareUrl(rootId, location);
}

export async function addStoryRootToIndex(
  rootId: string,
  meta: StoryEntryMeta,
): Promise<void> {
  await upsertRoot(await getStoryIndex(), rootId, {
    title: meta.title,
    kind: "story",
    meta,
  });
}

export async function importStoryRootFromUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const result = await tryOpenRootFromUrl(getStoryWorlds(), window.location);
  if (!result) return null;
  const root = await result.world.root();
  await addStoryRootToIndex(result.rootId, {
    title: root.meta?.title ?? "Shared Story",
    rootText: root.meta?.rootText ?? "",
  });
  return result.rootId;
}

export async function listStoryEntries() {
  return (await getStoryIndex()).entries();
}

export async function openStoryWorld(rootId: string): Promise<StoryWorld> {
  return openRootWithRetry(getStoryWorlds(), rootId);
}

export async function removeStory(rootId: string): Promise<void> {
  await (await getStoryIndex()).removeRoot(rootId);
}
