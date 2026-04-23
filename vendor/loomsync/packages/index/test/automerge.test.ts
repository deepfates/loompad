import { describe, expect, it } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { createAutomergeLoomIndexes } from "../src/index.js";

function deterministicAutomergeIndexes() {
  let nextTime = 4000;
  return createAutomergeLoomIndexes<{ app: string }, { owner: string }>({
    repo: new Repo(),
    now: () => nextTime++,
  });
}

describe("automerge loom indexes", () => {
  it("uses the Automerge document URL as the index id", async () => {
    const indexes = deterministicAutomergeIndexes();
    const index = await indexes.createIndex({ owner: "me" });

    expect(index.id.startsWith("automerge:")).toBe(true);
    await expect(index.info()).resolves.toMatchObject({ id: index.id });
  });

  it("stores ordered root links", async () => {
    const indexes = deterministicAutomergeIndexes();
    const index = await indexes.createIndex();

    const first = await index.addRoot("automerge:first", {
      title: "First",
      kind: "story",
      meta: { app: "loompad" },
    });
    const second = await index.addRoot("automerge:second", { title: "Second" });

    expect(await index.entries()).toEqual([first, second]);
    expect(await index.get("automerge:first")).toEqual(first);
  });

  it("imports snapshots with a new index id", async () => {
    const indexes = deterministicAutomergeIndexes();
    const index = await indexes.createIndex({ owner: "me" });
    await index.addRoot("automerge:first", { title: "First" });
    const snapshot = await index.export();

    const imported = await indexes.importIndex(snapshot);

    expect(imported.id).not.toBe(index.id);
    expect(await imported.entries()).toEqual(snapshot.entries);
  });

  it("emits entry-added for changes observed through another handle", async () => {
    const indexes = deterministicAutomergeIndexes();
    const index = await indexes.createIndex();
    const observer = await indexes.openIndex(index.id);
    const writer = await indexes.openIndex(index.id);
    const events: string[] = [];
    observer.subscribe((event) => {
      if (event.type === "entry-added") events.push(event.entry.rootId);
    });

    await writer.addRoot("automerge:first", { title: "First" });

    expect(events).toEqual(["automerge:first"]);
  });
});
