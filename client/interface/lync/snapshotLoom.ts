import type {
  Loom,
  LoomInfo,
  LoomListener,
  LoomSnapshot,
  Turn,
  TurnId,
} from "@deepfates/lync";

/**
 * Read an immutable Loom snapshot without transcribing it into another event
 * store. Raw `.lync` archives use this in explicit local-review mode: the
 * source file remains the authority and Textile provides only a session view.
 */
export function readOnlySnapshotLoom<TPayload, TLoomMeta, TTurnMeta>(
  snapshot: LoomSnapshot<TPayload, TLoomMeta, TTurnMeta>,
): Loom<TPayload, TLoomMeta, TTurnMeta> {
  const byId = new Map(snapshot.turns.map((turn) => [turn.id, turn]));
  const children = new Map<TurnId | null, Turn<TPayload, TTurnMeta>[]>();
  for (const turn of snapshot.turns) {
    const bucket = children.get(turn.parentId) ?? [];
    bucket.push(turn);
    children.set(turn.parentId, bucket);
  }
  const readOnly = () => {
    throw new Error(
      "This local raw-Lync review is read-only; the source archive was not copied into Textile's mutable Loom store.",
    );
  };

  return {
    id: snapshot.loom.id,
    async info() {
      return snapshot.loom;
    },
    async updateMeta(_meta: TLoomMeta): Promise<LoomInfo<TLoomMeta>> {
      return readOnly();
    },
    async appendTurn(
      _parentId: TurnId | null,
      _payload: TPayload,
      _meta?: TTurnMeta,
    ): Promise<Turn<TPayload, TTurnMeta>> {
      return readOnly();
    },
    async getTurn(turnId) {
      return byId.get(turnId) ?? null;
    },
    async hasTurn(turnId) {
      return byId.has(turnId);
    },
    async childrenOf(parentId) {
      return children.get(parentId) ?? [];
    },
    async threadTo(turnId) {
      const thread: Turn<TPayload, TTurnMeta>[] = [];
      const seen = new Set<TurnId>();
      let current = byId.get(turnId);
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        thread.push(current);
        current = current.parentId === null ? undefined : byId.get(current.parentId);
      }
      return thread.reverse();
    },
    async leaves() {
      return snapshot.turns.filter((turn) => (children.get(turn.id)?.length ?? 0) === 0);
    },
    subscribe(_listener: LoomListener<TPayload, TLoomMeta, TTurnMeta>) {
      return () => {};
    },
    async export() {
      return snapshot;
    },
    close() {},
  };
}
