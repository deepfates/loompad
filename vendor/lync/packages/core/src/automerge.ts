import { DocHandle, Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  brokenTopology,
  closedHandle,
  cycleDetected,
  duplicateTurnId,
  missingParent,
  unknownLoom,
} from "./errors.js";
import { assertJsonEncodable, cloneJson } from "./json.js";
import type {
  Loom,
  LoomEvent,
  LoomId,
  LoomInfo,
  LoomListener,
  Looms,
  LoomSnapshot,
  Turn,
  TurnId,
} from "./types.js";

const ROOT_CHILDREN_KEY = "__root__";

type LoomDoc<TPayload, TLoomMeta, TTurnMeta> = {
  version: 1;
  root: LoomInfo<TLoomMeta>;
  nodes: Record<TurnId, Turn<TPayload, TTurnMeta>>;
  children: Record<string, TurnId[]>;
};

export interface AutomergeLoomsOptions {
  repo?: Repo;
  createTurnId?: () => string;
  now?: () => number;
}

export function createAutomergeLooms<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
>(
  options: AutomergeLoomsOptions = {},
): Looms<TPayload, TLoomMeta, TTurnMeta> {
  const repo = options.repo ?? new Repo();
  const createTurnId = options.createTurnId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => Date.now());

  return {
    async create(meta) {
      assertJsonEncodable(meta, "loom meta");
      const handle = repo.create<LoomDoc<TPayload, TLoomMeta, TTurnMeta>>({
        version: 1,
        root: {
          id: "" as LoomId,
          ...(meta === undefined ? {} : { meta: cloneJson(meta) }),
          createdAt: now(),
        },
        nodes: {},
        children: { [ROOT_CHILDREN_KEY]: [] },
      });
      handle.change((doc) => {
        doc.root.id = handle.url;
      });
      return cloneJson(handle.doc().root);
    },

    async get(loomId) {
      try {
        const handle = await repo.find<LoomDoc<TPayload, TLoomMeta, TTurnMeta>>(
          loomId as AutomergeUrl,
        );
        await handle.whenReady();
        return cloneJson(handle.doc().root);
      } catch {
        return null;
      }
    },

    async open(loomId) {
      let handle: DocHandle<LoomDoc<TPayload, TLoomMeta, TTurnMeta>>;
      try {
        handle = await repo.find<LoomDoc<TPayload, TLoomMeta, TTurnMeta>>(
          loomId as AutomergeUrl,
        );
        await handle.whenReady();
      } catch {
        throw unknownLoom(loomId);
      }
      return new AutomergeLoom(loomId, handle, createTurnId, now);
    },

    async import(snapshot) {
      validateSnapshot(snapshot);
      const handle = repo.create<LoomDoc<TPayload, TLoomMeta, TTurnMeta>>({
        version: 1,
        root: {
          id: "" as LoomId,
          ...(snapshot.loom.meta === undefined ? {} : { meta: cloneJson(snapshot.loom.meta) }),
          createdAt: snapshot.loom.createdAt,
        },
        nodes: {},
        children: { [ROOT_CHILDREN_KEY]: [] },
      });
      handle.change((doc) => {
        doc.root.id = handle.url;
        for (const imported of snapshot.turns) {
          const turn = {
            ...cloneJson(imported),
            loomId: handle.url,
          };
          doc.nodes[turn.id] = turn;
          doc.children[turn.id] ??= [];
          const key = parentKeyOf(turn.parentId);
          doc.children[key] ??= [];
          doc.children[key].push(turn.id);
        }
      });
      return cloneJson(handle.doc().root);
    },
  };
}

