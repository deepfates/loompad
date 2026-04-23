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
  CreateLoomIndexesOptions,
  MemoryLoomIndexesOptions,
} from "./types.js";

type InternalIndex<TEntryMeta, TIndexMeta> = {
  info: LoomIndexInfo<TIndexMeta>;
  entries: Map<LoomRootId, LoomIndexEntry<TEntryMeta>>;
  order: LoomRootId[];
  listeners: Set<LoomIndexListener<TEntryMeta, TIndexMeta>>;
};

export function createMemoryLoomIndexes<
  TEntryMeta = unknown,
  TIndexMeta = unknown,
>(options: MemoryLoomIndexesOptions = {}): LoomIndexes<TEntryMeta, TIndexMeta> {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => Date.now());
  const indexes = new Map<LoomIndexId, InternalIndex<TEntryMeta, TIndexMeta>>();

  const createInternal = (meta?: TIndexMeta): InternalIndex<TEntryMeta, TIndexMeta> => {
    assertJsonEncodable(meta, "index meta");
    return {
      info: omitUndefined({
        id: `memory-index:${createId()}`,
        meta: cloneJson(meta),
        createdAt: now(),
      }),
      entries: new Map(),
      order: [],
      listeners: new Set(),
    };
  };

  return {
    async createIndex(meta) {
      const index = createInternal(meta);
      indexes.set(index.info.id, index);
      return new MemoryLoomIndex(index.info.id, index, now);
    },

    async openIndex(indexId) {
      const index = indexes.get(indexId);
      if (!index) throw new LoomError("UNKNOWN_ROOT", `Unknown index: ${indexId}`);
      return new MemoryLoomIndex(indexId, index, now);
    },

    async importIndex(snapshot) {
      validateSnapshot(snapshot);
      const index = createInternal(snapshot.index.meta);
      index.info.createdAt = snapshot.index.createdAt;
      for (const entry of snapshot.entries) {
        const cloned = cloneJson(entry);
        index.entries.set(entry.rootId, cloned);
        index.order.push(entry.rootId);
      }
      indexes.set(index.info.id, index);
      return new MemoryLoomIndex(index.info.id, index, now);
    },
  };
}

export function createLoomIndexes<TEntryMeta = unknown, TIndexMeta = unknown>(
  options: CreateLoomIndexesOptions = {},
): LoomIndexes<TEntryMeta, TIndexMeta> {
  if (options.backend && options.backend !== "memory") {
    throw new Error(`Unsupported LoomSync index backend: ${options.backend}`);
  }
  return createMemoryLoomIndexes<TEntryMeta, TIndexMeta>(options);
}

class MemoryLoomIndex<TEntryMeta, TIndexMeta>
  implements LoomIndex<TEntryMeta, TIndexMeta>
{
  private closed = false;

  constructor(
    readonly id: LoomIndexId,
    private readonly index: InternalIndex<TEntryMeta, TIndexMeta>,
    private readonly now: () => number,
  ) {}

  async info(): Promise<LoomIndexInfo<TIndexMeta>> {
    this.assertOpen();
    return cloneJson(this.index.info);
  }

  async updateInfoMeta(meta: TIndexMeta): Promise<LoomIndexInfo<TIndexMeta>> {
    this.assertOpen();
    assertJsonEncodable(meta, "index meta");
    this.index.info = omitUndefined({ ...this.index.info, meta: cloneJson(meta) });
    this.emit({ type: "index-updated", index: cloneJson(this.index.info) });
    return cloneJson(this.index.info);
  }

  async entries(): Promise<LoomIndexEntry<TEntryMeta>[]> {
    this.assertOpen();
    return this.index.order.map((rootId) => {
      const entry = this.index.entries.get(rootId);
      if (!entry) throw new LoomError("BROKEN_TOPOLOGY", `Index order references missing root: ${rootId}`);
      return cloneJson(entry);
    });
  }

  async get(rootId: LoomRootId): Promise<LoomIndexEntry<TEntryMeta> | null> {
    this.assertOpen();
    const entry = this.index.entries.get(rootId);
    return entry ? cloneJson(entry) : null;
  }

  async has(rootId: LoomRootId): Promise<boolean> {
    this.assertOpen();
    return this.index.entries.has(rootId);
  }

  async addRoot(
    rootId: LoomRootId,
    input: LoomIndexEntryInput<TEntryMeta> = {},
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(input, "index entry");
    if (this.index.entries.has(rootId)) {
      throw new LoomError("DUPLICATE_NODE_ID", `Index already contains root: ${rootId}`);
    }

    const entry = omitUndefined({
      rootId,
      title: input.title,
      kind: input.kind,
      meta: cloneJson(input.meta),
      addedAt: this.now(),
      updatedAt: input.updatedAt,
    });
    this.index.entries.set(rootId, entry);
    this.index.order.push(rootId);
    const output = cloneJson(entry);
    this.emit({ type: "entry-added", indexId: this.id, entry: output });
    return output;
  }

  async updateRoot(
    rootId: LoomRootId,
    patch: LoomIndexEntryPatch<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(patch, "index entry patch");
    const existing = this.index.entries.get(rootId);
    if (!existing) throw new LoomError("UNKNOWN_ROOT", `Index does not contain root: ${rootId}`);

    const updated = omitUndefined({
      ...existing,
      ...cloneJson(patch),
      updatedAt: patch.updatedAt ?? this.now(),
    });
    this.index.entries.set(rootId, updated);
    const output = cloneJson(updated);
    this.emit({ type: "entry-updated", indexId: this.id, entry: output });
    return output;
  }

  async removeRoot(rootId: LoomRootId): Promise<void> {
    this.assertOpen();
    if (!this.index.entries.has(rootId)) return;
    this.index.entries.delete(rootId);
    this.index.order = this.index.order.filter((candidate) => candidate !== rootId);
    this.emit({ type: "entry-removed", indexId: this.id, rootId });
  }

  subscribe(listener: LoomIndexListener<TEntryMeta, TIndexMeta>): () => void {
    this.assertOpen();
    this.index.listeners.add(listener);
    return () => this.index.listeners.delete(listener);
  }

  async export(): Promise<LoomIndexSnapshot<TEntryMeta, TIndexMeta>> {
    this.assertOpen();
    return cloneJson({
      index: this.index.info,
      entries: await this.entries(),
    });
  }

  close(): void {
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) throw new LoomError("CLOSED_HANDLE", "This loom index handle is closed");
  }

  private emit(event: LoomIndexEvent<TEntryMeta, TIndexMeta>): void {
    for (const listener of this.index.listeners) listener(event);
  }
}

function validateSnapshot(snapshot: LoomIndexSnapshot<unknown, unknown>): void {
  if (!snapshot || typeof snapshot !== "object") {
    throw new LoomError("INVALID_SNAPSHOT", "Index snapshot must be an object");
  }
  if (!snapshot.index || typeof snapshot.index.id !== "string") {
    throw new LoomError("INVALID_SNAPSHOT", "Index snapshot needs an index id");
  }
  if (!Array.isArray(snapshot.entries)) {
    throw new LoomError("INVALID_SNAPSHOT", "Index snapshot entries must be an array");
  }
  assertJsonEncodable(snapshot, "index snapshot");

  const seen = new Set<LoomRootId>();
  for (const entry of snapshot.entries) {
    if (!entry || typeof entry.rootId !== "string") {
      throw new LoomError("INVALID_SNAPSHOT", "Every index entry needs a rootId");
    }
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
