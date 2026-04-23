import {
  brokenTopology,
  closedHandle,
  cycleDetected,
  duplicateTurnId,
  invalidSnapshot,
  missingParent,
  unknownLoom,
} from "./errors.js";
import { assertJsonEncodable, cloneJson } from "./json.js";
import type {
  CreateLoomsOptions,
  Loom,
  LoomEvent,
  LoomId,
  LoomInfo,
  LoomListener,
  Looms,
  LoomSnapshot,
  MemoryLoomsOptions,
  Turn,
  TurnId,
} from "./types.js";

const ROOT_CHILDREN_KEY = "__root__";

type InternalDoc<TPayload, TLoomMeta, TTurnMeta> = {
  loom: LoomInfo<TLoomMeta>;
  turns: Map<TurnId, Turn<TPayload, TTurnMeta>>;
  children: Map<string, TurnId[]>;
  listeners: Set<LoomListener<TPayload, TLoomMeta, TTurnMeta>>;
};

export function createMemoryLooms<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
>(options: MemoryLoomsOptions = {}): Looms<TPayload, TLoomMeta, TTurnMeta> {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => Date.now());
  const docs = new Map<LoomId, InternalDoc<TPayload, TLoomMeta, TTurnMeta>>();

  const createDoc = (meta?: TLoomMeta): InternalDoc<TPayload, TLoomMeta, TTurnMeta> => {
    assertJsonEncodable(meta, "loom meta");
    const id = `memory:${createId()}`;
    const loom = omitUndefined({
      id,
      meta: cloneJson(meta),
      createdAt: now(),
    });
    return {
      loom,
      turns: new Map(),
      children: new Map([[ROOT_CHILDREN_KEY, []]]),
      listeners: new Set(),
    };
  };

  return {
    async create(meta) {
      const doc = createDoc(meta);
      docs.set(doc.loom.id, doc);
      return cloneJson(doc.loom);
    },

    async get(loomId) {
      const doc = docs.get(loomId);
      return doc ? cloneJson(doc.loom) : null;
    },

    async open(loomId) {
      const doc = docs.get(loomId);
      if (!doc) throw unknownLoom(loomId);
      return new MemoryLoom(loomId, doc, createId, now);
    },

    async import(snapshot) {
      validateSnapshot(snapshot);
      const doc = createDoc(snapshot.loom.meta);
      doc.loom.createdAt = snapshot.loom.createdAt;

      for (const imported of snapshot.turns) {
        const turn = omitUndefined({
          ...cloneJson(imported),
          loomId: doc.loom.id,
        });
        doc.turns.set(turn.id, turn);
        const parentKey = parentKeyOf(turn.parentId);
        const siblings = doc.children.get(parentKey) ?? [];
        siblings.push(turn.id);
        doc.children.set(parentKey, siblings);
        if (!doc.children.has(turn.id)) doc.children.set(turn.id, []);
      }

      docs.set(doc.loom.id, doc);
      return cloneJson(doc.loom);
    },
  };
}

export function createLooms<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
>(
  options: CreateLoomsOptions = {},
): Looms<TPayload, TLoomMeta, TTurnMeta> {
  if (options.backend && options.backend !== "memory") {
    throw new Error(`Unsupported LoomSync backend: ${options.backend}`);
  }
  return createMemoryLooms<TPayload, TLoomMeta, TTurnMeta>(options);
}

