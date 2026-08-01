import { createHash } from "node:crypto";

import type { RawLyncByteSource } from "./rawLync";

export const BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL =
  "behold.live-textile-source-set.v2" as const;
export const BEHOLD_LYNC_PREFIX_PROTOCOL = "behold.live-lync-prefix.v2" as const;
export const BEHOLD_LYNC_PREFIX_PRESERVATION =
  "immutable_prefix_of_canonical_append_only_source" as const;
const MAX_ROOT_LINE_BYTES = 1024 * 1024;

export type OrderedLyncPrefixBinding = Readonly<{
  order: number;
  protocol: typeof BEHOLD_LYNC_PREFIX_PROTOCOL;
  entityId: string;
  sourceFile: string;
  startOffset: 0;
  endOffset: number;
  sizeBytes: number;
  sha256: string;
  presentationProfile: "org.behold.inhabitant.v1" | "org.behold.inhabitant.v2";
  preservation: typeof BEHOLD_LYNC_PREFIX_PRESERVATION;
}>;

export type OrderedLyncSourceSet = Readonly<{
  protocol: typeof BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL;
  construction: "ordered_prefix_set";
  sourceCount: number;
  totalSizeBytes: number;
  sources: readonly OrderedLyncPrefixBinding[];
  digest: string;
}>;

export type OrderedLyncSourceFile = Readonly<{
  binding: OrderedLyncPrefixBinding;
  file: File;
}>;

/** Parse and authenticate Behold's small source-set manifest, never its source paths. */
export function parseOrderedLyncSourceSet(text: string): OrderedLyncSourceSet {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("Ordered Lync source-set manifest is not valid JSON.");
  }
  const value = exactObject(
    decoded,
    ["protocol", "construction", "sourceCount", "totalSizeBytes", "sources", "digest"],
    "ordered Lync source-set manifest",
  );
  if (value.protocol !== BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL) {
    throw new Error("Unsupported ordered Lync source-set protocol.");
  }
  if (value.construction !== "ordered_prefix_set") {
    throw new Error("Ordered Lync source set has an unsupported construction.");
  }
  const sourceCount = nonnegativeInteger(value.sourceCount, "sourceCount");
  if (sourceCount < 1) throw new Error("Ordered Lync source set requires at least one source.");
  const totalSizeBytes = nonnegativeInteger(value.totalSizeBytes, "totalSizeBytes");
  if (!Array.isArray(value.sources) || value.sources.length !== sourceCount) {
    throw new Error("Ordered Lync source-set count does not match its sources.");
  }
  const sources = value.sources.map((source, index) => parsePrefixBinding(source, index));
  if (sources.reduce((sum, source) => sum + source.sizeBytes, 0) !== totalSizeBytes) {
    throw new Error("Ordered Lync source-set byte total does not match its sources.");
  }
  const basenames = sources.map((source) => sourceBasename(source.sourceFile));
  if (new Set(basenames).size !== basenames.length) {
    throw new Error("Ordered Lync source-set basenames are ambiguous.");
  }
  const digest = exactSha256(value.digest, "source-set digest");
  const base = {
    protocol: BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL,
    construction: "ordered_prefix_set" as const,
    sourceCount,
    totalSizeBytes,
    sources,
  };
  if (sha256(stableJson(base)) !== digest) {
    throw new Error("Ordered Lync source-set manifest digest does not match its content.");
  }
  return Object.freeze({ ...base, digest });
}

/**
 * Match operator-selected browser files to exact manifest entries. Absolute
 * canonical paths are provenance only: the browser never dereferences them.
 */
export function resolveOrderedLyncSourceFiles(
  manifest: OrderedLyncSourceSet,
  selectedFiles: ReadonlyArray<File>,
): readonly OrderedLyncSourceFile[] {
  const byName = new Map<string, File>();
  for (const file of selectedFiles) {
    if (byName.has(file.name)) {
      throw new Error(`Selected Lync source basename is ambiguous: ${file.name}.`);
    }
    byName.set(file.name, file);
  }
  if (byName.size !== manifest.sourceCount) {
    throw new Error(
      `Ordered Lync source set requires exactly ${manifest.sourceCount} selected source files.`,
    );
  }
  return Object.freeze(manifest.sources.map((binding) => {
    const basename = sourceBasename(binding.sourceFile);
    const file = byName.get(basename);
    if (!file) throw new Error(`Ordered Lync source is missing: ${basename}.`);
    if (file.size < binding.endOffset) {
      throw new Error(`Ordered Lync source is shorter than its bound prefix: ${basename}.`);
    }
    return Object.freeze({ binding, file });
  }));
}

/** Verify every exact prefix with bounded hashing and without retaining corpus bytes. */
export async function verifyOrderedLyncSourceFiles(
  sources: ReadonlyArray<OrderedLyncSourceFile>,
): Promise<void> {
  for (const source of sources) await readAndVerifyPrefix(source, false);
}

/**
 * Load verified prefixes without an eager union string or TextEncoder copy.
 * This removes the old union duplication, but the existing Lync projector still
 * retains the complete byte/event set; tex-wrif remains open for bounded scale.
 */
export async function loadOrderedLyncByteSources(
  sources: ReadonlyArray<OrderedLyncSourceFile>,
): Promise<readonly RawLyncByteSource[]> {
  const loaded: RawLyncByteSource[] = [];
  for (const source of sources) {
    loaded.push({
      file: sourceBasename(source.binding.sourceFile),
      bytes: (await readAndVerifyPrefix(source, true))!,
    });
  }
  return Object.freeze(loaded);
}

