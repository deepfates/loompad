import {
  referenceFromUrl,
  referenceToUrl,
  type Looms,
  type TurnId,
} from "../../../vendor/lync/packages/core/src/index";
import { createBrowserLoomClient } from "../../../vendor/lync/packages/client/src/browser";
import { upsertLoom } from "../../../vendor/lync/packages/index/src/entries";
import type { LoomIndex } from "../../../vendor/lync/packages/index/src/types";
import type { TextPayload } from "../../../vendor/lync/packages/text/src/types";
import type {
  StoryEntryMeta,
  StoryLoom,
  StoryLoomMeta,
  StoryTurnMeta,
} from "./storyTypes";

export type { StoryEntryMeta, StoryLoom, StoryLoomMeta } from "./storyTypes";
export type StoryIndex = LoomIndex<StoryEntryMeta, { app: "textile" }>;
export type StoryReferenceImport =
  | { kind: "index"; indexId: string }
  | { kind: "loom" | "turn" | "thread"; loomId: string; turnId?: TurnId };

type StoryClient = ReturnType<
  typeof createBrowserLoomClient<
    TextPayload,
    StoryLoomMeta,
    StoryTurnMeta,
    StoryEntryMeta,
    { app: "textile" }
  >
>;

let client: StoryClient | null = null;
let indexPromise: Promise<StoryIndex> | null = null;

const INDEX_STORAGE_KEY = "textile-lync-v1-index-id";
const STORAGE_NAMESPACE = "textile-lync-v1";

function getStoryClient() {
  client ??= createBrowserLoomClient<
    TextPayload,
    StoryLoomMeta,
    StoryTurnMeta,
    StoryEntryMeta,
    { app: "textile" }
  >({
    browser:
      typeof window === "undefined"
        ? undefined
        : {
            indexedDb: { database: STORAGE_NAMESPACE, store: "documents" },
            broadcastChannel: { channelName: STORAGE_NAMESPACE },
            syncPath: "/lync",
          },
  });
  return client;
}

export function getStoryLooms(): Looms<TextPayload, StoryLoomMeta, StoryTurnMeta> {
  return getStoryClient().looms;
}

export async function getStoryIndex(): Promise<StoryIndex> {
  indexPromise ??= (async () => {
    const storedId =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(INDEX_STORAGE_KEY);
    if (storedId) {
      const opened = await openIndexWithRetry(storedId).catch(() => null);
      if (opened) return opened;
      window.localStorage.removeItem(INDEX_STORAGE_KEY);
    }
    const index = await getStoryClient().indexes.create({ app: "textile" });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INDEX_STORAGE_KEY, index.id);
    }
    return index;
  })();
  return indexPromise;
}

export function createStoryIndexShareUrl(
  indexId: string,
  location: Location = window.location,
) {
  return referenceToUrl(getStoryClient().references.index(indexId), location);
}

export function createStoryShareUrl(
  loomId: string,
  location: Location = window.location,
) {
  return referenceToUrl(getStoryClient().references.loom(loomId), location);
}

export function createStoryThreadShareUrl(
  loomId: string,
  turnId: string,
  location: Location = window.location,
) {
  return referenceToUrl(getStoryClient().references.thread(loomId, turnId), location);
}

export function createStoryFocusShareUrl(
  loomId: string,
  turnId: string | null,
  location: Location = window.location,
) {
  return turnId
    ? createStoryThreadShareUrl(loomId, turnId, location)
    : createStoryShareUrl(loomId, location);
}

export function replaceStoryFocusUrl(
  loomId: string,
  turnId: string | null,
  location: Location = window.location,
) {
  if (typeof window === "undefined") return;
  const nextUrl = createStoryFocusShareUrl(loomId, turnId, location);
  const currentUrl = window.location.href;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}

export function getStoryReferenceFromLocation(location: Location = window.location) {
  return referenceFromUrl(location);
}

export async function importStoryReferenceFromUrl(): Promise<StoryReferenceImport | null> {
  if (typeof window === "undefined") return null;
  const ref = getStoryReferenceFromLocation(window.location);
  if (!ref) return null;
  const opened = await openReferenceWithRetry(ref);

  if (opened.kind === "index") {
    window.localStorage.setItem(INDEX_STORAGE_KEY, opened.index.id);
    indexPromise = Promise.resolve(opened.index);
    return { kind: "index", indexId: opened.index.id };
  }

  const info = await opened.loom.info();
  await addStoryLoomToIndex(info.id, {
    title: info.meta?.title ?? "Shared Story",
  });
  return {
    kind: opened.kind,
    loomId: info.id,
    turnId: opened.kind === "loom" ? undefined : opened.ref.turnId,
  };
}

export async function createStoryLoom(title: string, seedText: string) {
  const storyLooms = getStoryLooms();
  const info = await storyLooms.create({ title });
  const loom = await storyLooms.open(info.id);
  await loom.appendTurn(null, { text: seedText }, { role: "prose" });
  await addStoryLoomToIndex(info.id, { title });
  return { info, loom };
}

export async function addStoryLoomToIndex(
  loomId: string,
  meta: StoryEntryMeta,
): Promise<void> {
  await upsertLoom(await getStoryIndex(), getStoryClient().references.loom(loomId), {
    title: meta.title,
    kind: "story",
    meta,
  });
}

export async function listStoryEntries() {
  return (await getStoryIndex()).entries();
}

export async function openStoryLoom(loomId: string): Promise<StoryLoom> {
  return openLoomWithRetry(loomId);
}

export async function removeStory(loomId: string): Promise<void> {
  await (await getStoryIndex()).removeLoom(loomId);
}

async function openLoomWithRetry(loomId: string): Promise<StoryLoom> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await getStoryClient().looms.open(loomId);
    } catch (error) {
      lastError = error;
      if (attempt < 7) await delay(250);
    }
  }
  throw lastError;
}

async function openIndexWithRetry(indexId: string): Promise<StoryIndex> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await getStoryClient().indexes.open(indexId);
    } catch (error) {
      lastError = error;
      if (attempt < 7) await delay(250);
    }
  }
  throw lastError;
}

async function openReferenceWithRetry(ref: NonNullable<ReturnType<typeof referenceFromUrl>>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await getStoryClient().openReference(ref);
    } catch (error) {
      lastError = error;
      if (attempt < 7) await delay(250);
    }
  }
  throw lastError;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
