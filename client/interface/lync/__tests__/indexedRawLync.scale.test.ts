import { expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { ReReadableLyncSource } from "@deepfates/lync/indexed-union";
import {
  BEHOLD_LYNC_PREFIX_PRESERVATION,
  BEHOLD_LYNC_PREFIX_PROTOCOL,
  BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL,
  parseOrderedLyncSourceSet,
  stableJson,
  type OrderedLyncPrefixBinding,
} from "../orderedLyncSourceSet";
import { projectIndexedOrderedLyncSources } from "../indexedRawLync";

const scaleIt = process.env.TEXTILE_SCALE_TEST === "1" ? it : it.skip;
const PHYSICAL_TURN_BYTES = 64 * 1024;
const TURNS_PER_RESIDENT = 3_744;
const REQUIRED_SOURCE_BYTES = 468 * 1024 * 1024;
const fixture = readFileSync(
  new URL("../../../../tests/e2e/fixtures/oxford-cedar-human-semantic-v2.lync", import.meta.url),
  "utf8",
).trimEnd().split("\n").map((line) => JSON.parse(line));

scaleIt(
  "projects at least 468 MiB across two residents without retaining source bytes or private payloads",
  async () => {
    const residents = await Promise.all([
      residentSource(0, "ScaleAster"),
      residentSource(1, "ScaleCedar"),
    ]);
    const base = {
      protocol: BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL,
      construction: "ordered_prefix_set" as const,
      sourceCount: residents.length,
      totalSizeBytes: residents.reduce((sum, resident) => sum + resident.binding.sizeBytes, 0),
      sources: residents.map((resident) => resident.binding),
    };
    const manifest = parseOrderedLyncSourceSet(JSON.stringify({
      ...base,
      digest: sha256(stableJson(base)),
    }));
    const projection = await projectIndexedOrderedLyncSources(
      manifest,
      residents.map((resident) => resident.source),
      "six-hour-two-resident.sources.json",
    );

    expect(projection.sourceBytes).toBeGreaterThanOrEqual(REQUIRED_SOURCE_BYTES);
    expect(projection.sourceCount).toBe(2);
    expect(projection.sourceEventCount).toBe(2 * (TURNS_PER_RESIDENT + 1));
    expect(projection.readableEventCount).toBe(2 * TURNS_PER_RESIDENT);
    expect(projection.structuralEventCount).toBe(2);
    expect(projection.ownership.index.sourceBytesScanned).toBe(projection.sourceBytes);
    expect(projection.ownership.index.retainedRawBytes).toBe(0);
    expect(projection.ownership.index.retainedPayloadObjects).toBe(0);
    expect(projection.ownership.retainedRawBytes).toBe(0);
    expect(projection.ownership.retainedSourceLineChars).toBe(0);
    expect(projection.ownership.retainedPrivatePayloadObjects).toBe(0);
    expect(projection.ownership.retainedPresentationChars).toBeLessThan(projection.sourceBytes / 20);
    const diagnosticCount = projection.snapshot.turns.reduce(
      (sum, turn) => sum + (turn.meta?.sourcePresentationDiagnostics?.length ?? 0),
      0,
    );
    expect(projection.diagnosticCount).toBe(diagnosticCount);
    const retained = JSON.stringify(projection.snapshot);
    expect(retained).not.toContain("privateCausalFrames");
    expect(retained).not.toContain("sourceLine");

    console.info(JSON.stringify({
      sourceBytes: projection.sourceBytes,
      sourceCount: projection.sourceCount,
      sourceEventCount: projection.sourceEventCount,
      readableEventCount: projection.readableEventCount,
      structuralEventCount: projection.structuralEventCount,
      diagnosticCount: projection.diagnosticCount,
      indexOwnership: projection.ownership.index,
      retainedPresentationChars: projection.ownership.retainedPresentationChars,
      retainedSourceLineChars: projection.ownership.retainedSourceLineChars,
      retainedPrivatePayloadObjects: projection.ownership.retainedPrivatePayloadObjects,
      retainedRawBytes: projection.ownership.retainedRawBytes,
    }));
  },
  180_000,
);

async function residentSource(
  sourceIndex: number,
  entityId: string,
): Promise<{ binding: OrderedLyncPrefixBinding; source: ReReadableLyncSource }> {
  const file = `${entityId}.lync`;
  const root = rootBytes(sourceIndex, entityId);
  const size = root.byteLength + TURNS_PER_RESIDENT * PHYSICAL_TURN_BYTES;
  const raw = rawResidentSource(sourceIndex, entityId, file, root, size);
  const hash = createHash("sha256");
  for await (const chunk of raw.stream()) hash.update(chunk);
  const digest = hash.digest("hex");
  const binding: OrderedLyncPrefixBinding = Object.freeze({
    order: sourceIndex,
    protocol: BEHOLD_LYNC_PREFIX_PROTOCOL,
    entityId,
    sourceFile: file,
    startOffset: 0,
    endOffset: size,
    sizeBytes: size,
    sha256: digest,
    presentationProfile: "org.behold.inhabitant.v2",
    preservation: BEHOLD_LYNC_PREFIX_PRESERVATION,
  });
  return {
    binding,
    source: { ...raw, expectedSha256: digest },
  };
}

function rawResidentSource(
  sourceIndex: number,
  entityId: string,
  file: string,
  root: Uint8Array,
  size: number,
): ReReadableLyncSource {
  return {
    file,
    size,
    async *stream() {
      yield root;
      for (let sequence = 1; sequence <= TURNS_PER_RESIDENT; sequence += 1) {
        yield turnBytes(sourceIndex, entityId, sequence);
      }
    },
    async read(start, end) {
      if (start === 0 && end === root.byteLength) return root.slice();
      const relative = start - root.byteLength;
      if (relative < 0 || relative % PHYSICAL_TURN_BYTES !== 0 || end - start !== PHYSICAL_TURN_BYTES) {
        throw new Error(`Unexpected synthetic resident reread ${start}:${end}.`);
      }
      const sequence = relative / PHYSICAL_TURN_BYTES + 1;
      if (sequence > TURNS_PER_RESIDENT) throw new Error("Synthetic resident reread is past EOF.");
      return turnBytes(sourceIndex, entityId, sequence);
    },
  };
}

function rootBytes(sourceIndex: number, entityId: string): Uint8Array {
  const root = structuredClone(fixture[0]);
  root.id = eventId(sourceIndex, 0);
  root.at = eventAt(sourceIndex, 0);
  root.author = { actor: entityId, via: "behold-scale-gate" };
  root.parents = [];
  root.payload.meta.entityId = entityId;
  root.payload.meta.profile = "org.behold.inhabitant.v2";
  return Buffer.from(`${JSON.stringify(root)}\n`);
}

function turnBytes(sourceIndex: number, entityId: string, sequence: number): Uint8Array {
  const turn = structuredClone(fixture[1]);
  turn.id = eventId(sourceIndex, sequence);
  turn.at = eventAt(sourceIndex, sequence);
  turn.author = { actor: entityId, via: "behold-scale-gate" };
  turn.parents = [eventId(sourceIndex, sequence - 1)];
  turn.payload.payload.entityId = entityId;
  turn.payload.payload.sequence = sequence;
  turn.payload.payload.privateCausalFrames = { padding: "" };
  const base = JSON.stringify(turn);
  const padding = PHYSICAL_TURN_BYTES - 1 - base.length;
  if (padding < 0) throw new Error("Synthetic resident turn exceeds its physical line budget.");
  turn.payload.payload.privateCausalFrames.padding = "x".repeat(padding);
  const encoded = Buffer.from(`${JSON.stringify(turn)}\n`);
  if (encoded.byteLength !== PHYSICAL_TURN_BYTES) {
    throw new Error(`Synthetic resident turn was ${encoded.byteLength} bytes, expected ${PHYSICAL_TURN_BYTES}.`);
  }
  return encoded;
}

function eventId(sourceIndex: number, sequence: number): string {
  return `019fc000-${sequence.toString(16).padStart(4, "0")}-7${sourceIndex}00-8${sourceIndex}00-${sequence.toString(16).padStart(12, "0")}`;
}

function eventAt(sourceIndex: number, sequence: number): string {
  return new Date(Date.UTC(2026, 7, 1, sourceIndex, 0, sequence)).toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