async function readAndVerifyPrefix(
  source: OrderedLyncSourceFile,
  materialize: boolean,
): Promise<Uint8Array | null> {
  const { binding, file } = source;
  let bytes: Uint8Array | null = null;
  if (materialize) {
    try {
      bytes = new Uint8Array(binding.endOffset);
    } catch {
      throw new Error(
        `Ordered Lync source prefix cannot be materialized in this browser: ${file.name}.`,
      );
    }
  }
  const hash = createHash("sha256");
  const rootChunks: Uint8Array[] = [];
  let rootBytes = 0;
  let rootComplete = false;
  const reader = file.slice(binding.startOffset, binding.endOffset).stream().getReader();
  let offset = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      // Enforce the byte bound ourselves. Browsers honor Blob.slice here; Bun's
      // File stream has historically yielded the backing Blob's full chunk.
      const remaining = binding.endOffset - offset;
      const chunk = result.value.subarray(0, remaining);
      hash.update(chunk);
      bytes?.set(chunk, offset);
      if (!rootComplete) {
        const newline = chunk.indexOf(0x0a);
        const take = newline < 0 ? chunk.byteLength : newline;
        rootBytes += take;
        if (rootBytes > MAX_ROOT_LINE_BYTES) {
          throw new Error(`Ordered Lync source root line is unreasonably large: ${file.name}.`);
        }
        rootChunks.push(chunk.slice(0, take));
        rootComplete = newline >= 0;
      }
      offset += chunk.byteLength;
      if (offset === binding.endOffset) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (offset !== binding.endOffset) {
    throw new Error(`Ordered Lync source did not supply its complete prefix: ${file.name}.`);
  }
  if (!rootComplete) throw new Error(`Ordered Lync source has no complete root line: ${file.name}.`);
  if (hash.digest("hex") !== binding.sha256) {
    throw new Error(`Ordered Lync source prefix digest does not match: ${file.name}.`);
  }
  verifyResidentRoot(binding, rootChunks, rootBytes, file.name);
  return bytes;
}

function verifyResidentRoot(
  binding: OrderedLyncPrefixBinding,
  chunks: readonly Uint8Array[],
  size: number,
  filename: string,
): void {
  const rootBytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    rootBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let root: unknown;
  try {
    root = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rootBytes));
  } catch {
    throw new Error(`Ordered Lync source has an invalid root line: ${filename}.`);
  }
  const event = root as {
    kind?: unknown;
    payload?: { meta?: { protocol?: unknown; entityId?: unknown; profile?: unknown } };
  };
  const meta = event.kind === "lync/loom" ? event.payload?.meta : undefined;
  if (
    meta?.protocol !== "behold.entity-loom.v1" ||
    meta.entityId !== binding.entityId ||
    meta.profile !== binding.presentationProfile
  ) {
    throw new Error(`Ordered Lync source root does not match its resident binding: ${filename}.`);
  }
}

function parsePrefixBinding(value: unknown, expectedOrder: number): OrderedLyncPrefixBinding {
  const binding = exactObject(
    value,
    [
      "order",
      "protocol",
      "entityId",
      "sourceFile",
      "startOffset",
      "endOffset",
      "sizeBytes",
      "sha256",
      "presentationProfile",
      "preservation",
    ],
    "ordered Lync prefix binding",
  );
  if (binding.protocol !== BEHOLD_LYNC_PREFIX_PROTOCOL) {
    throw new Error("Unsupported ordered Lync prefix protocol.");
  }
  if (binding.order !== expectedOrder) {
    throw new Error("Ordered Lync prefix order does not match its array position.");
  }
  const entityId = requiredString(binding.entityId, "prefix entityId");
  const sourceFile = requiredString(binding.sourceFile, "prefix sourceFile");
  if (binding.startOffset !== 0) throw new Error("Ordered Lync prefix must start at byte zero.");
  const endOffset = nonnegativeInteger(binding.endOffset, "prefix endOffset");
  const sizeBytes = nonnegativeInteger(binding.sizeBytes, "prefix sizeBytes");
  if (endOffset < 1 || endOffset !== sizeBytes) {
    throw new Error("Ordered Lync prefix end and size must be the same positive byte count.");
  }
  const presentationProfile = binding.presentationProfile;
  if (
    presentationProfile !== "org.behold.inhabitant.v1" &&
    presentationProfile !== "org.behold.inhabitant.v2"
  ) {
    throw new Error("Ordered Lync prefix has an unsupported presentation profile.");
  }
  if (binding.preservation !== BEHOLD_LYNC_PREFIX_PRESERVATION) {
    throw new Error("Ordered Lync prefix has an unsupported preservation contract.");
  }
  return Object.freeze({
    order: expectedOrder,
    protocol: BEHOLD_LYNC_PREFIX_PROTOCOL,
    entityId,
    sourceFile,
    startOffset: 0,
    endOffset,
    sizeBytes,
    sha256: exactSha256(binding.sha256, "prefix digest"),
    presentationProfile,
    preservation: BEHOLD_LYNC_PREFIX_PRESERVATION,
  });
}

function exactObject(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unknown or missing fields.`);
  }
  return value as Record<string, unknown>;
}

function sourceBasename(sourceFile: string): string {
  const basename = sourceFile.split(/[\\/]/).at(-1)?.trim() ?? "";
  if (!basename || basename === "." || basename === "..") {
    throw new Error("Ordered Lync source path has no safe basename.");
  }
  return basename;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || /[\r\n\0]/.test(value)) {
    throw new Error(`Ordered Lync ${label} is invalid.`);
  }
  return value;
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Ordered Lync ${label} is not a nonnegative safe integer.`);
  }
  return Number(value);
}

function exactSha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`Ordered Lync ${label} is not an exact lowercase SHA-256.`);
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Stable JSON cannot encode this value.");
  return encoded;
}
