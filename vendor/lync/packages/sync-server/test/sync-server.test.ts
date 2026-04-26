import { describe, expect, it } from "vitest";
import http from "node:http";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import WebSocket from "isomorphic-ws";
import {
  attachLyncServer,
  createLyncServer,
  FileStorageAdapter,
} from "../src/index.js";

describe("lync server", () => {
  it("starts a WebSocket-backed Automerge repo and closes cleanly", async () => {
    const server = createLyncServer();

    expect(server.url.startsWith("ws://")).toBe(true);
    expect(server.repo.peerId).toBeTruthy();

    await server.close();
  });

  it("attaches a relay to an existing HTTP server", async () => {
    const httpServer = http.createServer();
    const relay = attachLyncServer(httpServer);

    expect(relay.repo.peerId).toBeTruthy();

    await relay.close();
    httpServer.close();
  });

  it("can authenticate websocket upgrades", async () => {
    const httpServer = http.createServer();
    const seenAuthHeaders: Array<string | undefined> = [];
    const relay = attachLyncServer(httpServer, {
      authenticate: (request) => {
        seenAuthHeaders.push(request.headers.authorization);
        return request.headers.authorization === "Bearer ok";
      },
    });

    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (typeof address === "string" || address === null) {
      throw new Error("Expected TCP server address");
    }
    const url = `ws://127.0.0.1:${address.port}/lync`;

    await sendUpgrade(address.port);
    expect(seenAuthHeaders).toContain(undefined);
    await expect(connect(url, { authorization: "Bearer ok" })).resolves.toBeUndefined();
    expect(seenAuthHeaders).toContain("Bearer ok");

    await relay.close();
    httpServer.close();
  });

  it("persists storage chunks to the filesystem", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lync-storage-"));
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

function sendUpgrade(port: number) {
  return new Promise<void>((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");

    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error("Timed out waiting for websocket rejection"));
    });
    socket.on("connect", () => {
      const key = crypto.randomBytes(16).toString("base64");
      socket.write(
        [
          "GET /lync HTTP/1.1",
          "Host: 127.0.0.1",
          "Connection: Upgrade",
          "Upgrade: websocket",
          "Sec-WebSocket-Version: 13",
          `Sec-WebSocket-Key: ${key}`,
          "",
          "",
        ].join("\r\n"),
      );
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 25);
    });
    socket.on("error", reject);
  });
}

function connect(url: string, headers: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url, { headers });
    socket.once("open", () => {
      socket.close();
      resolve();
    });
    socket.once("error", reject);
  });
}
