import { DocHandle, Repo, type AutomergeUrl } from "@automerge/automerge-repo";
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
} from "./types.js";

type IndexDoc<TEntryMeta, TIndexMeta> = {
  version: 1;
  index: LoomIndexInfo<TIndexMeta>;
  entries: Record<LoomId, LoomIndexEntry<TEntryMeta>>;
  order: LoomId[];
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
    async create(meta) {
      assertJsonEncodable(meta, "index meta");
      const handle = repo.create<IndexDoc<TEntryMeta, TIndexMeta>>({
        version: 1,
        index: {
          id: "" as IndexId,
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

    async open(indexId) {
      let handle: DocHandle<IndexDoc<TEntryMeta, TIndexMeta>>;
      try {
        handle = await repo.find<IndexDoc<TEntryMeta, TIndexMeta>>(
          indexId as AutomergeUrl,
        );
        await handle.whenReady();
      } catch {
        throw unknownIndex(indexId);
      }
      return new AutomergeLoomIndex(indexId, handle, now);
    },

    async import(snapshot) {
      validateSnapshot(snapshot);
      const handle = repo.create<IndexDoc<TEntryMeta, TIndexMeta>>({
        version: 1,
        index: {
          id: "" as IndexId,
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
          doc.entries[entry.ref.loomId] = cloneJson(entry);
          doc.order.push(entry.ref.loomId);
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
  private knownLoomIds: Set<LoomId>;

  constructor(
    readonly id: IndexId,
    private readonly handle: DocHandle<IndexDoc<TEntryMeta, TIndexMeta>>,
    private readonly now: () => number,
  ) {
    this.knownLoomIds = new Set(Object.keys(this.handle.doc().entries ?? {}));
    this.handle.on("change", ({ doc }) => {
      const current = new Set(Object.keys(doc.entries ?? {}));
      for (const loomId of current) {
        if (!this.knownLoomIds.has(loomId)) {
          const entry = doc.entries[loomId];
          if (entry) this.emit({ type: "entry-added", indexId: this.id, entry: cloneJson(entry) });
        }
      }
      for (const loomId of this.knownLoomIds) {
        if (!current.has(loomId)) this.emit({ type: "entry-removed", indexId: this.id, loomId });
      }
      this.knownLoomIds = current;
    });
  }

  async info(): Promise<LoomIndexInfo<TIndexMeta>> {
    this.assertOpen();
    return cloneJson(this.doc().index);
  }

  async updateMeta(meta: TIndexMeta): Promise<LoomIndexInfo<TIndexMeta>> {
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
    return doc.order.map((loomId) => {
      const entry = doc.entries[loomId];
      if (!entry) throw new LoomError("BROKEN_TOPOLOGY", `Index order references missing loom: ${loomId}`);
      return cloneJson(entry);
    });
  }

  async get(loomId: LoomId): Promise<LoomIndexEntry<TEntryMeta> | null> {
    this.assertOpen();
    const entry = this.doc().entries[loomId];
    return entry ? cloneJson(entry) : null;
  }

  async has(loomId: LoomId): Promise<boolean> {
    this.assertOpen();
    return Boolean(this.doc().entries[loomId]);
  }

  async addLoom(
    ref: Extract<LoomReference, { kind: "loom" }>,
    input: LoomIndexEntryInput<TEntryMeta> = {},
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(input, "index entry");
    if (this.doc().entries[ref.loomId]) {
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
    this.handle.change((doc) => {
      doc.entries[ref.loomId] = entry;
      doc.order.push(ref.loomId);
    });
    this.emit({ type: "entry-added", indexId: this.id, entry });
    return cloneJson(entry);
  }

  async updateLoom(
    loomId: LoomId,
    patch: LoomIndexEntryPatch<TEntryMeta>,
  ): Promise<LoomIndexEntry<TEntryMeta>> {
    this.assertOpen();
    assertJsonEncodable(patch, "index entry patch");
    const existing = this.doc().entries[loomId];
    if (!existing) throw new LoomError("UNKNOWN_LOOM", `Index does not contain loom: ${loomId}`);
    const updated = omitUndefined({
      ...existing,
      ...patch,
      meta: patch.meta === undefined ? existing.meta : cloneJson(patch.meta),
      updatedAt: patch.updatedAt ?? this.now(),
    }) as LoomIndexEntry<TEntryMeta>;
    this.handle.change((doc) => {
      doc.entries[loomId] = updated;
    });
    const output = cloneJson(updated);
    this.emit({ type: "entry-updated", indexId: this.id, entry: output });
    return output;
  }

  async removeLoom(loomId: LoomId): Promise<void> {
    this.assertOpen();
    if (!this.doc().entries[loomId]) return;
    this.handle.change((doc) => {
      delete doc.entries[loomId];
      const index = doc.order.indexOf(loomId);
      if (index >= 0) doc.order.splice(index, 1);
    });
    this.emit({ type: "entry-removed", indexId: this.id, loomId });
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

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
