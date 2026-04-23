import type { Repo } from "@automerge/automerge-repo";
import {
  createBrowserAutomergeRepo,
  createAutomergeLooms,
  type AutomergeLoomsOptions,
  type BrowserAutomergeRepoOptions,
  type Loom,
  type LoomReference,
  type Looms,
  type Turn,
  brokenTopology,
  indexRef,
  loomRef,
  referenceFromUrl,
  referenceToUrl,
  threadRef,
  turnRef,
  encodeReference,
  decodeReference,
  parseReference,
} from "../../core/src/index";
import {
  createAutomergeLoomIndexes,
  type AutomergeLoomIndexesOptions,
} from "./automerge.js";
import type { LoomIndex, LoomIndexes } from "./types.js";

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

export type OpenedReference<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
> =
  | {
      kind: "loom";
      ref: Extract<LoomReference, { kind: "loom" }>;
      loom: Loom<TPayload, TLoomMeta, TTurnMeta>;
    }
  | {
      kind: "turn";
      ref: Extract<LoomReference, { kind: "turn" }>;
      loom: Loom<TPayload, TLoomMeta, TTurnMeta>;
      turn: Turn<TPayload, TTurnMeta>;
    }
  | {
      kind: "thread";
      ref: Extract<LoomReference, { kind: "thread" }>;
      loom: Loom<TPayload, TLoomMeta, TTurnMeta>;
      thread: Turn<TPayload, TTurnMeta>[];
      target: Turn<TPayload, TTurnMeta>;
    }
  | {
      kind: "index";
      ref: Extract<LoomReference, { kind: "index" }>;
      index: LoomIndex<TEntryMeta, TIndexMeta>;
    };

export interface BrowserLoomClient<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
> {
  repo: Repo;
  looms: Looms<TPayload, TLoomMeta, TTurnMeta>;
  indexes: LoomIndexes<TEntryMeta, TIndexMeta>;
  references: {
    loom: typeof loomRef;
    turn: typeof turnRef;
    thread: typeof threadRef;
    index: typeof indexRef;
    encode: typeof encodeReference;
    decode: typeof decodeReference;
    parse: typeof parseReference;
    toUrl: typeof referenceToUrl;
    fromUrl: typeof referenceFromUrl;
  };
  openReference(
    ref: LoomReference,
  ): Promise<OpenedReference<TPayload, TLoomMeta, TTurnMeta, TEntryMeta, TIndexMeta>>;
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
): BrowserLoomClient<TPayload, TLoomMeta, TTurnMeta, TEntryMeta, TIndexMeta> {
  const repo = options.repo ?? createBrowserAutomergeRepo(options.browser);
  const looms = createAutomergeLooms<TPayload, TLoomMeta, TTurnMeta>({
    ...options.looms,
    repo,
  });
  const indexes = createAutomergeLoomIndexes<TEntryMeta, TIndexMeta>({
    ...options.indexes,
    repo,
  });

  return {
    repo,
    looms,
    indexes,
    references: {
      loom: loomRef,
      turn: turnRef,
      thread: threadRef,
      index: indexRef,
      encode: encodeReference,
      decode: decodeReference,
      parse: parseReference,
      toUrl: referenceToUrl,
      fromUrl: referenceFromUrl,
    },
    async openReference(ref) {
      switch (ref.kind) {
        case "loom": {
          const loom = await looms.open(ref.loomId);
          return { kind: "loom", ref, loom };
        }
        case "turn": {
          const loom = await looms.open(ref.loomId);
          const turn = await loom.getTurn(ref.turnId);
          if (!turn) throw brokenTopology(`Reference target turn not found: ${ref.turnId}`);
          return { kind: "turn", ref, loom, turn };
        }
        case "thread": {
          const loom = await looms.open(ref.loomId);
          const thread = await loom.threadTo(ref.turnId);
          const target = thread.at(-1);
          if (!target) throw brokenTopology(`Reference target thread is empty: ${ref.turnId}`);
          return { kind: "thread", ref, loom, thread, target };
        }
        case "index": {
          const index = await indexes.open(ref.indexId);
          return { kind: "index", ref, index };
        }
      }
    },
  };
}
