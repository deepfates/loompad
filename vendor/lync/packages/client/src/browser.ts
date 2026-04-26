import type { Repo } from "@automerge/automerge-repo";
import {
  createAutomergeLooms,
  type AutomergeLoomsOptions,
} from "../../core/src/automerge";
import {
  createBrowserAutomergeRepo,
  type BrowserAutomergeRepoOptions,
} from "../../core/src/browser";
import {
  createAutomergeLoomIndexes,
  type AutomergeLoomIndexesOptions,
} from "../../index/src/automerge";
import { createLoomClient } from "./create.js";
import type { LoomClient } from "./types.js";

export interface BrowserLoomClientOptions<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
> {
  repo?: Repo;
  browser?: BrowserAutomergeRepoOptions;
  looms?: Omit<AutomergeLoomsOptions, "repo">;
  indexes?: Omit<AutomergeLoomIndexesOptions, "repo">;
}

export function createBrowserLoomClient<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
>(
  options: BrowserLoomClientOptions<
    TPayload,
    TLoomMeta,
    TTurnMeta,
    TEntryMeta,
    TIndexMeta
  > = {},
): LoomClient<TPayload, TLoomMeta, TTurnMeta, TEntryMeta, TIndexMeta> {
  const repo = options.repo ?? createBrowserAutomergeRepo(options.browser);
  const looms = createAutomergeLooms<TPayload, TLoomMeta, TTurnMeta>({
    ...options.looms,
    repo,
  });
  const indexes = createAutomergeLoomIndexes<TEntryMeta, TIndexMeta>({
    ...options.indexes,
    repo,
  });

  return createLoomClient({ repo, looms, indexes });
}
