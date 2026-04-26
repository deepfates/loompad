import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { Duplex } from "node:stream";
import { Repo, type RepoConfig } from "@automerge/automerge-repo";
import type {
  Chunk,
  StorageAdapterInterface,
  StorageKey,
} from "@automerge/automerge-repo";
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { WebSocketServer } from "isomorphic-ws";

export type LyncUpgradeAuthenticator = (request: http.IncomingMessage) => boolean;

export interface LyncServerOptions {
  port?: number;
  host?: string;
  path?: string;
  storageDir?: string;
  keepAliveInterval?: number;
  authenticate?: LyncUpgradeAuthenticator;
  repoConfig?: Omit<RepoConfig, "network">;
}

export interface LyncServer {
  repo: Repo;
  server: WebSocketServer;
  url: string;
  close(): Promise<void>;
}

export function createLyncServer(options: LyncServerOptions = {}): LyncServer {
  const port = options.port ?? 0;
  const host = options.host ?? "127.0.0.1";
  const socketPath = normalizeSyncPath(options.path ?? "/lync");
  const httpServer = http.createServer();
  const relay = attachLyncServer(httpServer, options);
  httpServer.listen(port, host);

  return {
    repo: relay.repo,
    server: relay.server,
    get url() {
      const address = httpServer.address();
      if (typeof address === "string" || address === null) {
        return `ws://${formatWebSocketHost(host)}:${port}${socketPath}`;
      }
      return `ws://${formatWebSocketHost(address.address)}:${address.port}${socketPath}`;
    },
    async close() {
      await relay.repo.shutdown();
      await relay.close();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

export interface AttachLyncServerOptions extends Omit<LyncServerOptions, "port" | "host"> {
  repo?: Repo;
}

export function attachLyncServer(
  server: http.Server,
  options: AttachLyncServerOptions = {},
) {
  const socketPath = normalizeSyncPath(options.path ?? "/lync");
  const socketServer = new WebSocketServer({
    noServer: true,
  });
  const repo = options.repo ?? createRelayRepo(socketServer, options);
  const onUpgrade = (
    request: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    if (!isSocketPath(request, socketPath)) return;
    if (!isAuthorized(options.authenticate, request)) {
      rejectUpgrade(socket);
      return;
    }
    socketServer.handleUpgrade(request, socket, head, (websocket) => {
      socketServer.emit("connection", websocket, request);
    });
  };

  server.on("upgrade", onUpgrade);

  server.on("close", () => {
    socketServer.close();
  });

  return {
    repo,
    server: socketServer,
    close: () => {
      server.off("upgrade", onUpgrade);
      return new Promise<void>((resolve, reject) => {
        socketServer.close((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

function isSocketPath(request: http.IncomingMessage, socketPath: string) {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    return url.pathname === socketPath;
  } catch {
    return false;
  }
}

function isAuthorized(
  authenticate: LyncUpgradeAuthenticator | undefined,
  request: http.IncomingMessage,
) {
  if (!authenticate) return true;
  try {
    return authenticate(request);
  } catch {
    return false;
  }
}

function rejectUpgrade(socket: Duplex) {
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  setTimeout(() => socket.destroy(), 0);
}

function createRelayRepo(
  server: WebSocketServer,
  options: Pick<LyncServerOptions, "keepAliveInterval" | "repoConfig" | "storageDir">,
) {
  const adapter = new WebSocketServerAdapter(server, options.keepAliveInterval);
  return new Repo({
    ...options.repoConfig,
    storage: options.storageDir
      ? new FileStorageAdapter(options.storageDir)
      : options.repoConfig?.storage,
    network: [adapter],
  });
}

function normalizeSyncPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function formatWebSocketHost(host: string) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

export class FileStorageAdapter implements StorageAdapterInterface {
  constructor(private readonly dir: string) {}

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    try {
      return toUint8Array(await fs.readFile(this.filePath(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.filePath(key), data);
  }

  async remove(key: StorageKey): Promise<void> {
    try {
      await fs.unlink(this.filePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    await fs.mkdir(this.dir, { recursive: true });
    const prefix = this.keyToFilename(keyPrefix);
    const files = await fs.readdir(this.dir);
    return Promise.all(
      files
        .filter((file) => this.matchesPrefix(file, prefix))
        .map(async (file) => ({
          key: this.filenameToKey(file),
          data: toUint8Array(await fs.readFile(path.join(this.dir, file))),
        })),
    );
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const prefix = this.keyToFilename(keyPrefix);
    const files = await fs.readdir(this.dir);
    await Promise.all(
      files
        .filter((file) => this.matchesPrefix(file, prefix))
        .map((file) => fs.unlink(path.join(this.dir, file))),
    );
  }

  private filePath(key: StorageKey) {
    return path.join(this.dir, this.keyToFilename(key));
  }

  private keyToFilename(key: StorageKey) {
    return key.map((part) => encodeURIComponent(part)).join(".");
  }

  private filenameToKey(filename: string): StorageKey {
    return filename.split(".").map((part) => decodeURIComponent(part));
  }

  private matchesPrefix(filename: string, prefix: string) {
    return !prefix || filename === prefix || filename.startsWith(`${prefix}.`);
  }
}

function toUint8Array(data: Uint8Array) {
  return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}
