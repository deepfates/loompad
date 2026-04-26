import type { Repo } from "@automerge/automerge-repo";
import {
  brokenTopology,
  decodeReference,
  encodeReference,
  indexRef,
  loomRef,
  parseReference,
  referenceFromUrl,
  referenceToUrl,
  threadRef,
  turnRef,
  type LoomReference,
  type Looms,
} from "../../core/src/index";
import type { LoomIndexes } from "../../index/src/index";
import type { LoomClient } from "./types.js";

export interface CreateLoomClientOptions<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
> {
  repo?: Repo;
  looms: Looms<TPayload, TLoomMeta, TTurnMeta>;
  indexes: LoomIndexes<TEntryMeta, TIndexMeta>;
  close?: () => Promise<void> | void;
}

export function createLoomClient<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
>(
  options: CreateLoomClientOptions<
    TPayload,
    TLoomMeta,
    TTurnMeta,
    TEntryMeta,
    TIndexMeta
  >,
): LoomClient<TPayload, TLoomMeta, TTurnMeta, TEntryMeta, TIndexMeta> {
  const { repo, looms, indexes } = options;

  return {
    ...(repo ? { repo } : {}),
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
    async openReference(ref: LoomReference) {
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
    async close() {
      await options.close?.();
      await repo?.shutdown();
    },
  };
}
