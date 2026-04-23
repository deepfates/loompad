import {
  createAutomergeLoomWorlds,
} from "../../../vendor/loomsync/packages/core/src/automerge";
import {
  createBrowserAutomergeRepo,
} from "../../../vendor/loomsync/packages/core/src/browser";
import {
  createAutomergeLoomIndexes,
} from "../../../vendor/loomsync/packages/index/src/automerge";
import type {
  LoomWorld,
  LoomWorlds,
} from "../../../vendor/loomsync/packages/core/src/types";
import type {
  LoomIndex,
} from "../../../vendor/loomsync/packages/index/src/types";
import type { TextPayload } from "../../../vendor/loomsync/packages/text/src/types";
import { Repo } from "@automerge/automerge-repo";

export type StoryRootMeta = { title: string; rootText: string };
export type StoryEntryMeta = { title: string; rootText: string };
export type StoryWorld = LoomWorld<TextPayload, StoryRootMeta>;

let worlds: LoomWorlds<TextPayload, StoryRootMeta> | null = null;
let indexes: ReturnType<
  typeof createAutomergeLoomIndexes<StoryEntryMeta, { app: "loompad" }>
> | null = null;
let indexPromise: Promise<LoomIndex<StoryEntryMeta, { app: "loompad" }>> | null =
  null;

const INDEX_STORAGE_KEY = "loompad-loomsync-index-id";

function createRepo() {
  if (typeof window === "undefined") return new Repo();
  return createBrowserAutomergeRepo({
    indexedDb: { database: "loompad-loomsync", store: "documents" },
    broadcastChannel: { channelName: "loompad-loomsync" },
  });
}

const repo = createRepo();

export function getStoryWorlds(): LoomWorlds<TextPayload, StoryRootMeta> {
  worlds ??= createAutomergeLoomWorlds<TextPayload, StoryRootMeta>({ repo });
  return worlds;
}

function getStoryIndexes() {
  indexes ??= createAutomergeLoomIndexes<StoryEntryMeta, { app: "loompad" }>({
    repo,
  });
  return indexes;
}

export async function getStoryIndex(): Promise<
  LoomIndex<StoryEntryMeta, { app: "loompad" }>
> {
  indexPromise ??= (async () => {
    const storedId =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(INDEX_STORAGE_KEY);
    if (storedId) {
      try {
        return await getStoryIndexes().openIndex(storedId);
      } catch {
        window.localStorage.removeItem(INDEX_STORAGE_KEY);
      }
    }
    const index = await getStoryIndexes().createIndex({ app: "loompad" });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INDEX_STORAGE_KEY, index.id);
    }
    return index;
  })();
  return indexPromise;
}

export async function createStoryWorld(title: string, rootText: string) {
  const storyWorlds = getStoryWorlds();
  const root = await storyWorlds.createRoot({ title, rootText });
  const world = await storyWorlds.openRoot(root.id);
  const index = await getStoryIndex();
  await index.addRoot(root.id, {
    title,
    kind: "story",
    meta: { title, rootText },
  });
  return { root, world };
}

export async function listStoryEntries() {
  return (await getStoryIndex()).entries();
}

export async function openStoryWorld(rootId: string): Promise<StoryWorld> {
  return getStoryWorlds().openRoot(rootId);
}

export async function removeStory(rootId: string): Promise<void> {
  await (await getStoryIndex()).removeRoot(rootId);
}
