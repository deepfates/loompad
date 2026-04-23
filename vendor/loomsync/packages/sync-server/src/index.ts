import fs from "node:fs/promises";
import type http from "node:http";
import path from "node:path";
import { Repo, type RepoConfig } from "@automerge/automerge-repo";
import type {
  Chunk,
  StorageAdapterInterface,
  StorageKey,
} from "@automerge/automerge-repo";
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { WebSocketServer } from "isomorphic-ws";

export interface LoomSyncServerOptions {
  port?: number;
  host?: string;
  path?: string;
  storageDir?: string;
  keepAliveInterval?: number;
  repoConfig?: Omit<RepoConfig, "network">;
}

export interface LoomSyncServer {
  repo: Repo;
  server: WebSocketServer;
  url: string;
  close(): Promise<void>;
}

export function createLoomSyncServer(options: LoomSyncServerOptions = {}): LoomSyncServer {
  const port = options.port ?? 0;
  const host = options.host ?? "127.0.0.1";
  const server = new WebSocketServer({
    host,
    port,
    path: options.path,
  });
  const repo = createRelayRepo(server, options);

  return {
    repo,
    server,
    get url() {
      const address = server.address();
      if (typeof address === "string" || address === null) return `ws://${host}:${port}`;
      return `ws://${address.address}:${address.port}`;
    },
    async close() {
      await repo.shutdown();
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

export interface AttachLoomSyncServerOptions extends Omit<LoomSyncServerOptions, "port" | "host"> {
  repo?: Repo;
}

export function attachLoomSyncServer(
  server: http.Server,
  options: AttachLoomSyncServerOptions = {},
) {
  const socketServer = new WebSocketServer({
    server,
    path: options.path ?? "/loomsync",
  });
  const repo = options.repo ?? createRelayRepo(socketServer, options);

  server.on("close", () => {
    socketServer.close();
  });

  return {
    repo,
    server: socketServer,
    close: () =>
      new Promise<void>((resolve, reject) => {
        socketServer.close((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

function createRelayRepo(
  server: WebSocketServer,
  options: Pick<LoomSyncServerOptions, "keepAliveInterval" | "repoConfig" | "storageDir">,
) {
  const adapter = new WebSocketServerAdapter(server, options.keepAliveInterval);
  return new Repo({
    storage: options.storageDir
      ? new FileStorageAdapter(options.storageDir)
      : options.repoConfig?.storage,
    ...options.repoConfig,
    network: [adapter],
  });
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
