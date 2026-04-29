import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeLoomClient, type SyncStatus } from "../src/node.js";

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

  it("keeps local loom operations alive when websocket sync is unavailable", async () => {
    const server = http.createServer();
    server.on("upgrade", (_request, socket) => {
      socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server");

    const statuses: SyncStatus[] = [];
    const client = createNodeLoomClient<{ text: string }>({
      storageDir: false,
      sync: {
        url: `ws://127.0.0.1:${address.port}/lync`,
        retryInterval: 0,
        onStatus: (status) => statuses.push(status),
      },
    });

    const info = await client.looms.create({ title: "Offline tolerant" });
    const loom = await client.looms.open(info.id);
    await expect(loom.appendTurn(null, { text: "Still works" })).resolves.toMatchObject({
      payload: { text: "Still works" },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(statuses.some((status) => status.state === "failed")).toBe(true);

    await client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
