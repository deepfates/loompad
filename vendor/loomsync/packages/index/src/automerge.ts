import { DocHandle, Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import { LoomError } from "../../core/src/errors";
import type { LoomRootId } from "../../core/src/types";
import type {
  LoomIndex,
  LoomIndexEntry,
  LoomIndexEntryInput,
  LoomIndexEntryPatch,
  LoomIndexes,
  LoomIndexEvent,
  LoomIndexId,
  LoomIndexInfo,
  LoomIndexListener,
  LoomIndexSnapshot,
} from "./types.js";

type IndexDoc<TEntryMeta, TIndexMeta> = {
  version: 1;
  index: LoomIndexInfo<TIndexMeta>;
  entries: Record<LoomRootId, LoomIndexEntry<TEntryMeta>>;
  order: LoomRootId[];
};

export interface AutomergeLoomIndexesOptions {
  repo?: Repo;
  now?: () => number;
}

export function createAutomergeLoomIndexes<
  TEntryMeta = unknown,
  TIndexMeta = unknown,
>(options: AutomergeLoomIndexesOptions = {}): LoomIndexes<TEntryMeta, TIndexMeta> {
  const repo = options.repo ?? new Repo();
  const now = options.now ?? (() => Date.now());

  return {
    async createIndex(meta) {
      assertJsonEncodable(meta, "index meta");
      const handle = repo.create<IndexDoc<TEntryMeta, TIndexMeta>>({
        version: 1,
        index: {
          id: "" as LoomIndexId,
          ...(meta === undefined ? {} : { meta: cloneJson(meta) }),
          createdAt: now(),
        },
        entries: {},
        order: [],
      });
      handle.change((doc) => {
        doc.index.id = handle.url;
      });
      return new AutomergeLoomIndex(handle.url, handle, now);
    },

    async openIndex(indexId) {
      let handle: DocHandle<IndexDoc<TEntryMeta, TIndexMeta>>;
      try {
        handle = await repo.find<IndexDoc<TEntryMeta, TIndexMeta>>(
          indexId as AutomergeUrl,
        );
        await handle.whenReady();
      } catch {
        throw new LoomError("UNKNOWN_ROOT", `Unknown index: ${indexId}`);
      }
      return new AutomergeLoomIndex(indexId, handle, now);
    },

    async importIndex(snapshot) {
      validateSnapshot(snapshot);
      const handle = repo.create<IndexDoc<TEntryMeta, TIndexMeta>>({
        version: 1,
        index: {
          id: "" as LoomIndexId,
          ...(snapshot.index.meta === undefined
            ? {}
            : { meta: cloneJson(snapshot.index.meta) }),
          createdAt: snapshot.index.createdAt,
        },
        entries: {},
        order: [],
      });
      handle.change((doc) => {
        doc.index.id = handle.url;
        for (const entry of snapshot.entries) {
          doc.entries[entry.rootId] = cloneJson(entry);
          doc.order.push(entry.rootId);
        }
      });
      return new AutomergeLoomIndex(handle.url, handle, now);
    },
  };
}

class AutomergeLoomIndex<TEntryMeta, TIndexMeta>
  implements LoomIndex<TEntryMeta, TIndexMeta>
{
  private closed = false;
  private listeners = new Set<LoomIndexListener<TEntryMeta, TIndexMeta>>();
  private knownRootIds: Set<LoomRootId>;

  constructor(
    readonly id: LoomIndexId,
    private readonly handle: DocHandle<IndexDoc<TEntryMeta, TIndexMeta>>,
    private readonly now: () => number,
  ) {
    this.knownRootIds = new Set(Object.keys(this.handle.doc().entries ?? {}));
    this.handle.on("change", ({ doc }) => {
      const current = new Set(Object.keys(doc.entries ?? {}));
      for (const rootId of current) {
        if (!this.knownRootIds.has(rootId)) {
          const entry = doc.entries[rootId];
          if (entry) this.emit({ type: "entry-added", indexId: this.id, entry: cloneJson(entry) });
        }
      }
      for (const rootId of this.knownRootIds) {
        if (!current.has(rootId)) this.emit({ type: "entry-removed", indexId: this.id, rootId });
      }
      this.knownRootIds = current;
    });
  }

  async info(): Promise<LoomIndexInfo<TIndexMeta>> {
    this.assertOpen();
    return cloneJson(this.doc().index);
  }

  async updateInfoMeta(meta: TIndexMeta): Promise<LoomIndexInfo<TIndexMeta>> {
    this.assertOpen();
    assertJsonEncodable(meta, "index meta");
    this.handle.change((doc) => {
      doc.index.meta = cloneJson(meta) as TIndexMeta;
    });
    const index = cloneJson(this.doc().index);
    this.emit({ type: "index-updated", index });
    return index;
  }

  async entries(): Promise<LoomIndexEntry<TEntryMeta>[]> {
    this.assertOpen();
    const doc = this.doc();
    return doc.order.map((rootId) => {
      const entry = doc.entries[rootId];
      if (!entry) throw new LoomError("BROKEN_TOPOLOGY", `Index order references missing root: ${rootId}`);
      return cloneJson(entry);
    });
  }

  async get(rootId: LoomRootId): Promise<LoomIndexEntry<TEntryMeta> | null> {
    this.assertOpen();
    const entry = this.doc().entries[rootId];
    return entry ? cloneJson(entry) : null;
  }

  async has(rootId: LoomRootId): Promise<boolean> {
    this.assertOpen();
    return Boolean(this.doc().entries[rootId]);
  }

  async addRoot(
    rootId: LoomRootId,
    input: LoomIndexEntryInput<TEntryMeta> = {},
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(input, "index entry");
    if (this.doc().entries[rootId]) {
      throw new LoomError("DUPLICATE_NODE_ID", `Index already contains root: ${rootId}`);
    }

    const entry = omitUndefined({
      rootId,
      title: input.title,
      kind: input.kind,
      meta: cloneJson(input.meta),
      addedAt: this.now(),
      updatedAt: input.updatedAt,
    }) as LoomIndexEntry<TEntryMeta>;

    this.handle.change((doc) => {
      doc.entries[rootId] = entry;
      doc.order.push(rootId);
    });

    return cloneJson(entry);
  }

  async updateRoot(
    rootId: LoomRootId,
    patch: LoomIndexEntryPatch<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(patch, "index entry patch");
    const existing = this.doc().entries[rootId];
    if (!existing) throw new LoomError("UNKNOWN_ROOT", `Index does not contain root: ${rootId}`);

    const updated = omitUndefined({
      ...existing,
      ...cloneJson(patch),
      updatedAt: patch.updatedAt ?? this.now(),
    }) as LoomIndexEntry<TEntryMeta>;
    this.handle.change((doc) => {
      doc.entries[rootId] = updated;
    });
    const output = cloneJson(updated);
    this.emit({ type: "entry-updated", indexId: this.id, entry: output });
    return output;
  }

  async removeRoot(rootId: LoomRootId): Promise<void> {
    this.assertOpen();
    if (!this.doc().entries[rootId]) return;
    this.handle.change((doc) => {
      delete doc.entries[rootId];
      const index = doc.order.indexOf(rootId);
      if (index >= 0) doc.order.splice(index, 1);
    });
  }

  subscribe(listener: LoomIndexListener<TEntryMeta, TIndexMeta>): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async export(): Promise<LoomIndexSnapshot<TEntryMeta, TIndexMeta>> {
    this.assertOpen();
    return cloneJson({
      index: this.doc().index,
      entries: await this.entries(),
    });
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }

  private doc() {
    return this.handle.doc();
  }

  private assertOpen(): void {
    if (this.closed) throw new LoomError("CLOSED_HANDLE", "This loom index handle is closed");
  }

  private emit(event: LoomIndexEvent<TEntryMeta, TIndexMeta>): void {
    for (const listener of this.listeners) listener(event);
  }
}

function validateSnapshot(snapshot: LoomIndexSnapshot<unknown, unknown>): void {
  assertJsonEncodable(snapshot, "index snapshot");
  const seen = new Set<LoomRootId>();
  for (const entry of snapshot.entries) {
    if (seen.has(entry.rootId)) {
      throw new LoomError("DUPLICATE_NODE_ID", `Duplicate index root: ${entry.rootId}`);
    }
    seen.add(entry.rootId);
  }
}

function assertJsonEncodable(value: unknown, label: string): void {
  try {
    JSON.stringify(value);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TypeError(`${label} must be JSON-encodable: ${reason}`);
  }
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
