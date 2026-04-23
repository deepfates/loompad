import type {
  Loom,
  LoomInfo,
  Looms,
  LoomSnapshot,
  Turn,
} from "../../../vendor/loomsync/packages/core/src/types";
import type { TextPayload } from "../../../vendor/loomsync/packages/text/src/types";
import type { StoryNode } from "../types";
import type { StoryLoom, StoryLoomMeta } from "./storyTypes";

export type LoompadStoryLoomMeta = StoryLoomMeta;
export type LoompadStoryLoom = StoryLoom;

export async function importStoryTree(
  looms: Looms<TextPayload, LoompadStoryLoomMeta>,
  title: string,
  tree: { root: StoryNode },
): Promise<{
  info: LoomInfo<LoompadStoryLoomMeta>;
  loom: LoompadStoryLoom;
}> {
  const info = await looms.create({ title, rootText: tree.root.text });
  const importedInfo = await looms.import(storyTreeToSnapshot(tree, info));
  const loom = await looms.open(importedInfo.id);
  return { info: importedInfo, loom };
}

export function storyTreeToSnapshot(
  tree: { root: StoryNode },
  info: LoomInfo<LoompadStoryLoomMeta>,
): LoomSnapshot<TextPayload, LoompadStoryLoomMeta> {
  const turns: Turn<TextPayload>[] = [];
  const visit = (node: StoryNode, parentId: string | null) => {
    turns.push({
      id: node.id,
      loomId: info.id,
      parentId,
      payload: { text: node.text },
      createdAt: info.createdAt,
    });
    for (const child of node.continuations ?? []) visit(child, node.id);
  };

  for (const child of tree.root.continuations ?? []) visit(child, null);
  return { loom: info, turns };
}

export async function materializeStoryTree(
  loom: LoompadStoryLoom,
  rootText: string,
): Promise<{ root: StoryNode }> {
  const rootNode: StoryNode = {
    id: "root",
    text: rootText,
    continuations: [],
  };

  const appendChildren = async (parent: StoryNode, parentId: string | null) => {
    const children = await loom.childrenOf(parentId);
    parent.continuations = children.map((child) => ({
      id: child.id,
      text: child.payload.text,
      continuations: [],
    }));
    for (const child of parent.continuations) {
      await appendChildren(child, child.id);
    }
  };

  await appendChildren(rootNode, null);
  return { root: rootNode };
}

export async function appendStoryNodeChain(
  loom: LoompadStoryLoom,
  parentId: string | null,
  node: StoryNode,
): Promise<Turn<TextPayload>> {
  const appended = await loom.appendTurn(parentId, { text: node.text });
  for (const child of node.continuations ?? []) {
    await appendStoryNodeChain(loom, appended.id, child);
  }
  return appended;
}

export async function appendStoryNodeRevision(
  loom: LoompadStoryLoom,
  parentId: string | null,
  revision: StoryNode,
): Promise<Turn<TextPayload>> {
  return appendStoryNodeChain(loom, parentId, revision);
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
