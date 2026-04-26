import { LoomError, duplicateLoomId, loomRef, unknownIndex } from "../../core/src/index";
import type { IndexId, LoomId, LoomReference } from "../../core/src/index";
import type {
  LoomIndex,
  LoomIndexEntry,
  LoomIndexEntryInput,
  LoomIndexEntryPatch,
  LoomIndexes,
  LoomIndexEvent,
  LoomIndexInfo,
  LoomIndexListener,
  LoomIndexSnapshot,
  MemoryLoomIndexesOptions,
} from "./types.js";

export type { MemoryLoomIndexesOptions } from "./types.js";

type InternalIndex<TEntryMeta, TIndexMeta> = {
  info: LoomIndexInfo<TIndexMeta>;
  entries: Map<LoomId, LoomIndexEntry<TEntryMeta>>;
  order: LoomId[];
  listeners: Set<LoomIndexListener<TEntryMeta, TIndexMeta>>;
};

export function createMemoryLoomIndexes<
  TEntryMeta = unknown,
  TIndexMeta = unknown,
>(options: MemoryLoomIndexesOptions = {}): LoomIndexes<TEntryMeta, TIndexMeta> {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => Date.now());
  const indexes = new Map<IndexId, InternalIndex<TEntryMeta, TIndexMeta>>();

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
    async create(meta) {
      const index = createInternal(meta);
      indexes.set(index.info.id, index);
      return new MemoryLoomIndex(index.info.id, index, now);
    },

    async open(indexId) {
      const index = indexes.get(indexId);
      if (!index) throw unknownIndex(indexId);
      return new MemoryLoomIndex(indexId, index, now);
    },

    async import(snapshot) {
      validateSnapshot(snapshot);
      const index = createInternal(snapshot.index.meta);
      index.info.createdAt = snapshot.index.createdAt;
      for (const entry of snapshot.entries) {
        const cloned = cloneJson(entry);
        index.entries.set(cloned.ref.loomId, cloned);
        index.order.push(cloned.ref.loomId);
      }
      indexes.set(index.info.id, index);
      return new MemoryLoomIndex(index.info.id, index, now);
    },
  };
}

class MemoryLoomIndex<TEntryMeta, TIndexMeta>
  implements LoomIndex<TEntryMeta, TIndexMeta>
{
  private closed = false;

  constructor(
    readonly id: IndexId,
    private readonly index: InternalIndex<TEntryMeta, TIndexMeta>,
    private readonly now: () => number,
  ) {}

  async info(): Promise<LoomIndexInfo<TIndexMeta>> {
    this.assertOpen();
    return cloneJson(this.index.info);
  }

  async updateMeta(meta: TIndexMeta): Promise<LoomIndexInfo<TIndexMeta>> {
    this.assertOpen();
    assertJsonEncodable(meta, "index meta");
    this.index.info = omitUndefined({ ...this.index.info, meta: cloneJson(meta) });
    this.emit({ type: "index-updated", index: cloneJson(this.index.info) });
    return cloneJson(this.index.info);
  }

  async entries(): Promise<LoomIndexEntry<TEntryMeta>[]> {
    this.assertOpen();
    return this.index.order.map((loomId) => {
      const entry = this.index.entries.get(loomId);
      if (!entry) throw new LoomError("BROKEN_TOPOLOGY", `Index order references missing loom: ${loomId}`);
      return cloneJson(entry);
    });
  }

  async get(loomId: LoomId): Promise<LoomIndexEntry<TEntryMeta> | null> {
    this.assertOpen();
    const entry = this.index.entries.get(loomId);
    return entry ? cloneJson(entry) : null;
  }

  async has(loomId: LoomId): Promise<boolean> {
    this.assertOpen();
    return this.index.entries.has(loomId);
  }

  async addLoom(
    ref: Extract<LoomReference, { kind: "loom" }>,
    input: LoomIndexEntryInput<TEntryMeta> = {},
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(input, "index entry");
    if (this.index.entries.has(ref.loomId)) {
      throw duplicateLoomId(ref.loomId);
    }
    const entry = omitUndefined({
      ref: loomRef(ref.loomId),
      title: input.title,
      kind: input.kind,
      meta: cloneJson(input.meta),
      addedAt: this.now(),
      updatedAt: input.updatedAt,
    }) as LoomIndexEntry<TEntryMeta>;
    this.index.entries.set(ref.loomId, entry);
    this.index.order.push(ref.loomId);
    const output = cloneJson(entry);
    this.emit({ type: "entry-added", indexId: this.id, entry: output });
    return output;
  }

  async updateLoom(
    loomId: LoomId,
    patch: LoomIndexEntryPatch<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(patch, "index entry patch");
    const existing = this.index.entries.get(loomId);
    if (!existing) throw new LoomError("UNKNOWN_LOOM", `Index does not contain loom: ${loomId}`);
    const updated = omitUndefined({
      ...existing,
      ...patch,
      meta: patch.meta === undefined ? existing.meta : cloneJson(patch.meta),
      updatedAt: patch.updatedAt ?? this.now(),
    }) as LoomIndexEntry<TEntryMeta>;
    this.index.entries.set(loomId, updated);
    const output = cloneJson(updated);
    this.emit({ type: "entry-updated", indexId: this.id, entry: output });
    return output;
  }

  async removeLoom(loomId: LoomId): Promise<void> {
    this.assertOpen();
    if (!this.index.entries.has(loomId)) return;
    this.index.entries.delete(loomId);
    this.index.order = this.index.order.filter((candidate) => candidate !== loomId);
    this.emit({ type: "entry-removed", indexId: this.id, loomId });
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

  private assertOpen() {
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
  const seen = new Set<LoomId>();
  for (const entry of snapshot.entries) {
    if (!entry?.ref || entry.ref.kind !== "loom" || typeof entry.ref.loomId !== "string") {
      throw new LoomError("INVALID_SNAPSHOT", "Every index entry needs a loom reference");
    }
    if (seen.has(entry.ref.loomId)) {
      throw duplicateLoomId(entry.ref.loomId);
    }
    seen.add(entry.ref.loomId);
  }
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function assertJsonEncodable(value: unknown, label: string): void {
  if (value === undefined) return;
  try {
    JSON.stringify(value);
  } catch {
    throw new LoomError("INVALID_SNAPSHOT", `${label} must be JSON-encodable`);
  }
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
