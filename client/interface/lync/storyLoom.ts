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
  // The reader/minimap is a single-root projection. Root-level sibling turns
  // remain in Lync as seed revisions; the UI currently displays the latest
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

  const appendChildren = async (
    parent: StoryNode,
    parentTurn: StoryTurn,
    isProjectedRoot = false,
  ) => {
    const children = isProjectedRoot
      ? await visibleRootChildren(loom, parentTurn)
      : await loom.childrenOf(parentTurn.id);
    parent.continuations = children.map(turnToStoryNode);
    for (let index = 0; index < children.length; index += 1) {
      const child = parent.continuations[index];
      const childTurn = children[index];
      if (child && childTurn) {
        await appendChildren(child, childTurn);
      }
    }
  };

  await appendChildren(rootNode, rootTurn, true);
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

async function visibleRootChildren(
  loom: StoryLoom,
  rootTurn: StoryTurn,
): Promise<StoryTurn[]> {
  const children: StoryTurn[] = [];
  const childIds = new Set<string>();
  const visitedRoots = new Set<string>([rootTurn.id]);

  const addChildrenFrom = async (turn: StoryTurn) => {
    // Root edits are replacement seeds in the Textile projection. Keep their
    // own child chain first, then inherit branch choices from earlier seed
    // revisions without moving or copying any stored turns.
    for (const child of await loom.childrenOf(turn.id)) {
      if (childIds.has(child.id)) continue;
      childIds.add(child.id);
      children.push(child);
    }

    const revises = turn.meta?.role === "revision" ? turn.meta.revises : null;
    if (!revises || visitedRoots.has(revises)) return;

    const revised = await loom.getTurn(revises);
    if (!revised || revised.parentId !== null) return;

    visitedRoots.add(revises);
    await addChildrenFrom(revised);
  };

  await addChildrenFrom(rootTurn);
  return children;
}

function turnToStoryNode(turn: StoryTurn): StoryNode {
  return {
    id: turn.id,
    text: turn.payload.text,
    continuations: [],
  };
}
