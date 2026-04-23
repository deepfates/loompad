import { describe, expect, it } from "vitest";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  attachLoomSyncServer,
  createLoomSyncServer,
  FileStorageAdapter,
} from "../src/index.js";

describe("loom sync server", () => {
  it("starts a WebSocket-backed Automerge repo and closes cleanly", async () => {
    const server = createLoomSyncServer();

    expect(server.url.startsWith("ws://")).toBe(true);
    expect(server.repo.peerId).toBeTruthy();

    await server.close();
  });

  it("attaches a relay to an existing HTTP server", async () => {
    const httpServer = http.createServer();
    const relay = attachLoomSyncServer(httpServer);

    expect(relay.repo.peerId).toBeTruthy();

    await relay.close();
    httpServer.close();
  });

  it("persists storage chunks to the filesystem", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "loomsync-storage-"));
    const storage = new FileStorageAdapter(dir);
    await storage.save(["doc", "snapshot"], new Uint8Array([1, 2, 3]));

    await expect(storage.load(["doc", "snapshot"])).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    await expect(storage.loadRange(["doc"])).resolves.toHaveLength(1);

    await storage.removeRange(["doc"]);
    await expect(storage.load(["doc", "snapshot"])).resolves.toBeUndefined();
  });
});
