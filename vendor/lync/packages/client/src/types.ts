import type { Repo } from "@automerge/automerge-repo";
import type {
  Loom,
  LoomReference,
  Looms,
  Turn,
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
import type { LoomIndex, LoomIndexes } from "../../index/src/index";

export type ReferenceHelpers = {
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

export interface LoomClient<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
> {
  repo?: Repo;
  looms: Looms<TPayload, TLoomMeta, TTurnMeta>;
  indexes: LoomIndexes<TEntryMeta, TIndexMeta>;
  references: ReferenceHelpers;
  openReference(
    ref: LoomReference,
  ): Promise<OpenedReference<TPayload, TLoomMeta, TTurnMeta, TEntryMeta, TIndexMeta>>;
  close(): Promise<void>;
}
