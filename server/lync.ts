import type http from "http";
import path from "path";
import { attachLyncServer as attachVendoredLyncServer } from "../vendor/lync/packages/sync-server/src/index";
import { hasValidSiteSession, isSiteAuthConfigured } from "./siteAuth";

let attached = false;

export function attachLyncServer(server: http.Server) {
  if (attached) return;
  attached = true;
  attachVendoredLyncServer(server, {
    path: "/lync",
    authenticate: (request) =>
      !isSiteAuthConfigured() || hasValidSiteSession(request),
    storageDir:
      process.env.LYNC_STORAGE_DIR ??
      path.resolve(process.cwd(), ".data/lync"),
  });
}
