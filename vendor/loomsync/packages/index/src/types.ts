import type { LoomRootId } from "@loomsync/core";

export type LoomIndexId = string;

export interface LoomIndexInfo<TIndexMeta = unknown> {
  id: LoomIndexId;
  meta?: TIndexMeta;
  createdAt: number;
}

export interface LoomIndexEntry<TEntryMeta = unknown> {
  rootId: LoomRootId;
  title?: string;
  kind?: string;
  meta?: TEntryMeta;
  addedAt: number;
  updatedAt?: number;
}

export type LoomIndexEntryInput<TEntryMeta = unknown> = Partial<
  Omit<LoomIndexEntry<TEntryMeta>, "rootId" | "addedAt">
>;

export type LoomIndexEntryPatch<TEntryMeta = unknown> = Partial<
  Pick<LoomIndexEntry<TEntryMeta>, "title" | "kind" | "meta" | "updatedAt">
>;

export interface LoomIndexSnapshot<TEntryMeta = unknown, TIndexMeta = unknown> {
  index: LoomIndexInfo<TIndexMeta>;
  entries: LoomIndexEntry<TEntryMeta>[];
}

export type LoomIndexEvent<TEntryMeta, TIndexMeta> =
  | { type: "entry-added"; indexId: LoomIndexId; entry: LoomIndexEntry<TEntryMeta> }
  | { type: "entry-updated"; indexId: LoomIndexId; entry: LoomIndexEntry<TEntryMeta> }
  | { type: "entry-removed"; indexId: LoomIndexId; rootId: LoomRootId }
  | { type: "index-updated"; index: LoomIndexInfo<TIndexMeta> }
  | { type: "sync-state"; indexId: LoomIndexId; online: boolean; syncing: boolean };

export type LoomIndexListener<TEntryMeta, TIndexMeta> = (
  event: LoomIndexEvent<TEntryMeta, TIndexMeta>,
) => void;

export interface LoomIndex<TEntryMeta = unknown, TIndexMeta = unknown> {
  id: LoomIndexId;

  info(): Promise<LoomIndexInfo<TIndexMeta>>;
  updateInfoMeta(meta: TIndexMeta): Promise<LoomIndexInfo<TIndexMeta>>;

  entries(): Promise<LoomIndexEntry<TEntryMeta>[]>;
  get(rootId: LoomRootId): Promise<LoomIndexEntry<TEntryMeta> | null>;
  has(rootId: LoomRootId): Promise<boolean>;

  addRoot(
    rootId: LoomRootId,
    entry?: LoomIndexEntryInput<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>>;
  updateRoot(
    rootId: LoomRootId,
    patch: LoomIndexEntryPatch<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>>;
  removeRoot(rootId: LoomRootId): Promise<void>;

  subscribe(listener: LoomIndexListener<TEntryMeta, TIndexMeta>): () => void;
  export(): Promise<LoomIndexSnapshot<TEntryMeta, TIndexMeta>>;
  close(): void;
}

export interface LoomIndexes<TEntryMeta = unknown, TIndexMeta = unknown> {
  createIndex(meta?: TIndexMeta): Promise<LoomIndex<TEntryMeta, TIndexMeta>>;
  openIndex(indexId: LoomIndexId): Promise<LoomIndex<TEntryMeta, TIndexMeta>>;
  importIndex(
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
