import { describe, expect, it } from "vitest";
import { LoomError } from "../src/errors.js";
import { createMemoryLooms } from "../src/memory.js";
import type { LoomSnapshot } from "../src/types.js";

type Payload = { text: string };
type LoomMeta = { title: string };
type TurnMeta = { source?: string };

function deterministicLooms() {
  let nextId = 0;
  let nextTime = 1000;
  return createMemoryLooms<Payload, LoomMeta, TurnMeta>({
    createId: () => `id-${++nextId}`,
    now: () => nextTime++,
  });
}

describe("memory looms", () => {
  it("creates an empty loom and opens a handle", async () => {
    const looms = deterministicLooms();
    const info = await looms.create({ title: "Story 1" });
    const loom = await looms.open(info.id);

    expect(await loom.info()).toEqual(info);
    expect(await loom.childrenOf(null)).toEqual([]);
    expect(await loom.leaves()).toEqual([]);
  });

  it("appends turns, reconstructs threads, and derives leaves in traversal order", async () => {
    const looms = deterministicLooms();
    const info = await looms.create({ title: "Story 1" });
    const loom = await looms.open(info.id);

    const first = await loom.appendTurn(null, { text: "Once" });
    const left = await loom.appendTurn(first.id, { text: " left" });
    const right = await loom.appendTurn(first.id, { text: " right" });
    const deeper = await loom.appendTurn(left.id, { text: " deeper" });

    expect(await loom.childrenOf(first.id)).toEqual([left, right]);
    expect(await loom.threadTo(first.id)).toEqual([first]);
    expect(await loom.threadTo(deeper.id)).toEqual([first, left, deeper]);
    expect(await loom.leaves()).toEqual([deeper, right]);
  });

  it("rejects append to a missing parent", async () => {
    const looms = deterministicLooms();
    const info = await looms.create({ title: "Story 1" });
    const loom = await looms.open(info.id);

    await expect(loom.appendTurn("missing", { text: "Nope" })).rejects.toMatchObject({
      code: "MISSING_PARENT",
    });
  });

  it("emits turn-added and loom-updated events", async () => {
    const looms = deterministicLooms();
    const info = await looms.create({ title: "Story 1" });
    const loom = await looms.open(info.id);
    const events: string[] = [];
    loom.subscribe((event) => events.push(event.type));

    await loom.updateMeta({ title: "Renamed" });
    await loom.appendTurn(null, { text: "First" }, { source: "test" });

    expect(events).toEqual(["loom-updated", "turn-added"]);
  });

  it("exports deterministically in root traversal order and imports with a new loom id", async () => {
    const looms = deterministicLooms();
    const info = await looms.create({ title: "Story 1" });
    const loom = await looms.open(info.id);
    const first = await loom.appendTurn(null, { text: "A" });
    const b = await loom.appendTurn(first.id, { text: "B" });
    const c = await loom.appendTurn(first.id, { text: "C" });

    const snapshot = await loom.export();
    expect(snapshot.turns.map((turn) => turn.id)).toEqual([first.id, b.id, c.id]);

    const importedInfo = await looms.import(snapshot);
    const imported = await looms.open(importedInfo.id);
    const importedSnapshot = await imported.export();

    expect(importedInfo.id).not.toEqual(info.id);
    expect(importedSnapshot.turns.map((turn) => turn.id)).toEqual([first.id, b.id, c.id]);
    expect(new Set(importedSnapshot.turns.map((turn) => turn.loomId))).toEqual(
      new Set([importedInfo.id]),
    );
  });

  it("rejects imported missing parents and cycles", async () => {
    const looms = deterministicLooms();
    const badParent: LoomSnapshot<Payload, LoomMeta> = {
      loom: { id: "snapshot:loom", meta: { title: "Bad" }, createdAt: 1 },
      turns: [
        {
          id: "child",
          loomId: "snapshot:loom",
          parentId: "missing",
          payload: { text: "bad" },
          createdAt: 2,
        },
      ],
    };

    await expect(looms.import(badParent)).rejects.toMatchObject({
      code: "MISSING_PARENT",
    });

    const cycle: LoomSnapshot<Payload, LoomMeta> = {
      loom: { id: "snapshot:loom", meta: { title: "Cycle" }, createdAt: 1 },
      turns: [
        {
          id: "a",
          loomId: "snapshot:loom",
          parentId: "b",
          payload: { text: "a" },
          createdAt: 2,
        },
        {
          id: "b",
          loomId: "snapshot:loom",
          parentId: "a",
          payload: { text: "b" },
          createdAt: 3,
        },
      ],
    };

    await expect(looms.import(cycle)).rejects.toBeInstanceOf(LoomError);
    await expect(looms.import(cycle)).rejects.toMatchObject({
      code: "CYCLE_DETECTED",
    });
  });
});
