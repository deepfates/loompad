import { DocHandle, Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  brokenTopology,
  closedHandle,
  cycleDetected,
  duplicateNodeId,
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
} from "./types.js";

const ROOT_CHILDREN_KEY = "__root__";

type LoomDoc<TPayload, TRootMeta, TNodeMeta> = {
  version: 1;
  root: LoomRoot<TRootMeta>;
  nodes: Record<LoomNodeId, LoomNode<TPayload, TNodeMeta>>;
  children: Record<string, LoomNodeId[]>;
};

export interface AutomergeLoomWorldsOptions {
  repo?: Repo;
  createNodeId?: () => string;
  now?: () => number;
}

export function createAutomergeLoomWorlds<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
>(
  options: AutomergeLoomWorldsOptions = {},
): LoomWorlds<TPayload, TRootMeta, TNodeMeta> {
  const repo = options.repo ?? new Repo();
  const createNodeId = options.createNodeId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => Date.now());

  return {
    async createRoot(meta) {
      assertJsonEncodable(meta, "root meta");
      const handle = repo.create<LoomDoc<TPayload, TRootMeta, TNodeMeta>>({
        version: 1,
        root: {
          id: "" as LoomRootId,
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

    async getRoot(rootId) {
      try {
        const handle = await repo.find<LoomDoc<TPayload, TRootMeta, TNodeMeta>>(
          rootId as AutomergeUrl,
        );
        await handle.whenReady();
        return cloneJson(handle.doc().root);
      } catch {
        return null;
      }
    },

    async openRoot(rootId) {
      let handle: DocHandle<LoomDoc<TPayload, TRootMeta, TNodeMeta>>;
      try {
        handle = await repo.find<LoomDoc<TPayload, TRootMeta, TNodeMeta>>(
          rootId as AutomergeUrl,
        );
        await handle.whenReady();
      } catch {
        throw unknownRoot(rootId);
      }
      return new AutomergeLoomWorld(rootId, handle, createNodeId, now);
    },

    async importRoot(snapshot) {
      validateSnapshot(snapshot);
      const handle = repo.create<LoomDoc<TPayload, TRootMeta, TNodeMeta>>({
        version: 1,
        root: {
          id: "" as LoomRootId,
          ...(snapshot.root.meta === undefined ? {} : { meta: cloneJson(snapshot.root.meta) }),
          createdAt: snapshot.root.createdAt,
        },
        nodes: {},
        children: { [ROOT_CHILDREN_KEY]: [] },
      });
      handle.change((doc) => {
        doc.root.id = handle.url;
        for (const imported of snapshot.nodes) {
          const node = {
            ...cloneJson(imported),
            rootId: handle.url,
          };
          doc.nodes[node.id] = node;
          doc.children[node.id] ??= [];
          const key = parentKeyOf(node.parentId);
          doc.children[key] ??= [];
          doc.children[key].push(node.id);
        }
      });
      return cloneJson(handle.doc().root);
    },
  };
}

class AutomergeLoomWorld<TPayload, TRootMeta, TNodeMeta>
  implements LoomWorld<TPayload, TRootMeta, TNodeMeta>
{
  private closed = false;
  private listeners = new Set<LoomWorldListener<TPayload, TRootMeta, TNodeMeta>>();
  private knownNodeIds: Set<LoomNodeId>;

  constructor(
    readonly id: LoomRootId,
    private readonly handle: DocHandle<LoomDoc<TPayload, TRootMeta, TNodeMeta>>,
    private readonly createNodeId: () => string,
    private readonly now: () => number,
  ) {
    this.knownNodeIds = new Set(Object.keys(this.handle.doc().nodes ?? {}));
    this.handle.on("change", ({ doc }) => {
      const currentIds = new Set(Object.keys(doc.nodes ?? {}));
      for (const nodeId of currentIds) {
        if (!this.knownNodeIds.has(nodeId)) {
          const node = doc.nodes[nodeId];
          if (node) this.emit({ type: "node-added", rootId: this.id, node: cloneJson(node) });
        }
      }
      this.knownNodeIds = currentIds;
    });
  }

  async root(): Promise<LoomRoot<TRootMeta>> {
    this.assertOpen();
    return cloneJson(this.doc().root);
  }

  async updateRootMeta(meta: TRootMeta): Promise<LoomRoot<TRootMeta>> {
    this.assertOpen();
    assertJsonEncodable(meta, "root meta");
    this.handle.change((doc) => {
      doc.root.meta = cloneJson(meta) as TRootMeta;
    });
    const root = cloneJson(this.doc().root);
    this.emit({ type: "root-updated", root });
    return root;
  }

  async appendAfter(
    parentId: LoomNodeId | null,
    payload: TPayload,
    meta?: TNodeMeta,
  ): Promise<LoomNode<TPayload, TNodeMeta>> {
    this.assertOpen();
    assertJsonEncodable(payload, "node payload");
    assertJsonEncodable(meta, "node meta");
    if (parentId !== null && !this.doc().nodes[parentId]) throw missingParent(parentId);

    const nodeId = this.createNodeId();
    if (nodeId === ROOT_CHILDREN_KEY || this.doc().nodes[nodeId]) throw duplicateNodeId(nodeId);

    const node = omitUndefined({
      id: nodeId,
      rootId: this.id,
      parentId,
      payload: cloneJson(payload),
      meta: cloneJson(meta),
      createdAt: this.now(),
    }) as LoomNode<TPayload, TNodeMeta>;

    this.handle.change((doc) => {
      doc.nodes[node.id] = node;
      doc.children[node.id] ??= [];
      const key = parentKeyOf(parentId);
      doc.children[key] ??= [];
      doc.children[key].push(node.id);
    });

    return cloneJson(node);
  }

  async getNode(nodeId: LoomNodeId): Promise<LoomNode<TPayload, TNodeMeta> | null> {
    this.assertOpen();
    const node = this.doc().nodes[nodeId];
    return node ? cloneJson(node) : null;
  }

  async hasNode(nodeId: LoomNodeId): Promise<boolean> {
    this.assertOpen();
    return Boolean(this.doc().nodes[nodeId]);
  }

  async childrenOf(parentId: LoomNodeId | null): Promise<LoomNode<TPayload, TNodeMeta>[]> {
    this.assertOpen();
    const doc = this.doc();
    if (parentId !== null && !doc.nodes[parentId]) throw missingParent(parentId);
    return (doc.children[parentKeyOf(parentId)] ?? []).map((nodeId) => {
      const node = doc.nodes[nodeId];
      if (!node) throw brokenTopology(`Child list references missing node: ${nodeId}`);
      return cloneJson(node);
    });
  }

  async pathTo(nodeId: LoomNodeId): Promise<LoomNode<TPayload, TNodeMeta>[]> {
    this.assertOpen();
    const doc = this.doc();
    const path: LoomNode<TPayload, TNodeMeta>[] = [];
    const seen = new Set<LoomNodeId>();
    let currentId: LoomNodeId | null = nodeId;

    while (currentId !== null) {
      if (seen.has(currentId)) throw cycleDetected(currentId);
      seen.add(currentId);
      const node: LoomNode<TPayload, TNodeMeta> | undefined = doc.nodes[currentId];
      if (!node) throw brokenTopology(`Path references missing node: ${currentId}`);
      path.push(node);
      currentId = node.parentId;
    }

    return cloneJson(path.reverse());
  }

  async leaves(): Promise<LoomNode<TPayload, TNodeMeta>[]> {
    this.assertOpen();
    const doc = this.doc();
    const leaves: LoomNode<TPayload, TNodeMeta>[] = [];
    const visit = (parentId: LoomNodeId | null) => {
      for (const nodeId of doc.children[parentKeyOf(parentId)] ?? []) {
        const node = doc.nodes[nodeId];
        if (!node) throw brokenTopology(`Child list references missing node: ${nodeId}`);
        if ((doc.children[nodeId] ?? []).length === 0) {
          leaves.push(node);
        } else {
          visit(nodeId);
        }
      }
    };
    visit(null);
    return cloneJson(leaves);
  }

  subscribe(listener: LoomWorldListener<TPayload, TRootMeta, TNodeMeta>): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async export(): Promise<LoomSnapshot<TPayload, TRootMeta, TNodeMeta>> {
    this.assertOpen();
    const doc = this.doc();
    const nodes: LoomNode<TPayload, TNodeMeta>[] = [];
    const visit = (parentId: LoomNodeId | null) => {
      for (const nodeId of doc.children[parentKeyOf(parentId)] ?? []) {
        const node = doc.nodes[nodeId];
        if (!node) throw brokenTopology(`Child list references missing node: ${nodeId}`);
        nodes.push(node);
        visit(nodeId);
      }
    };
    visit(null);
    return cloneJson({ root: doc.root, nodes });
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

  private emit(event: LoomWorldEvent<TPayload, TRootMeta, TNodeMeta>): void {
    for (const listener of this.listeners) listener(event);
  }
}

function validateSnapshot(snapshot: LoomSnapshot<unknown, unknown, unknown>): void {
  const ids = new Set<LoomNodeId>();
  for (const node of snapshot.nodes) {
    if (node.id === ROOT_CHILDREN_KEY) throw duplicateNodeId(node.id);
    if (ids.has(node.id)) throw duplicateNodeId(node.id);
    ids.add(node.id);
  }
  for (const node of snapshot.nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) throw missingParent(node.parentId);
  }
  for (const node of snapshot.nodes) {
    const seen = new Set<LoomNodeId>();
    let currentId: LoomNodeId | null = node.id;
    while (currentId !== null) {
      if (seen.has(currentId)) throw cycleDetected(currentId);
      seen.add(currentId);
      const current = snapshot.nodes.find((candidate) => candidate.id === currentId);
      if (!current) throw brokenTopology(`Missing node while validating path: ${currentId}`);
      currentId = current.parentId;
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
