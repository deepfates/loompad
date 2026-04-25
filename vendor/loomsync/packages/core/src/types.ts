export type LoomId = string;
export type TurnId = string;
export type IndexId = string;

export interface LoomInfo<TMeta = unknown> {
  id: LoomId;
  meta?: TMeta;
  createdAt: number;
}

export interface Turn<TPayload = unknown, TMeta = unknown> {
  id: TurnId;
  loomId: LoomId;
  parentId: TurnId | null;
  payload: TPayload;
  meta?: TMeta;
  createdAt: number;
}

export interface LoomSnapshot<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
> {
  loom: LoomInfo<TLoomMeta>;
  turns: Turn<TPayload, TTurnMeta>[];
}

export type LoomReference =
  | { v: 1; kind: "loom"; loomId: LoomId }
  | { v: 1; kind: "turn"; loomId: LoomId; turnId: TurnId }
  | { v: 1; kind: "thread"; loomId: LoomId; turnId: TurnId }
  | { v: 1; kind: "index"; indexId: IndexId };

export type LoomEvent<TPayload, TLoomMeta, TTurnMeta> =
  | {
      type: "turn-added";
      loomId: LoomId;
      turn: Turn<TPayload, TTurnMeta>;
    }
  | {
      type: "loom-updated";
      loom: LoomInfo<TLoomMeta>;
    }
  | {
      type: "sync-state";
      loomId: LoomId;
      online: boolean;
      syncing: boolean;
    };

export type LoomListener<TPayload, TLoomMeta, TTurnMeta> = (
  event: LoomEvent<TPayload, TLoomMeta, TTurnMeta>,
) => void;

export interface Loom<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
> {
  id: LoomId;

  info(): Promise<LoomInfo<TLoomMeta>>;
  updateMeta(meta: TLoomMeta): Promise<LoomInfo<TLoomMeta>>;

  appendTurn(
    parentId: TurnId | null,
    payload: TPayload,
    meta?: TTurnMeta,
  ): Promise<Turn<TPayload, TTurnMeta>>;

  getTurn(turnId: TurnId): Promise<Turn<TPayload, TTurnMeta> | null>;
  hasTurn(turnId: TurnId): Promise<boolean>;

  childrenOf(parentId: TurnId | null): Promise<Turn<TPayload, TTurnMeta>[]>;
  threadTo(turnId: TurnId): Promise<Turn<TPayload, TTurnMeta>[]>;
  leaves(): Promise<Turn<TPayload, TTurnMeta>[]>;

  subscribe(listener: LoomListener<TPayload, TLoomMeta, TTurnMeta>): () => void;
  export(): Promise<LoomSnapshot<TPayload, TLoomMeta, TTurnMeta>>;
  close(): void;
}

export interface Looms<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
> {
  create(meta?: TLoomMeta): Promise<LoomInfo<TLoomMeta>>;
  get(loomId: LoomId): Promise<LoomInfo<TLoomMeta> | null>;
  open(loomId: LoomId): Promise<Loom<TPayload, TLoomMeta, TTurnMeta>>;
  import(
    snapshot: LoomSnapshot<TPayload, TLoomMeta, TTurnMeta>,
  ): Promise<LoomInfo<TLoomMeta>>;
}

export interface MemoryLoomsOptions {
  createId?: () => string;
  now?: () => number;
}
