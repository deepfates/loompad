import { describe, expect, it } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  createBrowserAutomergeLoomRuntime,
  type BrowserAutomergeLoomRuntime,
} from "../src/browser.js";

describe("browser loom runtime", () => {
  it("creates worlds and indexes on one shared browser repo", async () => {
    const repo = new Repo();
    const runtime = createBrowserAutomergeLoomRuntime<
      { text: string },
      { title: string },
      never,
      { title: string },
      { app: string }
    >({
      repo,
    });

    const root = await runtime.worlds.createRoot({ title: "Story" });
    const world = await runtime.worlds.openRoot(root.id);
    const node = await world.appendAfter(null, { text: "Hello" });

    const index = await runtime.indexes.createIndex({ app: "loompad" });
    await index.addRoot(root.id, { title: "Story" });

    expect(root.id.startsWith("automerge:")).toBe(true);
    expect(node.rootId).toBe(root.id);
    await expect(index.entries()).resolves.toEqual([
      expect.objectContaining({ rootId: root.id, title: "Story" }),
    ]);
    expect((runtime as BrowserAutomergeLoomRuntime).repo).toBe(repo);
  });
});
