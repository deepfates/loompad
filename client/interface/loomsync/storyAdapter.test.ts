import { describe, expect, it } from "bun:test";
import {
  appendStoryContinuations,
  createLoompadStoryWorlds,
  materializeStoryTree,
  storyTreeToSnapshot,
} from "./storyAdapter";
import type { StoryNode } from "../types";

describe("LoomSync story adapter", () => {
  it("converts nested Loompad trees into snapshots without shared UI selection state", async () => {
    const worlds = createLoompadStoryWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const tree: { root: StoryNode } = {
      root: {
        id: "root",
        text: "Root prompt",
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

    const snapshot = storyTreeToSnapshot(tree, root);

    expect(snapshot.nodes.map((node) => node.id)).toEqual(["a", "b", "c"]);
    expect(JSON.stringify(snapshot)).not.toContain("lastSelectedIndex");
  });

  it("materializes a LoomSync world back into the nested shape Loompad UI expects", async () => {
    const worlds = createLoompadStoryWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);
    const first = await world.appendAfter(null, { text: "A" });
    await world.appendAfter(first.id, { text: "B" });
    await world.appendAfter(null, { text: "C" });

    const materialized = await materializeStoryTree(world, "Root prompt");

    expect(materialized.root.text).toBe("Root prompt");
    expect(materialized.root.continuations?.map((node) => node.text)).toEqual([
      "A",
      "C",
    ]);
    expect(materialized.root.continuations?.[0]?.id).toBe(first.id);
    expect(
      materialized.root.continuations?.[0]?.continuations?.map((node) => node.text),
    ).toEqual(["B"]);
  });

  it("appends generated StoryNode chains into an Automerge-backed world", async () => {
    const worlds = createLoompadStoryWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);

    await appendStoryContinuations(world, null, [
      {
        id: "generated-a",
        text: "A",
        continuations: [{ id: "generated-b", text: "B", continuations: [] }],
      },
    ]);

    const materialized = await materializeStoryTree(world, "Root prompt");
    expect(materialized.root.continuations?.[0]?.text).toBe("A");
    expect(materialized.root.continuations?.[0]?.continuations?.[0]?.text).toBe(
      "B",
    );
  });
});
