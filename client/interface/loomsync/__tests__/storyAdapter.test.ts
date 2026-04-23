import { describe, expect, it } from "bun:test";
import { createMemoryLoomWorlds } from "../../../../vendor/loomsync/packages/core/src/memory";
import type { TextPayload } from "../../../../vendor/loomsync/packages/text/src/types";
import type { StoryNode } from "../../types";
import {
  appendStoryContinuations,
  appendStoryNodeRevision,
  materializeStoryTree,
  storyTreeToSnapshot,
  type LoompadStoryRootMeta,
} from "../storyAdapter";

function createWorlds() {
  let nextId = 0;
  return createMemoryLoomWorlds<TextPayload, LoompadStoryRootMeta>({
    createId: () => `node-${++nextId}`,
    now: () => 1000 + nextId,
  });
}

describe("Loompad story adapter", () => {
  it("exports shared story content without session traversal state", () => {
    const root = {
      id: "root-1",
      meta: { title: "Draft", rootText: "Start" },
      createdAt: 1000,
    };
    const tree = {
      root: {
        id: "root",
        text: "Start",
        lastSelectedIndex: 1,
        continuations: [
          { id: "a", text: "A", continuations: [], lastSelectedIndex: 2 },
        ],
      },
    };

    const snapshot = storyTreeToSnapshot(tree, root);

    expect(snapshot.nodes).toEqual([
      {
        id: "a",
        rootId: "root-1",
        parentId: null,
        payload: { text: "A" },
        createdAt: 1000,
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("lastSelectedIndex");
  });

  it("appends and materializes a branching story in canonical child order", async () => {
    const worlds = createWorlds();
    const root = await worlds.createRoot({ title: "Story", rootText: "Start" });
    const world = await worlds.openRoot(root.id);

    await appendStoryContinuations(world, null, [
      { id: "legacy-a", text: "A" },
      { id: "legacy-b", text: "B" },
    ]);

    const [first] = await world.childrenOf(null);
    await appendStoryContinuations(world, first.id, [
      { id: "legacy-c", text: "C" },
    ]);

    expect(await materializeStoryTree(world, "Start")).toEqual({
      root: {
        id: "root",
        text: "Start",
        continuations: [
          {
            id: first.id,
            text: "A",
            continuations: [
              {
                id: "node-4",
                text: "C",
                continuations: [],
              },
            ],
          },
          {
            id: "node-3",
            text: "B",
            continuations: [],
          },
        ],
      },
    });
  });

  it("saves edits as a new sibling revision without copying descendants", async () => {
    const worlds = createWorlds();
    const root = await worlds.createRoot({ title: "Story", rootText: "Start" });
    const world = await worlds.openRoot(root.id);

    const original = await world.appendAfter(null, { text: "Original" });
    await world.appendAfter(original.id, { text: "Original child" });

    const revision: StoryNode = {
      id: "ignored",
      text: "Edited",
      continuations: [
        {
          id: "ignored-child",
          text: "Split tail",
          continuations: [],
        },
      ],
    };
    const appended = await appendStoryNodeRevision(world, null, revision);
    const tree = await materializeStoryTree(world, "Start");

    expect(tree.root.continuations?.map((node) => node.text)).toEqual([
      "Original",
      "Edited",
    ]);
    expect(tree.root.continuations?.[0].continuations?.map((node) => node.text))
      .toEqual(["Original child"]);
    expect(tree.root.continuations?.[1]).toEqual({
      id: appended.id,
      text: "Edited",
      continuations: [
        {
          id: "node-5",
          text: "Split tail",
          continuations: [],
        },
      ],
    });
  });
});
