export type LoomRootId = string;
export type LoomNodeId = string;

export interface LoomRoot<TRootMeta = unknown> {
  id: LoomRootId;
  meta?: TRootMeta;
  createdAt: number;
}

export interface LoomNode<TPayload = unknown, TNodeMeta = unknown> {
  id: LoomNodeId;
  rootId: LoomRootId;
  parentId: LoomNodeId | null;
  payload: TPayload;
  meta?: TNodeMeta;
  createdAt: number;
}

export interface LoomSnapshot<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
> {
  root: LoomRoot<TRootMeta>;
  nodes: LoomNode<TPayload, TNodeMeta>[];
}

export type LoomWorldEvent<TPayload, TRootMeta, TNodeMeta> =
  | {
      type: "node-added";
      rootId: LoomRootId;
      node: LoomNode<TPayload, TNodeMeta>;
    }
  | {
      type: "root-updated";
      root: LoomRoot<TRootMeta>;
    }
  | {
      type: "sync-state";
      rootId: LoomRootId;
      online: boolean;
      syncing: boolean;
    };

export type LoomWorldListener<TPayload, TRootMeta, TNodeMeta> = (
  event: LoomWorldEvent<TPayload, TRootMeta, TNodeMeta>,
) => void;

export interface LoomWorld<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
> {
  id: LoomRootId;

  root(): Promise<LoomRoot<TRootMeta>>;
  updateRootMeta(meta: TRootMeta): Promise<LoomRoot<TRootMeta>>;

  appendAfter(
    parentId: LoomNodeId | null,
    payload: TPayload,
    meta?: TNodeMeta,
  ): Promise<LoomNode<TPayload, TNodeMeta>>;

  getNode(nodeId: LoomNodeId): Promise<LoomNode<TPayload, TNodeMeta> | null>;
  hasNode(nodeId: LoomNodeId): Promise<boolean>;

  childrenOf(parentId: LoomNodeId | null): Promise<LoomNode<TPayload, TNodeMeta>[]>;
  pathTo(nodeId: LoomNodeId): Promise<LoomNode<TPayload, TNodeMeta>[]>;
  leaves(): Promise<LoomNode<TPayload, TNodeMeta>[]>;

  subscribe(listener: LoomWorldListener<TPayload, TRootMeta, TNodeMeta>): () => void;
  export(): Promise<LoomSnapshot<TPayload, TRootMeta, TNodeMeta>>;
  close(): void;
}

export interface LoomWorlds<
  TPayload = unknown,
  TRootMeta = unknown,
  TNodeMeta = unknown,
> {
  createRoot(meta?: TRootMeta): Promise<LoomRoot<TRootMeta>>;
  getRoot(rootId: LoomRootId): Promise<LoomRoot<TRootMeta> | null>;
  openRoot(rootId: LoomRootId): Promise<LoomWorld<TPayload, TRootMeta, TNodeMeta>>;
  importRoot(
    snapshot: LoomSnapshot<TPayload, TRootMeta, TNodeMeta>,
  ): Promise<LoomRoot<TRootMeta>>;
}

export interface MemoryLoomWorldsOptions {
  createId?: () => string;
  now?: () => number;
}

export interface CreateLoomWorldsOptions extends MemoryLoomWorldsOptions {
  backend?: "memory";
}
