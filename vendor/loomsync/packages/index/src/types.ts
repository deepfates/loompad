import type { IndexId, LoomId, LoomReference } from "../../core/src/index";

export interface LoomIndexInfo<TIndexMeta = unknown> {
  id: IndexId;
  meta?: TIndexMeta;
  createdAt: number;
}

export interface LoomIndexEntry<TEntryMeta = unknown> {
  ref: Extract<LoomReference, { kind: "loom" }>;
  title?: string;
  kind?: string;
  meta?: TEntryMeta;
  addedAt: number;
  updatedAt?: number;
}

export type LoomIndexEntryInput<TEntryMeta = unknown> = Partial<
  Omit<LoomIndexEntry<TEntryMeta>, "ref" | "addedAt">
>;

export type LoomIndexEntryPatch<TEntryMeta = unknown> = Partial<
  Pick<LoomIndexEntry<TEntryMeta>, "title" | "kind" | "meta" | "updatedAt">
>;

export interface LoomIndexSnapshot<TEntryMeta = unknown, TIndexMeta = unknown> {
  index: LoomIndexInfo<TIndexMeta>;
  entries: LoomIndexEntry<TEntryMeta>[];
}

export type LoomIndexEvent<TEntryMeta, TIndexMeta> =
  | { type: "entry-added"; indexId: IndexId; entry: LoomIndexEntry<TEntryMeta> }
  | { type: "entry-updated"; indexId: IndexId; entry: LoomIndexEntry<TEntryMeta> }
  | { type: "entry-removed"; indexId: IndexId; loomId: LoomId }
  | { type: "index-updated"; index: LoomIndexInfo<TIndexMeta> }
  | { type: "sync-state"; indexId: IndexId; online: boolean; syncing: boolean };

export type LoomIndexListener<TEntryMeta, TIndexMeta> = (
  event: LoomIndexEvent<TEntryMeta, TIndexMeta>,
) => void;

export interface LoomIndex<TEntryMeta = unknown, TIndexMeta = unknown> {
  id: IndexId;

  info(): Promise<LoomIndexInfo<TIndexMeta>>;
  updateMeta(meta: TIndexMeta): Promise<LoomIndexInfo<TIndexMeta>>;

  entries(): Promise<LoomIndexEntry<TEntryMeta>[]>;
  get(loomId: LoomId): Promise<LoomIndexEntry<TEntryMeta> | null>;
  has(loomId: LoomId): Promise<boolean>;

  addLoom(
    ref: Extract<LoomReference, { kind: "loom" }>,
    entry?: LoomIndexEntryInput<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>>;
  updateLoom(
    loomId: LoomId,
    patch: LoomIndexEntryPatch<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>>;
  removeLoom(loomId: LoomId): Promise<void>;

  subscribe(listener: LoomIndexListener<TEntryMeta, TIndexMeta>): () => void;
  export(): Promise<LoomIndexSnapshot<TEntryMeta, TIndexMeta>>;
  close(): void;
}

export interface LoomIndexes<TEntryMeta = unknown, TIndexMeta = unknown> {
  create(meta?: TIndexMeta): Promise<LoomIndex<TEntryMeta, TIndexMeta>>;
  open(indexId: IndexId): Promise<LoomIndex<TEntryMeta, TIndexMeta>>;
  import(
    snapshot: LoomIndexSnapshot<TEntryMeta, TIndexMeta>,
  ): Promise<LoomIndex<TEntryMeta, TIndexMeta>>;
}

export interface MemoryLoomIndexesOptions {
  createId?: () => string;
  now?: () => number;
}

export interface CreateLoomIndexesOptions extends MemoryLoomIndexesOptions {
  backend?: "memory";
}
