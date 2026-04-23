import { Repo, type RepoConfig } from "@automerge/automerge-repo";
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { WebSocketServer } from "isomorphic-ws";

export interface LoomSyncServerOptions {
  port?: number;
  host?: string;
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
  const server = new WebSocketServer({ host, port });
  const adapter = new WebSocketServerAdapter(server, options.keepAliveInterval);
  const repo = new Repo({
    ...options.repoConfig,
    network: [adapter],
  });

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
