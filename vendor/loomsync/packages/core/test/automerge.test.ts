import { describe, expect, it } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  createAutomergeLoomWorlds,
  type LoomSnapshot,
} from "../src/index.js";

type Payload = { text: string };
type RootMeta = { title: string };

function deterministicAutomergeWorlds() {
  let nextId = 0;
  let nextTime = 3000;
  return createAutomergeLoomWorlds<Payload, RootMeta>({
    repo: new Repo(),
    createNodeId: () => `node-${++nextId}`,
    now: () => nextTime++,
  });
}

describe("automerge loom worlds", () => {
  it("uses the Automerge document URL as the root id", async () => {
    const worlds = deterministicAutomergeWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });

    expect(root.id.startsWith("automerge:")).toBe(true);
    await expect(worlds.openRoot(root.id)).resolves.toMatchObject({ id: root.id });
  });

  it("appends nodes and preserves canonical child-list order", async () => {
    const worlds = deterministicAutomergeWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const world = await worlds.openRoot(root.id);

    const first = await world.appendAfter(null, { text: "Once" });
    const left = await world.appendAfter(first.id, { text: " left" });
    const right = await world.appendAfter(first.id, { text: " right" });

    expect(await world.childrenOf(first.id)).toEqual([left, right]);
    expect(await world.pathTo(right.id)).toEqual([first, right]);
    expect(await world.leaves()).toEqual([left, right]);
  });

  it("imports a snapshot with preserved node ids and a new root id", async () => {
    const worlds = deterministicAutomergeWorlds();
    const snapshot: LoomSnapshot<Payload, RootMeta> = {
      root: { id: "snapshot:story", meta: { title: "Imported" }, createdAt: 10 },
      nodes: [
        {
          id: "a",
          rootId: "snapshot:story",
          parentId: null,
          payload: { text: "A" },
          createdAt: 11,
        },
        {
          id: "b",
          rootId: "snapshot:story",
          parentId: "a",
          payload: { text: "B" },
          createdAt: 12,
        },
      ],
    };

    const root = await worlds.importRoot(snapshot);
    const world = await worlds.openRoot(root.id);
    const exported = await world.export();

    expect(root.id).not.toBe(snapshot.root.id);
    expect(exported.nodes.map((node) => node.id)).toEqual(["a", "b"]);
    expect(exported.nodes.every((node) => node.rootId === root.id)).toBe(true);
  });

  it("emits node-added when another handle observes the same document change", async () => {
    const worlds = deterministicAutomergeWorlds();
    const root = await worlds.createRoot({ title: "Story 1" });
    const observer = await worlds.openRoot(root.id);
    const writer = await worlds.openRoot(root.id);
    const events: string[] = [];
    observer.subscribe((event) => {
      if (event.type === "node-added") events.push(event.node.id);
    });

    const first = await writer.appendAfter(null, { text: "Remote-ish" });

    expect(events).toEqual([first.id]);
  });

  it("rejects invalid imported topologies", async () => {
    const worlds = deterministicAutomergeWorlds();
    await expect(
      worlds.importRoot({
        root: { id: "snapshot:story", meta: { title: "Bad" }, createdAt: 10 },
        nodes: [
          {
            id: "a",
            rootId: "snapshot:story",
            parentId: "missing",
            payload: { text: "A" },
            createdAt: 11,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "MISSING_PARENT" });

    await expect(
      worlds.importRoot({
        root: { id: "snapshot:story", meta: { title: "Bad" }, createdAt: 10 },
        nodes: [
          {
            id: "a",
            rootId: "snapshot:story",
            parentId: "b",
            payload: { text: "A" },
            createdAt: 11,
          },
          {
            id: "b",
            rootId: "snapshot:story",
            parentId: "a",
            payload: { text: "B" },
            createdAt: 12,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "CYCLE_DETECTED" });
  });
});