class AutomergeLoom<TPayload, TLoomMeta, TTurnMeta>
  implements Loom<TPayload, TLoomMeta, TTurnMeta>
{
  private closed = false;
  private listeners = new Set<LoomListener<TPayload, TLoomMeta, TTurnMeta>>();
  private knownTurnIds: Set<TurnId>;

  constructor(
    readonly id: LoomId,
    private readonly handle: DocHandle<LoomDoc<TPayload, TLoomMeta, TTurnMeta>>,
    private readonly createTurnId: () => string,
    private readonly now: () => number,
  ) {
    this.knownTurnIds = new Set(Object.keys(this.handle.doc().nodes ?? {}));
    this.handle.on("change", ({ doc }) => {
      const currentIds = new Set(Object.keys(doc.nodes ?? {}));
      for (const turnId of currentIds) {
        if (!this.knownTurnIds.has(turnId)) {
          const turn = doc.nodes[turnId];
          if (turn) this.emit({ type: "turn-added", loomId: this.id, turn: cloneJson(turn) });
        }
      }
      this.knownTurnIds = currentIds;
    });
  }

  async info(): Promise<LoomInfo<TLoomMeta>> {
    this.assertOpen();
    return cloneJson(this.doc().root);
  }

  async updateMeta(meta: TLoomMeta): Promise<LoomInfo<TLoomMeta>> {
    this.assertOpen();
    assertJsonEncodable(meta, "loom meta");
    this.handle.change((doc) => {
      doc.root.meta = cloneJson(meta) as TLoomMeta;
    });
    const loom = cloneJson(this.doc().root);
    this.emit({ type: "loom-updated", loom });
    return loom;
  }

  async appendTurn(
    parentId: TurnId | null,
    payload: TPayload,
    meta?: TTurnMeta,
  ): Promise<Turn<TPayload, TTurnMeta>> {
    this.assertOpen();
    assertJsonEncodable(payload, "turn payload");
    assertJsonEncodable(meta, "turn meta");
    if (parentId !== null && !this.doc().nodes[parentId]) throw missingParent(parentId);

    const turnId = this.createTurnId();
    if (turnId === ROOT_CHILDREN_KEY || this.doc().nodes[turnId]) throw duplicateTurnId(turnId);

    const turn = omitUndefined({
      id: turnId,
      loomId: this.id,
      parentId,
      payload: cloneJson(payload),
      meta: cloneJson(meta),
      createdAt: this.now(),
    }) as Turn<TPayload, TTurnMeta>;

    this.handle.change((doc) => {
      doc.nodes[turn.id] = turn;
      doc.children[turn.id] ??= [];
      const key = parentKeyOf(parentId);
      doc.children[key] ??= [];
      doc.children[key].push(turn.id);
    });

    return cloneJson(turn);
  }

  async getTurn(turnId: TurnId): Promise<Turn<TPayload, TTurnMeta> | null> {
    this.assertOpen();
    const turn = this.doc().nodes[turnId];
    return turn ? cloneJson(turn) : null;
  }

  async hasTurn(turnId: TurnId): Promise<boolean> {
    this.assertOpen();
    return Boolean(this.doc().nodes[turnId]);
  }

  async childrenOf(parentId: TurnId | null): Promise<Turn<TPayload, TTurnMeta>[]> {
    this.assertOpen();
    const doc = this.doc();
    if (parentId !== null && !doc.nodes[parentId]) throw missingParent(parentId);
    return (doc.children[parentKeyOf(parentId)] ?? []).map((turnId) => {
      const turn = doc.nodes[turnId];
      if (!turn) throw brokenTopology(`Child list references missing turn: ${turnId}`);
      return cloneJson(turn);
    });
  }

  async threadTo(turnId: TurnId): Promise<Turn<TPayload, TTurnMeta>[]> {
    this.assertOpen();
    const doc = this.doc();
    const thread: Turn<TPayload, TTurnMeta>[] = [];
    const seen = new Set<TurnId>();
    let currentId: TurnId | null = turnId;

    while (currentId !== null) {
      if (seen.has(currentId)) throw cycleDetected(currentId);
      seen.add(currentId);
      const turn: Turn<TPayload, TTurnMeta> | undefined = doc.nodes[currentId];
      if (!turn) throw brokenTopology(`Thread references missing turn: ${currentId}`);
      thread.push(turn);
      currentId = turn.parentId;
    }

    return cloneJson(thread.reverse());
  }

  async leaves(): Promise<Turn<TPayload, TTurnMeta>[]> {
    this.assertOpen();
    const doc = this.doc();
    const leaves: Turn<TPayload, TTurnMeta>[] = [];
    const visit = (parentId: TurnId | null) => {
      for (const turnId of doc.children[parentKeyOf(parentId)] ?? []) {
        const turn = doc.nodes[turnId];
        if (!turn) throw brokenTopology(`Child list references missing turn: ${turnId}`);
        if ((doc.children[turnId] ?? []).length === 0) {
          leaves.push(turn);
        } else {
          visit(turnId);
        }
      }
    };
    visit(null);
    return cloneJson(leaves);
  }

  subscribe(listener: LoomListener<TPayload, TLoomMeta, TTurnMeta>): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async export(): Promise<LoomSnapshot<TPayload, TLoomMeta, TTurnMeta>> {
    this.assertOpen();
    const doc = this.doc();
    const turns: Turn<TPayload, TTurnMeta>[] = [];
    const visit = (parentId: TurnId | null) => {
      for (const turnId of doc.children[parentKeyOf(parentId)] ?? []) {
        const turn = doc.nodes[turnId];
        if (!turn) throw brokenTopology(`Child list references missing turn: ${turnId}`);
        turns.push(turn);
        visit(turnId);
      }
    };
    visit(null);
    return cloneJson({ loom: doc.root, turns });
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }

  private doc() {
    return this.handle.doc();
  }

  private assertOpen(): void {
    if (this.closed) throw closedHandle();
  }

  private emit(event: LoomEvent<TPayload, TLoomMeta, TTurnMeta>): void {
    for (const listener of this.listeners) listener(event);
  }
}

function validateSnapshot(snapshot: LoomSnapshot<unknown, unknown, unknown>): void {
  const ids = new Set<TurnId>();
  for (const turn of snapshot.turns) {
    if (turn.id === ROOT_CHILDREN_KEY) throw duplicateTurnId(turn.id);
    if (ids.has(turn.id)) throw duplicateTurnId(turn.id);
    ids.add(turn.id);
  }
  for (const turn of snapshot.turns) {
    if (turn.parentId !== null && !ids.has(turn.parentId)) throw missingParent(turn.parentId);
  }
  for (const turn of snapshot.turns) {
    const seen = new Set<TurnId>();
    let currentId: TurnId | null = turn.id;
    while (currentId !== null) {
      if (seen.has(currentId)) throw cycleDetected(currentId);
      seen.add(currentId);
      const current = snapshot.turns.find((candidate) => candidate.id === currentId);
      if (!current) throw brokenTopology(`Missing turn while validating thread: ${currentId}`);
      currentId = current.parentId;
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
