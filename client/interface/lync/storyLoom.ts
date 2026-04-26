import type { Turn } from "../../../vendor/lync/packages/core/src/types";
import type { TextPayload } from "../../../vendor/lync/packages/text/src/types";
import type { StoryNode } from "../types";
import type { StoryDraft, StoryLoom, StoryTurnMeta } from "./storyTypes";

type StoryTurn = Turn<TextPayload, StoryTurnMeta>;

export async function projectStoryTree(
  loom: StoryLoom,
  fallbackRootText = "",
): Promise<{ root: StoryNode }> {
  const rootTurns = await loom.childrenOf(null);
  // Textile stories are single-root projections. Editing the visible root
  // creates a new loom, so later top-level turns are not treated as root edits.
  const rootTurn = rootTurns[0];
  if (!rootTurn) {
    return {
      root: {
        id: "root",
        text: fallbackRootText,
        continuations: [],
      },
    };
  }

  const rootNode: StoryNode = turnToStoryNode(rootTurn);

  const appendChildren = async (
    parent: StoryNode,
    parentTurn: StoryTurn,
  ) => {
    const children = await loom.childrenOf(parentTurn.id);
    parent.continuations = children.map(turnToStoryNode);
    for (let index = 0; index < children.length; index += 1) {
      const child = parent.continuations[index];
      const childTurn = children[index];
      if (child && childTurn) {
        await appendChildren(child, childTurn);
      }
    }
  };

  await appendChildren(rootNode, rootTurn);
  return { root: rootNode };
}

export async function appendStoryDraftChain(
  loom: StoryLoom,
  parentId: string | null,
  draft: StoryDraft,
  meta: StoryTurnMeta = { role: "prose" },
): Promise<Turn<TextPayload, StoryTurnMeta>> {
  const appended = await loom.appendTurn(parentId, { text: draft.text }, meta);
  for (const child of draft.continuations ?? []) {
    await appendStoryDraftChain(loom, appended.id, child, { role: "prose" });
  }
  return appended;
}

export async function appendStoryRevision(
  loom: StoryLoom,
  parentId: string | null,
  revision: StoryDraft,
  revises?: string,
): Promise<Turn<TextPayload, StoryTurnMeta>> {
  if (parentId === null) {
    throw new Error("Root edits create a new story loom");
  }
  return appendStoryDraftChain(loom, parentId, revision, {
    role: "revision",
    revises,
  });
}

export async function appendStoryDrafts(
  loom: StoryLoom,
  parentId: string | null,
  drafts: StoryDraft[],
): Promise<void> {
  for (const draft of drafts) {
    await appendStoryDraftChain(loom, parentId, draft);
  }
}

function turnToStoryNode(turn: StoryTurn): StoryNode {
  return {
    id: turn.id,
    text: turn.payload.text,
    continuations: [],
  };
}
