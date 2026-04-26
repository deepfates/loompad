import { describe, expect, it } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { loomRef } from "../../core/src/index";
import { createAutomergeLoomIndexes } from "../src/automerge.js";

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
    const index = await indexes.create({ owner: "me" });

    expect(index.id.startsWith("automerge:")).toBe(true);
    await expect(index.info()).resolves.toMatchObject({ id: index.id });
  });

  it("stores ordered loom references", async () => {
    const indexes = deterministicAutomergeIndexes();
    const index = await indexes.create();

    const first = await index.addLoom(loomRef("automerge:first"), {
      title: "First",
      kind: "story",
      meta: { app: "textile" },
    });
    const second = await index.addLoom(loomRef("automerge:second"), { title: "Second" });

    expect(await index.entries()).toEqual([first, second]);
    expect(await index.get("automerge:first")).toEqual(first);
  });

  it("imports snapshots with a new index id", async () => {
    const indexes = deterministicAutomergeIndexes();
    const index = await indexes.create({ owner: "me" });
    await index.addLoom(loomRef("automerge:first"), { title: "First" });
    const snapshot = await index.export();

    const imported = await indexes.import(snapshot);

    expect(imported.id).not.toBe(index.id);
    expect(await imported.entries()).toEqual(snapshot.entries);
  });

  it("emits entry-added for changes observed through another handle", async () => {
    const indexes = deterministicAutomergeIndexes();
    const index = await indexes.create();
    const observer = await indexes.open(index.id);
    const writer = await indexes.open(index.id);
    const events: string[] = [];
    observer.subscribe((event) => {
      if (event.type === "entry-added") events.push(event.entry.ref.loomId);
    });

    await writer.addLoom(loomRef("automerge:first"), { title: "First" });

    expect(events).toEqual(["automerge:first"]);
  });
});
