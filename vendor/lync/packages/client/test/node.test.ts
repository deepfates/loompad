import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeLoomClient } from "../src/node.js";

describe("node loom client", () => {
  it("persists looms through the filesystem storage adapter", async () => {
    const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "lync-node-"));

    const client = createNodeLoomClient<{ text: string }>({
      storageDir,
      syncUrl: false,
    });
    const info = await client.looms.create({ title: "Node script" });
    const loom = await client.looms.open(info.id);
    const first = await loom.appendTurn(null, { text: "Hello" });
    await client.close();

    const reopened = createNodeLoomClient<{ text: string }>({
      storageDir,
      syncUrl: false,
    });
    const reopenedLoom = await reopened.looms.open(info.id);

    await expect(reopenedLoom.childrenOf(null)).resolves.toEqual([first]);

    await reopened.close();
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it("can run without persistence or network for short-lived scripts", async () => {
    const client = createNodeLoomClient<{ text: string }>({
      storageDir: false,
      syncUrl: false,
    });

    const info = await client.looms.create();
    const loom = await client.looms.open(info.id);

    await expect(loom.appendTurn(null, { text: "Transient" })).resolves.toMatchObject({
      loomId: info.id,
      parentId: null,
      payload: { text: "Transient" },
    });

    await client.close();
  });
});
