import type http from "http";
import fs from "fs/promises";
import path from "path";
import { Repo } from "@automerge/automerge-repo";
import type {
  Chunk,
  StorageAdapterInterface,
  StorageKey,
} from "@automerge/automerge-repo";
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { WebSocketServer } from "isomorphic-ws";

let repo: Repo | null = null;

class FileStorageAdapter implements StorageAdapterInterface {
  constructor(private readonly dir: string) {}

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    try {
      return await fs.readFile(this.filePath(key));
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
    const chunks = await Promise.all(
      files
        .filter((file) => this.matchesPrefix(file, prefix))
        .map(async (file) => ({
          key: this.filenameToKey(file),
          data: await fs.readFile(path.join(this.dir, file)),
        })),
    );
    return chunks;
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

export function attachLoomSyncServer(server: http.Server) {
  const socketServer = new WebSocketServer({
    server,
    path: "/loomsync",
  });
  const adapter = new WebSocketServerAdapter(socketServer);
  const storageDir =
    process.env.LOOMSYNC_STORAGE_DIR ??
    path.resolve(process.cwd(), ".data/loomsync");
  repo ??= new Repo({
    storage: new FileStorageAdapter(storageDir),
    network: [adapter],
  });

  server.on("close", () => {
    socketServer.close();
  });
}
