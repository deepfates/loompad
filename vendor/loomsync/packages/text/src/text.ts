import type {
  Loom,
  LoomInfo,
  LoomSnapshot,
  Turn,
  TurnId,
} from "../../core/src/index";
import type { StoryNode, StoryThreadTurn, TextPayload } from "./types.js";

export function flattenThread(turns: Turn<TextPayload>[]): string {
  return turns.map((turn) => turn.payload.text).join("");
}

export function threadToStoryTurns(turns: Turn<TextPayload>[]): StoryThreadTurn[] {
  return turns.map((turn) => ({
    id: turn.id,
    text: turn.payload.text,
  }));
}

export async function appendChain<TTurnMeta = unknown>(
  loom: Loom<TextPayload, unknown, TTurnMeta>,
  parentId: TurnId | null,
  chunks: TextPayload[],
  meta?: TTurnMeta,
): Promise<Turn<TextPayload, TTurnMeta>[]> {
  const appended: Turn<TextPayload, TTurnMeta>[] = [];
  let currentParent = parentId;
  for (const chunk of chunks) {
    const turn = await loom.appendTurn(currentParent, chunk, meta);
    appended.push(turn);
    currentParent = turn.id;
  }
  return appended;
}

export function snapshotFromNestedStory<TLoomMeta = unknown>(
  tree: { root: StoryNode },
  loom: LoomInfo<TLoomMeta>,
): LoomSnapshot<TextPayload, TLoomMeta> {
  const turns: Turn<TextPayload>[] = [];

  const visit = (node: StoryNode, parentId: TurnId | null) => {
    turns.push({
      id: node.id,
      loomId: loom.id,
      parentId,
      payload: { text: node.text },
      createdAt: loom.createdAt,
    });

    for (const child of node.continuations ?? []) {
      visit(child, node.id);
    }
  };

  for (const child of tree.root.continuations ?? []) {
    visit(child, null);
  }

  return { loom, turns };
}
