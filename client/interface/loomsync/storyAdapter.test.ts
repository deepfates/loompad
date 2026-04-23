import { describe, expect, it } from "bun:test";
import { createAutomergeLoomWorlds } from "../../../vendor/loomsync/packages/core/src/automerge";
import {
  appendStoryContinuations,
  appendStoryNodeRevision,
  materializeStoryTree,
  storyTreeToSnapshot,
} from "./storyAdapter";

describe("LoomSync story adapter", () => {
  it("converts nested Loompad trees into snapshots without shared UI selection state", async () => {
    const worlds = createAutomergeLoomWorlds<{ text: string }, { title: string; rootText: string }>();
    const root = await worlds.createRoot({ title: "Story", rootText: "Root" });
    const snapshot = storyTreeToSnapshot(
      {
        root: {
          id: "root",
          text: "Root",
          continuations: [
            {
              id: "a",
              text: "A",
              lastSelectedIndex: 1,
              continuations: [{ id: "b", text: "B" }],
            },
          ],
        },
      },
      root,
    );

    expect(snapshot.nodes).toHaveLength(2);
    expect(snapshot.nodes[0]).not.toHaveProperty("lastSelectedIndex");
  });

  it("materializes and appends through an Automerge-backed world", async () => {
    const worlds = createAutomergeLoomWorlds<{ text: string }, { title: string; rootText: string }>();
    const root = await worlds.createRoot({ title: "Story", rootText: "Root" });
    const world = await worlds.openRoot(root.id);

    await appendStoryContinuations(world, null, [
      { id: "ignored", text: "Once", continuations: [{ id: "ignored-2", text: " more" }] },
    ]);

    const tree = await materializeStoryTree(world, "Root");
    expect(tree.root.continuations?.[0]?.text).toBe("Once");
    expect(tree.root.continuations?.[0]?.continuations?.[0]?.text).toBe(" more");
  });

  it("represents edits as sibling revision branches without mutating the original node", async () => {
    const worlds = createAutomergeLoomWorlds<{ text: string }, { title: string; rootText: string }>();
    const root = await worlds.createRoot({ title: "Story", rootText: "Root" });
    const world = await worlds.openRoot(root.id);

    await appendStoryContinuations(world, null, [
      {
        id: "original",
        text: "Original",
        continuations: [{ id: "child", text: " child" }],
      },
    ]);

    const [original] = await world.childrenOf(null);
    expect(original).toBeTruthy();
    await appendStoryNodeRevision(
      world,
      null,
      {
        id: original!.id,
        text: "Original",
        continuations: [{ id: "child", text: " child" }],
      },
      { id: "revision", text: "Revision", continuations: [] },
    );

    const tree = await materializeStoryTree(world, "Root");
    expect(tree.root.continuations?.map((node) => node.text)).toEqual([
      "Original",
      "Revision",
    ]);
    expect(tree.root.continuations?.[0]?.continuations?.[0]?.text).toBe(" child");
    expect(tree.root.continuations?.[1]?.continuations?.[0]?.text).toBe(" child");
  });
});
