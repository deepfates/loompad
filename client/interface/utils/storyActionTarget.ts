import type { StoryNode } from "../types";

export interface StoryActionTarget {
  loomId: string;
  title: string;
  rootTurnId: string;
  sourceEventIds: string[];
  tree: { root: StoryNode };
}

/**
 * Bind a Stories-row action to one exact loom projection.
 *
 * Titles are presentation only and may collide. The row's loom id selects the
 * catalog tree; when that row is current, the visible reader must be that same
 * object. Refuse a stale mixed snapshot instead of exporting a plausible but
 * different story.
 */
export function resolveStoryActionTarget(
  key: string,
  state: {
    trees: Record<string, { root: StoryNode }>;
    titles: Record<string, string>;
    currentLoomId: string;
    visibleTree: { root: StoryNode };
  },
): StoryActionTarget {
  if (!Object.prototype.hasOwnProperty.call(state.trees, key)) {
    throw new Error(`Story action target is no longer available: ${key}`);
  }
  const tree = state.trees[key]!;
  if (key === state.currentLoomId && tree !== state.visibleTree) {
    throw new Error(
      "Story identity changed while its actions were open. Close Stories and try again.",
    );
  }
  return {
    loomId: key,
    title: state.titles[key] ?? key,
    rootTurnId: tree.root.id,
    sourceEventIds: collectSourceIds(tree.root),
    tree,
  };
}

function collectSourceIds(root: StoryNode): string[] {
  const ids: string[] = [];
  const visit = (node: StoryNode) => {
    if (node.sourceId) ids.push(node.sourceId);
    for (const child of node.continuations ?? []) visit(child);
  };
  visit(root);
  return [...new Set(ids)].sort();
}
