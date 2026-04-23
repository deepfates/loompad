import {
  brokenTopology,
  closedHandle,
  cycleDetected,
  duplicateNodeId,
  invalidSnapshot,
  missingParent,
  unknownRoot,
} from "./errors.js";
import { assertJsonEncodable, cloneJson } from "./json.js";
import type {
  LoomNode,
  LoomNodeId,
  LoomRoot,
  LoomRootId,
  LoomSnapshot,
  LoomWorld,
  LoomWorldEvent,
  LoomWorldListener,
  LoomWorlds,
  CreateLoomWorldsOptions,
  MemoryLoomWorldsOptions,
} from "./types.js";

const ROOT_CHILDREN_KEY = "__root__";

type InternalDoc<TPayload, TRootMeta, TNodeMeta> = {
  root: LoomRoot<TRootMeta>;
  nodes: Map<LoomNodeId, LoomNode<TPayload, TNodeMeta>>;
  children: Map<string, LoomNodeId[]>;
  listeners: Set<LoomWorldListener<TPayload, TRootMeta, TNodeMeta>>;
};

export function createMemoryLoomWorlds<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
>(options: MemoryLoomWorldsOptions = {}): LoomWorlds<TPayload, TRootMeta, TNodeMeta> {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => Date.now());
  const docs = new Map<LoomRootId, InternalDoc<TPayload, TRootMeta, TNodeMeta>>();

  const createDoc = (meta?: TRootMeta): InternalDoc<TPayload, TRootMeta, TNodeMeta> => {
    assertJsonEncodable(meta, "root meta");
    const id = `memory:${createId()}`;
    const root = omitUndefined({
      id,
      meta: cloneJson(meta),
      createdAt: now(),
    });
    return {
      root,
      nodes: new Map(),
      children: new Map([[ROOT_CHILDREN_KEY, []]]),
      listeners: new Set(),
    };
  };

  return {
    async createRoot(meta) {
      const doc = createDoc(meta);
      docs.set(doc.root.id, doc);
      return cloneJson(doc.root);
    },

    async getRoot(rootId) {
      const doc = docs.get(rootId);
      return doc ? cloneJson(doc.root) : null;
    },

    async openRoot(rootId) {
      const doc = docs.get(rootId);
      if (!doc) throw unknownRoot(rootId);
      return new MemoryLoomWorld(rootId, doc, createId, now);
    },

    async importRoot(snapshot) {
      validateSnapshot(snapshot);
      const doc = createDoc(snapshot.root.meta);
      doc.root.createdAt = snapshot.root.createdAt;

      for (const imported of snapshot.nodes) {
        const node = omitUndefined({
          ...cloneJson(imported),
          rootId: doc.root.id,
        });
        doc.nodes.set(node.id, node);
        const parentKey = parentKeyOf(node.parentId);
        const siblings = doc.children.get(parentKey) ?? [];
        siblings.push(node.id);
        doc.children.set(parentKey, siblings);
        if (!doc.children.has(node.id)) doc.children.set(node.id, []);
      }

      docs.set(doc.root.id, doc);
      return cloneJson(doc.root);
    },
  };
}

export function createLoomWorlds<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
>(
  options: CreateLoomWorldsOptions = {},
): LoomWorlds<TPayload, TRootMeta, TNodeMeta> {
  if (options.backend && options.backend !== "memory") {
    throw new Error(`Unsupported LoomSync backend: ${options.backend}`);
  }
  return createMemoryLoomWorlds<TPayload, TRootMeta, TNodeMeta>(options);
}

