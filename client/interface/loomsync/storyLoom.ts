import type { Turn } from "../../../vendor/loomsync/packages/core/src/types";
import type { TextPayload } from "../../../vendor/loomsync/packages/text/src/types";
import type { StoryNode } from "../types";
import type { StoryDraft, StoryLoom, StoryTurnMeta } from "./storyTypes";

export async function projectStoryTree(
  loom: StoryLoom,
  fallbackRootText = "",
): Promise<{ root: StoryNode }> {
  const rootTurns = await loom.childrenOf(null);
  // The reader/minimap is a single-root projection. Root-level sibling turns
  // remain in LoomSync as seed revisions; the UI currently displays the latest
  // canonical root sibling.
  const rootTurn = rootTurns.at(-1);
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

  const appendChildren = async (parent: StoryNode, parentId: string) => {
    const children = await loom.childrenOf(parentId);
    parent.continuations = children.map(turnToStoryNode);
    for (const child of parent.continuations) {
      await appendChildren(child, child.id);
    }
  };

  await appendChildren(rootNode, rootTurn.id);
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

function turnToStoryNode(turn: Turn<TextPayload>): StoryNode {
  return {
    id: turn.id,
    text: turn.payload.text,
    continuations: [],
  };
}
