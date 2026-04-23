import { describe, expect, it } from "bun:test";
import { createMemoryLooms } from "../../../../vendor/loomsync/packages/core/src/memory";
import type { TextPayload } from "../../../../vendor/loomsync/packages/text/src/types";
import type { StoryNode } from "../../types";
import {
  appendStoryContinuations,
  appendStoryNodeRevision,
  materializeStoryTree,
  storyTreeToSnapshot,
  type LoompadStoryLoomMeta,
} from "../storyAdapter";

function createLooms() {
  let nextId = 0;
  return createMemoryLooms<TextPayload, LoompadStoryLoomMeta>({
    createId: () => `turn-${++nextId}`,
    now: () => 1000 + nextId,
  });
}

describe("Loompad story adapter", () => {
  it("exports shared story content without session traversal state", () => {
    const info = {
      id: "loom-1",
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

    const snapshot = storyTreeToSnapshot(tree, info);

    expect(snapshot.turns).toEqual([
      {
        id: "a",
        loomId: "loom-1",
        parentId: null,
        payload: { text: "A" },
        createdAt: 1000,
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("lastSelectedIndex");
  });

  it("appends and materializes a branching story in canonical child order", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story", rootText: "Start" });
    const loom = await looms.open(info.id);

    await appendStoryContinuations(loom, null, [
      { id: "legacy-a", text: "A" },
      { id: "legacy-b", text: "B" },
    ]);

    const [first] = await loom.childrenOf(null);
    await appendStoryContinuations(loom, first.id, [
      { id: "legacy-c", text: "C" },
    ]);

    expect(await materializeStoryTree(loom, "Start")).toEqual({
      root: {
        id: "root",
        text: "Start",
        continuations: [
          {
            id: first.id,
            text: "A",
            continuations: [
              {
                id: "turn-4",
                text: "C",
                continuations: [],
              },
            ],
          },
          {
            id: "turn-3",
            text: "B",
            continuations: [],
          },
        ],
      },
    });
  });

  it("saves edits as a new sibling revision without copying descendants", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story", rootText: "Start" });
    const loom = await looms.open(info.id);

    const original = await loom.appendTurn(null, { text: "Original" });
    await loom.appendTurn(original.id, { text: "Original child" });

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
    const appended = await appendStoryNodeRevision(loom, null, revision);
    const tree = await materializeStoryTree(loom, "Start");

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
          id: "turn-5",
          text: "Split tail",
          continuations: [],
        },
      ],
    });
  });
});
