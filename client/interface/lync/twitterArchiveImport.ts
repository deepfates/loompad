import { strFromU8, unzip } from "fflate";

import {
  twitterArchiveEntriesToConversation,
  type BrowserArchiveEntry,
} from "../../../vendor/splice-browser/index.js";
import {
  importConversationLoom,
  importLyncOrConversationText,
  importRawLyncSources,
  type ConversationLoomSnapshot,
  type ImportedConversation,
} from "./storyRuntime";
import {
  BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL,
  loadOrderedLyncByteSources,
  parseOrderedLyncSourceSet,
  resolveOrderedLyncSourceFiles,
} from "./orderedLyncSourceSet";

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

/**
 * Multi-file front door for one authenticated ordered-prefix manifest plus its
 * operator-selected canonical Lync files. Existing one-file behavior is exact.
 */
export async function importTextileFiles(
  files: ReadonlyArray<File>,
): Promise<ImportedConversation> {
  if (files.length === 0) throw new Error("Choose at least one import file.");
  if (files.length === 1) return importTextileFile(files[0]!);

  const candidates = files.filter((file) => /\.json$/i.test(file.name));
  const manifests: Array<{ file: File; text: string }> = [];
  for (const file of candidates) {
    if (file.size > 1024 * 1024) continue;
    const text = await file.text();
    try {
      if (JSON.parse(text)?.protocol === BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL) {
        manifests.push({ file, text });
      }
    } catch {
      // The exact manifest parser below owns the error only after identification.
    }
  }
  if (manifests.length !== 1) {
    throw new Error(
      "Multi-file Lync import requires exactly one Behold ordered source-set manifest.",
    );
  }
  const selected = manifests[0]!;
  const manifest = parseOrderedLyncSourceSet(selected.text);
  const sourceFiles = files.filter((file) => file !== selected.file);
  const resolved = resolveOrderedLyncSourceFiles(manifest, sourceFiles);
  const sources = await loadOrderedLyncByteSources(resolved);
  return importRawLyncSources(sources, selected.file.name);
}
