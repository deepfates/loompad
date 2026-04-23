import type {
  LoomNode,
  LoomNodeId,
  LoomRoot,
  LoomSnapshot,
  LoomWorld,
} from "../../core/src/index";
import type { StoryNode, StoryPathNode, TextPayload } from "./types.js";

export function flattenPath(nodes: LoomNode<TextPayload>[]): string {
  return nodes.map((node) => node.payload.text).join("");
}

export function pathToStoryNodes(nodes: LoomNode<TextPayload>[]): StoryPathNode[] {
  return nodes.map((node) => ({
    id: node.id,
    text: node.payload.text,
  }));
}

export async function appendChain<TNodeMeta = unknown>(
  world: LoomWorld<TextPayload, unknown, TNodeMeta>,
  parentId: LoomNodeId | null,
  chunks: TextPayload[],
  meta?: TNodeMeta,
): Promise<LoomNode<TextPayload, TNodeMeta>[]> {
  const appended: LoomNode<TextPayload, TNodeMeta>[] = [];
  let currentParent = parentId;
  for (const chunk of chunks) {
    const node = await world.appendAfter(currentParent, chunk, meta);
    appended.push(node);
    currentParent = node.id;
  }
  return appended;
}

export function snapshotFromNestedStory<TRootMeta = unknown>(
  tree: { root: StoryNode },
  root: LoomRoot<TRootMeta>,
): LoomSnapshot<TextPayload, TRootMeta> {
  const nodes: LoomNode<TextPayload>[] = [];

  const visit = (node: StoryNode, parentId: LoomNodeId | null) => {
    nodes.push({
      id: node.id,
      rootId: root.id,
      parentId,
      payload: { text: node.text },
      createdAt: root.createdAt,
    });

    for (const child of node.continuations ?? []) {
      visit(child, node.id);
    }
  };

  for (const child of tree.root.continuations ?? []) {
    visit(child, null);
  }

  return { root, nodes };
}