class MemoryLoomWorld<TPayload, TRootMeta, TNodeMeta>
  implements LoomWorld<TPayload, TRootMeta, TNodeMeta>
{
  private closed = false;

  constructor(
    readonly id: LoomRootId,
    private readonly doc: InternalDoc<TPayload, TRootMeta, TNodeMeta>,
    private readonly createId: () => string,
    private readonly now: () => number,
  ) {}

  async root(): Promise<LoomRoot<TRootMeta>> {
    this.assertOpen();
    return cloneJson(this.doc.root);
  }

  async updateRootMeta(meta: TRootMeta): Promise<LoomRoot<TRootMeta>> {
    this.assertOpen();
    assertJsonEncodable(meta, "root meta");
    this.doc.root = omitUndefined({
      ...this.doc.root,
      meta: cloneJson(meta),
    });
    this.emit({ type: "root-updated", root: cloneJson(this.doc.root) });
    return cloneJson(this.doc.root);
  }

  async appendAfter(
    parentId: LoomNodeId | null,
    payload: TPayload,
    meta?: TNodeMeta,
  ): Promise<LoomNode<TPayload, TNodeMeta>> {
    this.assertOpen();
    assertJsonEncodable(payload, "node payload");
    assertJsonEncodable(meta, "node meta");
    if (parentId !== null && !this.doc.nodes.has(parentId)) throw missingParent(parentId);

    const nodeId = this.createId();
    if (nodeId === ROOT_CHILDREN_KEY) throw duplicateNodeId(nodeId);
    if (this.doc.nodes.has(nodeId)) throw duplicateNodeId(nodeId);

    const node = omitUndefined({
      id: nodeId,
      rootId: this.id,
      parentId,
      payload: cloneJson(payload),
      meta: cloneJson(meta),
      createdAt: this.now(),
    });

    this.doc.nodes.set(node.id, node);
    if (!this.doc.children.has(node.id)) this.doc.children.set(node.id, []);
    const key = parentKeyOf(parentId);
    const siblings = this.doc.children.get(key) ?? [];
    siblings.push(node.id);
    this.doc.children.set(key, siblings);

    const output = cloneJson(node);
    this.emit({ type: "node-added", rootId: this.id, node: output });
    return output;
  }

  async getNode(nodeId: LoomNodeId): Promise<LoomNode<TPayload, TNodeMeta> | null> {
    this.assertOpen();
    const node = this.doc.nodes.get(nodeId);
    return node ? cloneJson(node) : null;
  }

  async hasNode(nodeId: LoomNodeId): Promise<boolean> {
    this.assertOpen();
    return this.doc.nodes.has(nodeId);
  }

  async childrenOf(parentId: LoomNodeId | null): Promise<LoomNode<TPayload, TNodeMeta>[]> {
    this.assertOpen();
    if (parentId !== null && !this.doc.nodes.has(parentId)) throw missingParent(parentId);
    return (this.doc.children.get(parentKeyOf(parentId)) ?? []).map((id) => {
      const node = this.doc.nodes.get(id);
      if (!node) throw brokenTopology(`Child list references missing node: ${id}`);
      return cloneJson(node);
    });
  }

  async pathTo(nodeId: LoomNodeId): Promise<LoomNode<TPayload, TNodeMeta>[]> {
    this.assertOpen();
    const path: LoomNode<TPayload, TNodeMeta>[] = [];
    const seen = new Set<LoomNodeId>();
    let currentId: LoomNodeId | null = nodeId;

    while (currentId !== null) {
      if (seen.has(currentId)) throw cycleDetected(currentId);
      seen.add(currentId);

      const node = this.doc.nodes.get(currentId);
      if (!node) throw brokenTopology(`Path references missing node: ${currentId}`);
      path.push(node);
      currentId = node.parentId;
    }

    return cloneJson(path.reverse());
  }

  async leaves(): Promise<LoomNode<TPayload, TNodeMeta>[]> {
    this.assertOpen();
    const leaves: LoomNode<TPayload, TNodeMeta>[] = [];
    const visit = (parentId: LoomNodeId | null) => {
      const childIds = this.doc.children.get(parentKeyOf(parentId)) ?? [];
      for (const childId of childIds) {
        const grandchildren = this.doc.children.get(childId) ?? [];
        const node = this.doc.nodes.get(childId);
        if (!node) throw brokenTopology(`Child list references missing node: ${childId}`);
        if (grandchildren.length === 0) {
          leaves.push(node);
        } else {
          visit(childId);
        }
      }
    };
    visit(null);
    return cloneJson(leaves);
  }

  subscribe(listener: LoomWorldListener<TPayload, TRootMeta, TNodeMeta>): () => void {
    this.assertOpen();
    this.doc.listeners.add(listener);
    return () => {
      this.doc.listeners.delete(listener);
    };
  }

  async export(): Promise<LoomSnapshot<TPayload, TRootMeta, TNodeMeta>> {
    this.assertOpen();
    const nodes: LoomNode<TPayload, TNodeMeta>[] = [];
    const visit = (parentId: LoomNodeId | null) => {
      for (const childId of this.doc.children.get(parentKeyOf(parentId)) ?? []) {
        const node = this.doc.nodes.get(childId);
        if (!node) throw brokenTopology(`Child list references missing node: ${childId}`);
        nodes.push(node);
        visit(childId);
      }
    };
    visit(null);
    return cloneJson({ root: this.doc.root, nodes });
  }

  close(): void {
    this.closed = true;
  }

  private assertOpen() {
    if (this.closed) throw closedHandle();
  }

  private emit(event: LoomWorldEvent<TPayload, TRootMeta, TNodeMeta>) {
    for (const listener of this.doc.listeners) listener(event);
  }
}

function validateSnapshot(snapshot: LoomSnapshot<unknown, unknown, unknown>): void {
  if (!snapshot || typeof snapshot !== "object") throw invalidSnapshot("Snapshot must be an object");
  if (!snapshot.root || typeof snapshot.root.id !== "string") {
    throw invalidSnapshot("Snapshot root must include a string id");
  }
  if (!Array.isArray(snapshot.nodes)) throw invalidSnapshot("Snapshot nodes must be an array");
  assertJsonEncodable(snapshot, "snapshot");

  const ids = new Set<LoomNodeId>();
  for (const node of snapshot.nodes) {
    if (!node || typeof node.id !== "string") throw invalidSnapshot("Every node needs a string id");
    if (node.id === ROOT_CHILDREN_KEY) throw invalidSnapshot(`${ROOT_CHILDREN_KEY} is reserved`);
    if (ids.has(node.id)) throw duplicateNodeId(node.id);
    if (node.rootId !== snapshot.root.id) {
      throw invalidSnapshot(`Node ${node.id} belongs to ${node.rootId}, expected ${snapshot.root.id}`);
    }
    ids.add(node.id);
  }

  for (const node of snapshot.nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) throw missingParent(node.parentId);
  }

  for (const node of snapshot.nodes) {
    const seen = new Set<LoomNodeId>();
    let current: LoomNodeId | null = node.id;
    while (current !== null) {
      if (seen.has(current)) throw cycleDetected(current);
      seen.add(current);
      const currentNode = snapshot.nodes.find((candidate) => candidate.id === current);
      if (!currentNode) throw brokenTopology(`Missing node while validating path: ${current}`);
      current = currentNode.parentId;
    }
  }
}

function parentKeyOf(parentId: LoomNodeId | null): string {
  return parentId ?? ROOT_CHILDREN_KEY;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
