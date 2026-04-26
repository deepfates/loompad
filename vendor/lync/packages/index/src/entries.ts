import type { LoomReference } from "../../core/src/index";
import type {
  LoomIndex,
  LoomIndexEntry,
  LoomIndexEntryInput,
} from "./types.js";

export async function upsertLoom<TEntryMeta, TIndexMeta>(
  index: LoomIndex<TEntryMeta, TIndexMeta>,
  ref: Extract<LoomReference, { kind: "loom" }>,
  entry: LoomIndexEntryInput<TEntryMeta> = {},
): Promise<LoomIndexEntry<TEntryMeta>> {
  if (await index.has(ref.loomId)) {
    return index.updateLoom(ref.loomId, entry);
  }
  return index.addLoom(ref, entry);
}
