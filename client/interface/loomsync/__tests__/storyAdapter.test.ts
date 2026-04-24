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
import type { StoryTurnMeta } from "../storyTypes";

function createLooms() {
  let nextId = 0;
  return createMemoryLooms<TextPayload, LoompadStoryLoomMeta, StoryTurnMeta>({
    createId: () => `turn-${++nextId}`,
    now: () => 1000 + nextId,
  });
}

describe("Loompad story adapter", () => {
  it("exports shared story content without session traversal state", () => {
    const info = {
      id: "loom-1",
      meta: { title: "Draft" },
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
        id: "root",
        loomId: "loom-1",
        parentId: null,
        payload: { text: "Start" },
        meta: { role: "prose" },
        createdAt: 1000,
      },
      {
        id: "a",
        loomId: "loom-1",
        parentId: "root",
        payload: { text: "A" },
        meta: { role: "prose" },
        createdAt: 1000,
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("lastSelectedIndex");
  });

  it("appends and materializes a branching story in canonical child order", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story" });
    const loom = await looms.open(info.id);
    const root = await loom.appendTurn(null, { text: "Start" }, { role: "prose" });

    await appendStoryContinuations(loom, root.id, [
      { id: "legacy-a", text: "A" },
      { id: "legacy-b", text: "B" },
    ]);

    const [first] = await loom.childrenOf(root.id);
    await appendStoryContinuations(loom, first.id, [
      { id: "legacy-c", text: "C" },
    ]);

    expect(await materializeStoryTree(loom, "Start")).toEqual({
      root: {
        id: root.id,
        text: "Start",
        continuations: [
          {
            id: first.id,
            text: "A",
            continuations: [
              {
                id: "turn-5",
                text: "C",
                continuations: [],
              },
            ],
          },
          {
            id: "turn-4",
            text: "B",
            continuations: [],
          },
        ],
      },
    });
  });

  it("saves edits as a new sibling revision without copying descendants", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story" });
    const loom = await looms.open(info.id);

    const root = await loom.appendTurn(null, { text: "Start" }, { role: "prose" });
    const original = await loom.appendTurn(root.id, { text: "Original" });
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
    const appended = await appendStoryNodeRevision(
      loom,
      root.id,
      revision,
      original.id,
    );
    const tree = await materializeStoryTree(loom, "Start");

    expect(tree.root.text).toBe("Start");
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
          id: "turn-6",
          text: "Split tail",
          continuations: [],
        },
      ],
    });
  });

  it("saves root edits as top-level turn revisions without overwriting meta", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story" });
    const loom = await looms.open(info.id);

    const original = await loom.appendTurn(null, { text: "Start" }, { role: "prose" });
    await loom.appendTurn(original.id, { text: "Original child" }, { role: "prose" });

    const appended = await appendStoryNodeRevision(
      loom,
      null,
      { id: "ignored", text: "Edited root", continuations: [] },
      original.id,
    );

    expect((await loom.info()).meta).toEqual({ title: "Story" });
    expect((await loom.childrenOf(null)).map((turn) => turn.payload.text)).toEqual([
      "Start",
      "Edited root",
    ]);
    expect(appended.meta).toEqual({ role: "revision", revises: original.id });
    expect(await materializeStoryTree(loom, "Start")).toEqual({
      root: {
        id: appended.id,
        text: "Edited root",
        continuations: [],
      },
    });
  });
});
