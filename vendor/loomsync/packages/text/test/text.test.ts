import { describe, expect, it } from "vitest";
import { createMemoryLoomWorlds } from "../../core/src/index.js";
import {
  appendChain,
  flattenPath,
  pathToStoryNodes,
  snapshotFromNestedStory,
  type StoryNode,
  type TextPayload,
} from "../src/index.js";

describe("text helpers", () => {
  it("appends a text chain and flattens the resulting path", async () => {
    const worlds = createMemoryLoomWorlds<TextPayload>({
      createId: (() => {
        let id = 0;
        return () => `node-${++id}`;
      })(),
      now: () => 1,
    });
    const root = await worlds.createRoot();
    const world = await worlds.openRoot(root.id);

    const nodes = await appendChain(world, null, [
      { text: "Once" },
      { text: " upon" },
      { text: " a time" },
    ]);

    const path = await world.pathTo(nodes.at(-1)!.id);
    expect(flattenPath(path)).toBe("Once upon a time");
    expect(pathToStoryNodes(path)).toEqual([
      { id: "node-2", text: "Once" },
      { id: "node-3", text: " upon" },
      { id: "node-4", text: " a time" },
    ]);
  });

  it("converts a Loompad-style nested StoryNode tree into a flat snapshot without UI state", () => {
    const tree: { root: StoryNode } = {
      root: {
        id: "root",
        text: "",
        lastSelectedIndex: 1,
        continuations: [
          {
            id: "a",
            text: "A",
            lastSelectedIndex: 0,
            continuations: [{ id: "b", text: "B", continuations: [] }],
          },
          { id: "c", text: "C", continuations: [] },
        ],
      },
    };

    const snapshot = snapshotFromNestedStory(tree, {
      id: "snapshot:story",
      createdAt: 123,
      meta: { title: "Story" },
    });

    expect(snapshot.nodes).toEqual([
      {
        id: "a",
        rootId: "snapshot:story",
        parentId: null,
        payload: { text: "A" },
        createdAt: 123,
      },
      {
        id: "b",
        rootId: "snapshot:story",
        parentId: "a",
        payload: { text: "B" },
        createdAt: 123,
      },
      {
        id: "c",
        rootId: "snapshot:story",
        parentId: null,
        payload: { text: "C" },
        createdAt: 123,
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("lastSelectedIndex");
  });
});
