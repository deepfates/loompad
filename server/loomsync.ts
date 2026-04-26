import type http from "http";
import path from "path";
import { attachLoomSyncServer as attachVendoredLoomSyncServer } from "../vendor/loomsync/packages/sync-server/src/index";

let attached = false;

export function attachLoomSyncServer(server: http.Server) {
  if (attached) return;
  attached = true;
  attachVendoredLoomSyncServer(server, {
    path: "/loomsync",
    storageDir:
      process.env.LOOMSYNC_STORAGE_DIR ??
      path.resolve(process.cwd(), ".data/loomsync"),
  });
}
