import type { Repo } from "@automerge/automerge-repo";
import {
  createBrowserAutomergeRepo,
  createAutomergeLoomWorlds,
  type BrowserAutomergeRepoOptions,
  type AutomergeLoomWorldsOptions,
  type LoomWorlds,
} from "../../core/src/index";
import {
  createAutomergeLoomIndexes,
  type AutomergeLoomIndexesOptions,
} from "./automerge.js";
import type { LoomIndexes } from "./types.js";

export interface BrowserAutomergeLoomRuntimeOptions<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
> {
  repo?: Repo;
  browser?: BrowserAutomergeRepoOptions;
  worlds?: Omit<AutomergeLoomWorldsOptions, "repo">;
  indexes?: Omit<AutomergeLoomIndexesOptions, "repo">;
}

export interface BrowserAutomergeLoomRuntime<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
> {
  repo: Repo;
  worlds: LoomWorlds<TPayload, TRootMeta, TNodeMeta>;
  indexes: LoomIndexes<TEntryMeta, TIndexMeta>;
}

export function createBrowserAutomergeLoomRuntime<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
>(
  options: BrowserAutomergeLoomRuntimeOptions<
    TPayload,
    TRootMeta,
    TNodeMeta,
    TEntryMeta,
    TIndexMeta
  > = {},
): BrowserAutomergeLoomRuntime<
  TPayload,
  TRootMeta,
  TNodeMeta,
  TEntryMeta,
  TIndexMeta
> {
  const repo = options.repo ?? createBrowserAutomergeRepo(options.browser);
  return {
    repo,
    worlds: createAutomergeLoomWorlds<TPayload, TRootMeta, TNodeMeta>({
      ...options.worlds,
      repo,
    }),
    indexes: createAutomergeLoomIndexes<TEntryMeta, TIndexMeta>({
      ...options.indexes,
      repo,
    }),
  };
}
