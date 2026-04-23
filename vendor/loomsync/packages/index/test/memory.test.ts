import { describe, expect, it } from "vitest";
import { createMemoryLoomIndexes } from "../src/index.js";
import { upsertRoot } from "../src/entries.js";

function deterministicIndexes() {
  let nextId = 0;
  let nextTime = 2000;
  return createMemoryLoomIndexes<{ app: string }, { owner: string }>({
    createId: () => `idx-${++nextId}`,
    now: () => nextTime++,
  });
}

describe("memory loom indexes", () => {
  it("creates an index and stores ordered root links", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.createIndex({ owner: "me" });

    const first = await index.addRoot("automerge:first", {
      title: "First",
      kind: "story",
      meta: { app: "loompad" },
    });
    const second = await index.addRoot("automerge:second", { title: "Second" });

    expect(await index.entries()).toEqual([first, second]);
    expect(await index.get("automerge:first")).toEqual(first);
    expect(await index.has("automerge:missing")).toBe(false);
  });

  it("updates and removes root links without implying world deletion", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.createIndex();
    await index.addRoot("automerge:first", { title: "First" });

    const updated = await index.updateRoot("automerge:first", {
      title: "Renamed",
      kind: "story",
    });
    expect(updated.title).toBe("Renamed");
    expect(updated.updatedAt).toBe(2002);

    await index.removeRoot("automerge:first");
    expect(await index.entries()).toEqual([]);
  });

  it("emits entry events and exports/imports deterministic snapshots with a new index id", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.createIndex({ owner: "me" });
    const events: string[] = [];
    index.subscribe((event) => events.push(event.type));

    await index.addRoot("automerge:first", { title: "First" });
    await index.updateRoot("automerge:first", { title: "Renamed" });
    await index.removeRoot("automerge:first");

    expect(events).toEqual(["entry-added", "entry-updated", "entry-removed"]);

    await index.addRoot("automerge:first", { title: "First" });
    const snapshot = await index.export();
    const imported = await indexes.importIndex(snapshot);

    expect(imported.id).not.toBe(index.id);
    expect(await imported.entries()).toEqual(snapshot.entries);
  });

  it("rejects duplicate root links", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.createIndex();
    await index.addRoot("automerge:first");

    await expect(index.addRoot("automerge:first")).rejects.toMatchObject({
      code: "DUPLICATE_NODE_ID",
    });
  });

  it("upserts root links so shared imports can refresh metadata", async () => {
    const indexes = deterministicIndexes();
    const index = await indexes.createIndex();

    const added = await upsertRoot(index, "automerge:first", {
      title: "First",
      kind: "story",
      meta: { app: "old" },
    });
    const updated = await upsertRoot(index, "automerge:first", {
      title: "Renamed",
      kind: "story",
      meta: { app: "new" },
    });

    expect(added.addedAt).toBe(updated.addedAt);
    expect(updated.updatedAt).toBe(2002);
    expect(await index.entries()).toEqual([updated]);
  });
});
