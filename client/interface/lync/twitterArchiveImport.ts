import { strFromU8, unzip } from "fflate";

import {
  twitterArchiveEntriesToConversation,
  type BrowserArchiveEntry,
} from "../../../vendor/splice-browser/index.js";
import {
  importConversationLoom,
  importLyncOrConversationText,
  type ConversationLoomSnapshot,
  type ImportedConversation,
} from "./storyRuntime";

const ARCHIVE_TEXT_MEMBER = /(?:^|\/)data\/(?:manifest|account|tweets[^/]*|like[^/]*)\.js$/i;
const MAX_ARCHIVE_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_MEMBER_BYTES = 768 * 1024 * 1024;
const MAX_TOTAL_TEXT_BYTES = 1024 * 1024 * 1024;

function unzipTextMembers(bytes: Uint8Array): Promise<BrowserArchiveEntry[]> {
  return new Promise((resolve, reject) => {
    unzip(bytes, {
      filter: (file) =>
        ARCHIVE_TEXT_MEMBER.test(file.name) && file.originalSize <= MAX_MEMBER_BYTES,
    }, (error, entries) => {
      if (error) {
        reject(new Error(`Could not open archive ZIP: ${error.message}`));
        return;
      }
      const selected = Object.entries(entries);
      const total = selected.reduce((sum, [, value]) => sum + value.byteLength, 0);
      if (total > MAX_TOTAL_TEXT_BYTES) {
        reject(new Error("Twitter archive text exceeds the 1 GiB local review limit."));
        return;
      }
      try {
        resolve(selected.map(([path, value]) => ({ path, text: strFromU8(value) })));
      } catch (decodeError) {
        reject(new Error(
          `Could not decode Twitter archive text: ${
            decodeError instanceof Error ? decodeError.message : String(decodeError)
          }`,
        ));
      }
    });
  });
}

/**
 * Browser-local native archive entry. The ZIP never leaves the browser: only
 * Twitter manifest/account/tweets/like text members are decompressed, Splice
 * converts those members in memory, and Textile imports the resulting Loom.
 */
export async function importTwitterArchiveFile(file: File): Promise<ImportedConversation> {
  if (!/\.zip$/i.test(file.name)) {
    throw new Error("Native archive import currently expects a Twitter/X .zip export.");
  }
  if (file.size > MAX_ARCHIVE_FILE_BYTES) {
    throw new Error("Twitter archive ZIP exceeds the 2 GiB local review limit.");
  }
  const entries = await unzipTextMembers(new Uint8Array(await file.arrayBuffer()));
  const converted = await twitterArchiveEntriesToConversation(entries);
  const imported = await importConversationLoom(
    converted.snapshot as ConversationLoomSnapshot,
  );
  return {
    ...imported,
    kind: "twitter-archive",
    archiveStats: {
      ...converted.stats,
      ownerHandle: converted.stats.ownerHandle,
    },
  };
}

/** One ordinary file front door for native archives and portable Textile formats. */
export async function importTextileFile(file: File): Promise<ImportedConversation> {
  return /\.zip$/i.test(file.name)
    ? importTwitterArchiveFile(file)
    : importLyncOrConversationText(await file.text(), file.name);
}
