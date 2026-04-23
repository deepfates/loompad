import { describe, expect, it } from "vitest";
import {
  createMemoryLoomWorlds,
  LoomError,
  type LoomSnapshot,
} from "../src/index.js";

type Payload = { text: string };
type RootMeta = { title: string };
type NodeMeta = { source?: string };

function deterministicWorlds() {
  let nextId = 0;
  let nextTime = 1000;
  return createMemoryLoomWorlds<Payload, RootMeta, NodeMeta>({
    createId: () => `id-${++nextId}`,
    now: () => nextTime++,
  });
}

describe("memory loom worlds", () => {
  it("creates an empty root and opens a handle", async () => {
    const worlds = deterministicWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);

    expect(await world.root()).toEqual(root);
    expect(await world.childrenOf(null)).toEqual([]);
    expect(await world.leaves()).toEqual([]);
  });

  it("appends branches, reconstructs paths, and derives leaves in traversal order", async () => {
    const worlds = deterministicWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);

    const first = await world.appendAfter(null, { text: "Once" });
    const left = await world.appendAfter(first.id, { text: " left" });
    const right = await world.appendAfter(first.id, { text: " right" });
    const deeper = await world.appendAfter(left.id, { text: " deeper" });

    expect(await world.childrenOf(first.id)).toEqual([left, right]);
    expect(await world.pathTo(deeper.id)).toEqual([first, left, deeper]);
    expect(await world.leaves()).toEqual([deeper, right]);
  });

  it("rejects append to a missing parent", async () => {
    const worlds = deterministicWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);

    await expect(world.appendAfter("missing", { text: "Nope" })).rejects.toMatchObject({
      code: "MISSING_PARENT",
    });
  });

  it("emits node-added and root-updated events", async () => {
    const worlds = deterministicWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);
    const events: string[] = [];
    world.subscribe((event) => events.push(event.type));

    await world.updateRootMeta({ title: "Renamed" });
    await world.appendAfter(null, { text: "First" }, { source: "test" });

    expect(events).toEqual(["root-updated", "node-added"]);
  });

  it("exports deterministically in root traversal order and imports with a new root id", async () => {
    const worlds = deterministicWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);
    const first = await world.appendAfter(null, { text: "A" });
    const b = await world.appendAfter(first.id, { text: "B" });
    const c = await world.appendAfter(first.id, { text: "C" });

    const snapshot = await world.export();
    expect(snapshot.nodes.map((node) => node.id)).toEqual([first.id, b.id, c.id]);

    const importedRoot = await worlds.importRoot(snapshot);
    const imported = await worlds.openRoot(importedRoot.id);
    const importedSnapshot = await imported.export();

    expect(importedRoot.id).not.toEqual(root.id);
    expect(importedSnapshot.nodes.map((node) => node.id)).toEqual([first.id, b.id, c.id]);
    expect(new Set(importedSnapshot.nodes.map((node) => node.rootId))).toEqual(
      new Set([importedRoot.id]),
    );
  });

  it("rejects imported missing parents and cycles", async () => {
    const worlds = deterministicWorlds();
    const badParent: LoomSnapshot<Payload, RootMeta> = {
      root: { id: "snapshot:root", meta: { title: "Bad" }, createdAt: 1 },
      nodes: [
        {
          id: "child",
          rootId: "snapshot:root",
          parentId: "missing",
          payload: { text: "bad" },
          createdAt: 2,
        },
      ],
    };

    await expect(worlds.importRoot(badParent)).rejects.toMatchObject({
      code: "MISSING_PARENT",
    });

    const cycle: LoomSnapshot<Payload, RootMeta> = {
      root: { id: "snapshot:root", meta: { title: "Cycle" }, createdAt: 1 },
      nodes: [
        {
          id: "a",
          rootId: "snapshot:root",
          parentId: "b",
          payload: { text: "a" },
          createdAt: 2,
        },
        {
          id: "b",
          rootId: "snapshot:root",
          parentId: "a",
          payload: { text: "b" },
          createdAt: 3,
        },
      ],
    };

    await expect(worlds.importRoot(cycle)).rejects.toBeInstanceOf(LoomError);
    await expect(worlds.importRoot(cycle)).rejects.toMatchObject({
      code: "CYCLE_DETECTED",
    });
  });
});
