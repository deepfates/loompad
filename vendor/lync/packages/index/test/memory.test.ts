import { describe, expect, it } from "vitest";
import { loomRef } from "../../core/src/index";
import { createMemoryLoomIndexes } from "../src/memory.js";
import { upsertLoom } from "../src/entries.js";

function deterministicIndexes() {
  let nextId = 0;
  let nextTime = 2000;
  return createMemoryLoomIndexes<{ app: string }, { owner: string }>({
    createId: () => `idx-${++nextId}`,
    now: () => nextTime++,
  });
}

describe("memory loom indexes", () => {
  it("creates an index and stores ordered loom references", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.create({ owner: "me" });

    const first = await index.addLoom(loomRef("automerge:first"), {
      title: "First",
      kind: "story",
      meta: { app: "textile" },
    });
    const second = await index.addLoom(loomRef("automerge:second"), { title: "Second" });

    expect(await index.entries()).toEqual([first, second]);
    expect(await index.get("automerge:first")).toEqual(first);
    expect(await index.has("automerge:missing")).toBe(false);
  });

  it("updates and removes loom links without implying loom deletion", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.create();
    await index.addLoom(loomRef("automerge:first"), { title: "First" });

    const updated = await index.updateLoom("automerge:first", {
      title: "Renamed",
      kind: "story",
    });
    expect(updated.title).toBe("Renamed");
    expect(updated.updatedAt).toBe(2002);

    await index.removeLoom("automerge:first");
    expect(await index.entries()).toEqual([]);
  });

  it("emits entry events and exports/imports deterministic snapshots with a new index id", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.create({ owner: "me" });
    const events: string[] = [];
    index.subscribe((event) => events.push(event.type));

    await index.addLoom(loomRef("automerge:first"), { title: "First" });
    await index.updateLoom("automerge:first", { title: "Renamed" });
    await index.removeLoom("automerge:first");

    expect(events).toEqual(["entry-added", "entry-updated", "entry-removed"]);

    await index.addLoom(loomRef("automerge:first"), { title: "First" });
    const snapshot = await index.export();
    const imported = await indexes.import(snapshot);

    expect(imported.id).not.toBe(index.id);
    expect(await imported.entries()).toEqual(snapshot.entries);
  });

  it("rejects duplicate loom links", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.create();
    await index.addLoom(loomRef("automerge:first"));

    await expect(index.addLoom(loomRef("automerge:first"))).rejects.toMatchObject({
      code: "DUPLICATE_LOOM_ID",
    });
  });

  it("upserts loom links so shared imports can refresh metadata", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.create();

    const added = await upsertLoom(index, loomRef("automerge:first"), {
      title: "First",
      kind: "story",
      meta: { app: "old" },
    });
    const updated = await upsertLoom(index, loomRef("automerge:first"), {
      title: "Renamed",
      kind: "story",
      meta: { app: "new" },
    });

    expect(added.addedAt).toBe(updated.addedAt);
    expect(updated.updatedAt).toBe(2002);
    expect(await index.entries()).toEqual([updated]);
  });
});
