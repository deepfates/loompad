import {
  createAutomergeLoomWorlds,
} from "../../../vendor/loomsync/packages/core/src/automerge";
import type {
  LoomNode,
  LoomRoot,
  LoomSnapshot,
  LoomWorld,
  LoomWorlds,
} from "../../../vendor/loomsync/packages/core/src/types";
import type {
  TextPayload,
} from "../../../vendor/loomsync/packages/text/src/types";
import type { StoryNode } from "../types";

export type LoompadStoryRootMeta = {
  title: string;
};

export type LoompadStoryWorld = LoomWorld<TextPayload, LoompadStoryRootMeta>;

export function createLoompadStoryWorlds() {
  return createAutomergeLoomWorlds<TextPayload, LoompadStoryRootMeta>();
}

export async function createWorldFromStoryTree(
  title: string,
  tree: { root: StoryNode },
): Promise<{
  root: LoomRoot<LoompadStoryRootMeta>;
  world: LoompadStoryWorld;
}> {
  const worlds = createLoompadStoryWorlds();
  return importStoryTree(worlds, title, tree);
}

export async function importStoryTree(
  worlds: LoomWorlds<TextPayload, LoompadStoryRootMeta>,
  title: string,
  tree: { root: StoryNode },
): Promise<{
  root: LoomRoot<LoompadStoryRootMeta>;
  world: LoompadStoryWorld;
}> {
  const root = await worlds.createRoot({ title });
  const snapshot = storyTreeToSnapshot(tree, root);
  const importedRoot = await worlds.importRoot(snapshot);
  const world = await worlds.openRoot(importedRoot.id);
  return { root: importedRoot, world };
}

export function storyTreeToSnapshot(
  tree: { root: StoryNode },
  root: LoomRoot<LoompadStoryRootMeta>,
): LoomSnapshot<TextPayload, LoompadStoryRootMeta> {
  const nodes: LoomNode<TextPayload>[] = [];
  const visit = (node: StoryNode, parentId: string | null) => {
    nodes.push({
      id: node.id,
      rootId: root.id,
      parentId,
      payload: { text: node.text },
      createdAt: root.createdAt,
    });
    for (const child of node.continuations ?? []) visit(child, node.id);
  };

  for (const child of tree.root.continuations ?? []) visit(child, null);
  return { root, nodes };
}

export async function materializeStoryTree(
  world: LoompadStoryWorld,
  rootText: string,
): Promise<{ root: StoryNode }> {
  const rootNode: StoryNode = {
    id: "root",
    text: rootText,
    continuations: [],
  };

  const appendChildren = async (parent: StoryNode, parentId: string | null) => {
    const children = await world.childrenOf(parentId);
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
  world: LoompadStoryWorld,
  parentId: string | null,
  node: StoryNode,
): Promise<LoomNode<TextPayload>> {
  const appended = await world.appendAfter(parentId, { text: node.text });
  for (const child of node.continuations ?? []) {
    await appendStoryNodeChain(world, appended.id, child);
  }
  return appended;
}

export async function appendStoryContinuations(
  world: LoompadStoryWorld,
  parentId: string | null,
  continuations: StoryNode[],
): Promise<void> {
  for (const continuation of continuations) {
    await appendStoryNodeChain(world, parentId, continuation);
  }
}