class MemoryLoom<TPayload, TLoomMeta, TTurnMeta>
  implements Loom<TPayload, TLoomMeta, TTurnMeta>
{
  private closed = false;

  constructor(
    readonly id: LoomId,
    private readonly doc: InternalDoc<TPayload, TLoomMeta, TTurnMeta>,
    private readonly createId: () => string,
    private readonly now: () => number,
  ) {}

  async info(): Promise<LoomInfo<TLoomMeta>> {
    this.assertOpen();
    return cloneJson(this.doc.loom);
  }

  async updateMeta(meta: TLoomMeta): Promise<LoomInfo<TLoomMeta>> {
    this.assertOpen();
    assertJsonEncodable(meta, "loom meta");
    this.doc.loom = omitUndefined({
      ...this.doc.loom,
      meta: cloneJson(meta),
    });
    this.emit({ type: "loom-updated", loom: cloneJson(this.doc.loom) });
    return cloneJson(this.doc.loom);
  }

  async appendTurn(
    parentId: TurnId | null,
    payload: TPayload,
    meta?: TTurnMeta,
  ): Promise<Turn<TPayload, TTurnMeta>> {
    this.assertOpen();
    assertJsonEncodable(payload, "turn payload");
    assertJsonEncodable(meta, "turn meta");
    if (parentId !== null && !this.doc.turns.has(parentId)) throw missingParent(parentId);

    const turnId = this.createId();
    if (turnId === ROOT_CHILDREN_KEY) throw duplicateTurnId(turnId);
    if (this.doc.turns.has(turnId)) throw duplicateTurnId(turnId);

    const turn = omitUndefined({
      id: turnId,
      loomId: this.id,
      parentId,
      payload: cloneJson(payload),
      meta: cloneJson(meta),
      createdAt: this.now(),
    });

    this.doc.turns.set(turn.id, turn);
    if (!this.doc.children.has(turn.id)) this.doc.children.set(turn.id, []);
    const key = parentKeyOf(parentId);
    const siblings = this.doc.children.get(key) ?? [];
    siblings.push(turn.id);
    this.doc.children.set(key, siblings);

    const output = cloneJson(turn);
    this.emit({ type: "turn-added", loomId: this.id, turn: output });
    return output;
  }

  async getTurn(turnId: TurnId): Promise<Turn<TPayload, TTurnMeta> | null> {
    this.assertOpen();
    const turn = this.doc.turns.get(turnId);
    return turn ? cloneJson(turn) : null;
  }

  async hasTurn(turnId: TurnId): Promise<boolean> {
    this.assertOpen();
    return this.doc.turns.has(turnId);
  }

  async childrenOf(parentId: TurnId | null): Promise<Turn<TPayload, TTurnMeta>[]> {
    this.assertOpen();
    if (parentId !== null && !this.doc.turns.has(parentId)) throw missingParent(parentId);
    return (this.doc.children.get(parentKeyOf(parentId)) ?? []).map((id) => {
      const turn = this.doc.turns.get(id);
      if (!turn) throw brokenTopology(`Child list references missing turn: ${id}`);
      return cloneJson(turn);
    });
  }

  async threadTo(turnId: TurnId): Promise<Turn<TPayload, TTurnMeta>[]> {
    this.assertOpen();
    const thread: Turn<TPayload, TTurnMeta>[] = [];
    const seen = new Set<TurnId>();
    let currentId: TurnId | null = turnId;

    while (currentId !== null) {
      if (seen.has(currentId)) throw cycleDetected(currentId);
      seen.add(currentId);

      const turn = this.doc.turns.get(currentId);
      if (!turn) throw brokenTopology(`Thread references missing turn: ${currentId}`);
      thread.push(turn);
      currentId = turn.parentId;
    }

    return cloneJson(thread.reverse());
  }

  async leaves(): Promise<Turn<TPayload, TTurnMeta>[]> {
    this.assertOpen();
    const leaves: Turn<TPayload, TTurnMeta>[] = [];
    const visit = (parentId: TurnId | null) => {
      for (const childId of this.doc.children.get(parentKeyOf(parentId)) ?? []) {
        const turn = this.doc.turns.get(childId);
        if (!turn) throw brokenTopology(`Child list references missing turn: ${childId}`);
        if ((this.doc.children.get(childId) ?? []).length === 0) {
          leaves.push(turn);
        } else {
          visit(childId);
        }
      }
    };
    visit(null);
    return cloneJson(leaves);
  }

  subscribe(listener: LoomListener<TPayload, TLoomMeta, TTurnMeta>): () => void {
    this.assertOpen();
    this.doc.listeners.add(listener);
    return () => {
      this.doc.listeners.delete(listener);
    };
  }

  async export(): Promise<LoomSnapshot<TPayload, TLoomMeta, TTurnMeta>> {
    this.assertOpen();
    const turns: Turn<TPayload, TTurnMeta>[] = [];
    const visit = (parentId: TurnId | null) => {
      for (const childId of this.doc.children.get(parentKeyOf(parentId)) ?? []) {
        const turn = this.doc.turns.get(childId);
        if (!turn) throw brokenTopology(`Child list references missing turn: ${childId}`);
        turns.push(turn);
        visit(childId);
      }
    };
    visit(null);
    return cloneJson({ loom: this.doc.loom, turns });
  }

  close(): void {
    this.closed = true;
    this.doc.listeners.delete(this.emit);
  }

  private assertOpen() {
    if (this.closed) throw closedHandle();
  }

  private emit(event: LoomEvent<TPayload, TLoomMeta, TTurnMeta>) {
    for (const listener of this.doc.listeners) listener(event);
  }
}

function validateSnapshot(snapshot: LoomSnapshot<unknown, unknown, unknown>): void {
  if (!snapshot || typeof snapshot !== "object") {
    throw invalidSnapshot("Snapshot must be an object");
  }
  if (!snapshot.loom || typeof snapshot.loom.id !== "string") {
    throw invalidSnapshot("Snapshot needs a loom id");
  }
  if (!Array.isArray(snapshot.turns)) throw invalidSnapshot("Snapshot turns must be an array");
  assertJsonEncodable(snapshot, "loom snapshot");

  const ids = new Set<TurnId>();
  for (const turn of snapshot.turns) {
    if (!turn || typeof turn.id !== "string") throw invalidSnapshot("Every turn needs a string id");
    if (turn.id === ROOT_CHILDREN_KEY) throw invalidSnapshot(`${ROOT_CHILDREN_KEY} is reserved`);
    if (ids.has(turn.id)) throw duplicateTurnId(turn.id);
    if (turn.loomId !== snapshot.loom.id) {
      throw invalidSnapshot(`Turn ${turn.id} belongs to ${turn.loomId}, expected ${snapshot.loom.id}`);
    }
    ids.add(turn.id);
  }
  for (const turn of snapshot.turns) {
    if (turn.parentId !== null && !ids.has(turn.parentId)) throw missingParent(turn.parentId);
  }
  for (const turn of snapshot.turns) {
    const seen = new Set<TurnId>();
    let current: TurnId | null = turn.id;
    while (current !== null) {
      if (seen.has(current)) throw cycleDetected(current);
      seen.add(current);
      const currentTurn = snapshot.turns.find((candidate) => candidate.id === current);
      if (!currentTurn) throw brokenTopology(`Missing turn while validating thread: ${current}`);
      current = currentTurn.parentId;
    }
  }
}

function parentKeyOf(parentId: TurnId | null): string {
  return parentId ?? ROOT_CHILDREN_KEY;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
