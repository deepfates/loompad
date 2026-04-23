import { describe, expect, it } from "bun:test";
import { createMemoryLoomWorlds } from "../../../vendor/loomsync/packages/core/src/memory";
import { createMemoryLoomIndexes } from "../../../vendor/loomsync/packages/index/src/memory";
import {
  addStoryRootToIndexHandle,
  createStoryIndexShareUrl,
  createStoryShareUrl,
  getStoryIndexIdFromLocation,
  getStoryRootIdFromLocation,
  importStoryRootFromLocation,
} from "./storyRuntime";

describe("story runtime URLs", () => {
  it("reads story root ids from query params and hashes through LoomSync helpers", () => {
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/?story=abc") as unknown as Location),
    ).toBe("abc");
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/#root=def") as unknown as Location),
    ).toBe("def");
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/#ghi") as unknown as Location),
    ).toBe("ghi");
  });

  it("creates share urls containing the story root id", () => {
    expect(
      createStoryShareUrl(
        "automerge:story",
        new URL("https://loompad.test/path?x=1#old") as unknown as Location,
      ),
    ).toBe("https://loompad.test/path?x=1&story=automerge%3Astory");
  });

  it("reads and creates share urls for whole story indexes", () => {
    expect(
      getStoryIndexIdFromLocation(new URL("https://loompad.test/?index=idx") as unknown as Location),
    ).toBe("idx");
    expect(
      createStoryIndexShareUrl(
        "automerge:index",
        new URL("https://loompad.test/path?story=old#root=old") as unknown as Location,
      ),
    ).toBe("https://loompad.test/path?index=automerge%3Aindex");
  });

  it("refreshes existing index entry metadata when importing a shared root", async () => {
    const worlds = createMemoryLoomWorlds<{ text: string }, { title: string; rootText: string }>({
      createId: () => "story",
    });
    const root = await worlds.createRoot({ title: "Story", rootText: "Old" });
    const world = await worlds.openRoot(root.id);
    await world.updateRootMeta({ title: "Story", rootText: "Edited" });

    const indexes = createMemoryLoomIndexes<{ title: string; rootText: string }, { app: "loompad" }>({
      createId: () => "index",
    });
    const index = await indexes.createIndex({ app: "loompad" });
    await addStoryRootToIndexHandle(index, root.id, {
      title: "Story",
      rootText: "Old",
    });

    await importStoryRootFromLocation(
      new URL(`https://loompad.test/?story=${encodeURIComponent(root.id)}`) as unknown as Location,
      { worlds, index },
    );

    await expect(index.get(root.id)).resolves.toMatchObject({
      meta: { title: "Story", rootText: "Edited" },
    });
  });

  it("rejects unknown shared story ids so callers can fall back to local stories", async () => {
    const worlds = createMemoryLoomWorlds<{ text: string }, { title: string; rootText: string }>();
    const indexes = createMemoryLoomIndexes<{ title: string; rootText: string }, { app: "loompad" }>();
    const index = await indexes.createIndex({ app: "loompad" });

    await expect(
      importStoryRootFromLocation(
        new URL("https://loompad.test/?story=memory:missing") as unknown as Location,
        { worlds, index },
      ),
    ).rejects.toThrow("Unknown root");
    await expect(index.entries()).resolves.toEqual([]);
  });
});
