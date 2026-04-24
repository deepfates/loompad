import type {
  Loom,
  LoomInfo,
  Looms,
  LoomSnapshot,
  Turn,
} from "../../../vendor/loomsync/packages/core/src/types";
import type { TextPayload } from "../../../vendor/loomsync/packages/text/src/types";
import type { StoryNode } from "../types";
import type { StoryLoom, StoryLoomMeta, StoryTurnMeta } from "./storyTypes";

// Compatibility shim: this file maps LoomSync's turn graph back into
// Loompad's older recursive { root, continuations } tree so the current UI can
// keep working during the substrate cutover. That tree erases turn meta such as
// authorship, generation provenance, revision links, reference edges, and
// multi-author activity. New UI for those affordances should read from the
// Loom interface directly instead of extending this shim.

export type LoompadStoryLoomMeta = StoryLoomMeta;
export type LoompadStoryLoom = StoryLoom;

export async function importStoryTree(
  looms: Looms<TextPayload, LoompadStoryLoomMeta, StoryTurnMeta>,
  title: string,
  tree: { root: StoryNode },
): Promise<{
  info: LoomInfo<LoompadStoryLoomMeta>;
  loom: LoompadStoryLoom;
}> {
  const info = await looms.create({ title });
  const importedInfo = await looms.import(storyTreeToSnapshot(tree, info));
  const loom = await looms.open(importedInfo.id);
  return { info: importedInfo, loom };
}

export function storyTreeToSnapshot(
  tree: { root: StoryNode },
  info: LoomInfo<LoompadStoryLoomMeta>,
): LoomSnapshot<TextPayload, LoompadStoryLoomMeta, StoryTurnMeta> {
  const turns: Turn<TextPayload, StoryTurnMeta>[] = [];
  const visit = (node: StoryNode, parentId: string | null) => {
    turns.push({
      id: node.id,
      loomId: info.id,
      parentId,
      payload: { text: node.text },
      meta: { role: "prose" },
      createdAt: info.createdAt,
    });
    for (const child of node.continuations ?? []) visit(child, node.id);
  };

  visit(tree.root, null);
  return { loom: info, turns };
}

export async function materializeStoryTree(
  loom: LoompadStoryLoom,
  fallbackRootText = "",
): Promise<{ root: StoryNode }> {
  const rootTurns = await loom.childrenOf(null);
  // The current UI can render only one root node. Root-level sibling turns are
  // preserved in LoomSync as seed revisions; this shim materializes the latest
  // canonical root sibling until the UI grows an explicit root-revision view.
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

export async function appendStoryNodeChain(
  loom: LoompadStoryLoom,
  parentId: string | null,
  node: StoryNode,
  meta: StoryTurnMeta = { role: "prose" },
): Promise<Turn<TextPayload, StoryTurnMeta>> {
  const appended = await loom.appendTurn(parentId, { text: node.text }, meta);
  for (const child of node.continuations ?? []) {
    await appendStoryNodeChain(loom, appended.id, child, { role: "prose" });
  }
  return appended;
}

export async function appendStoryNodeRevision(
  loom: LoompadStoryLoom,
  parentId: string | null,
  revision: StoryNode,
  revises?: string,
): Promise<Turn<TextPayload, StoryTurnMeta>> {
  return appendStoryNodeChain(loom, parentId, revision, {
    role: "revision",
    revises,
  });
}

export async function appendStoryContinuations(
  loom: LoompadStoryLoom,
  parentId: string | null,
  continuations: StoryNode[],
): Promise<void> {
  for (const continuation of continuations) {
    await appendStoryNodeChain(loom, parentId, continuation);
  }
}

function turnToStoryNode(turn: Turn<TextPayload>): StoryNode {
  return {
    id: turn.id,
    text: turn.payload.text,
    continuations: [],
  };
}
