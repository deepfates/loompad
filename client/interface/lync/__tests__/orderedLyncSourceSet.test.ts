import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  BEHOLD_LYNC_PREFIX_PRESERVATION,
  BEHOLD_LYNC_PREFIX_PROTOCOL,
  BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL,
  loadOrderedLyncByteSources,
  parseOrderedLyncSourceSet,
  resolveOrderedLyncSourceFiles,
  stableJson,
  verifyOrderedLyncSourceFiles,
} from "../orderedLyncSourceSet";
import { projectRawLyncSources } from "../rawLync";

const aster = readFileSync(
  new URL("../../../../tests/e2e/fixtures/oxford-aster-human-semantic-v1.lync", import.meta.url),
);
const cedar = readFileSync(
  new URL("../../../../tests/e2e/fixtures/oxford-cedar-human-semantic-v2.lync", import.meta.url),
);

describe("Behold ordered Lync source sets", () => {
  it("reads Behold's exact ordered binding shape and only its authenticated prefixes", async () => {
    const manifestText = sourceSet([
      source(0, "OxfordAster", "/canonical/OxfordAster/aster.lync", aster, "org.behold.inhabitant.v1"),
      source(1, "OxfordCedar", "/canonical/OxfordCedar/cedar.lync", cedar, "org.behold.inhabitant.v2"),
    ]);
    const manifest = parseOrderedLyncSourceSet(manifestText);
    const files = [
      new File([Uint8Array.from(aster), "later append\n"], "aster.lync"),
      new File([Uint8Array.from(cedar), "later append\n"], "cedar.lync"),
    ];
    const resolved = resolveOrderedLyncSourceFiles(manifest, files);
    await verifyOrderedLyncSourceFiles(resolved);
    const loaded = await loadOrderedLyncByteSources(resolved);
    expect(Buffer.from(loaded[0]!.bytes)).toEqual(aster);
    expect(Buffer.from(loaded[1]!.bytes)).toEqual(cedar);

    const projection = projectRawLyncSources(loaded, "episode.sources.json");
    expect(projection.sourceEventCount).toBeGreaterThan(0);
    expect(projection.readableEventCount).toBeGreaterThan(0);
    expect(projection.unsupportedEventCount).toBe(0);
  });

  it("fails closed on order, digest, prefix, and selected-file ambiguity", async () => {
    const manifestText = sourceSet([
      source(0, "OxfordAster", "/canonical/OxfordAster/aster.lync", aster, "org.behold.inhabitant.v1"),
      source(1, "OxfordCedar", "/canonical/OxfordCedar/cedar.lync", cedar, "org.behold.inhabitant.v2"),
    ]);
    const decoded = JSON.parse(manifestText);
    decoded.sources[0].order = 1;
    decoded.sources[1].order = 0;
    decoded.digest = digest(stableJson(withoutDigest(decoded)));
    expect(() => parseOrderedLyncSourceSet(JSON.stringify(decoded))).toThrow(/array position/);

    const changed = JSON.parse(manifestText);
    changed.totalSizeBytes += 1;
    expect(() => parseOrderedLyncSourceSet(JSON.stringify(changed))).toThrow(/byte total/);

    const manifest = parseOrderedLyncSourceSet(manifestText);
    expect(() => resolveOrderedLyncSourceFiles(manifest, [
      new File([Uint8Array.from(aster)], "aster.lync"),
      new File([Uint8Array.from(cedar)], "aster.lync"),
    ])).toThrow(/ambiguous/);
    expect(() => resolveOrderedLyncSourceFiles(manifest, [
      new File([Uint8Array.from(aster)], "aster.lync"),
    ])).toThrow(/exactly 2/);

    const damaged = Uint8Array.from(aster);
    damaged[10] ^= 1;
    const resolved = resolveOrderedLyncSourceFiles(manifest, [
      new File([damaged], "aster.lync"),
      new File([Uint8Array.from(cedar)], "cedar.lync"),
    ]);
    await expect(verifyOrderedLyncSourceFiles(resolved)).rejects.toThrow(/digest does not match/);

    const falselyBound = parseOrderedLyncSourceSet(sourceSet([
      source(0, "SomeoneElse", "/canonical/OxfordAster/aster.lync", aster, "org.behold.inhabitant.v1"),
    ]));
    await expect(verifyOrderedLyncSourceFiles(resolveOrderedLyncSourceFiles(falselyBound, [
      new File([Uint8Array.from(aster)], "aster.lync"),
    ]))).rejects.toThrow(/does not match its resident binding/);
  });
});

function source(
  order: number,
  entityId: string,
  sourceFile: string,
  bytes: Uint8Array,
  presentationProfile: "org.behold.inhabitant.v1" | "org.behold.inhabitant.v2",
) {
  return {
    order,
    protocol: BEHOLD_LYNC_PREFIX_PROTOCOL,
    entityId,
    presentationProfile,
    sourceFile,
    startOffset: 0,
    endOffset: bytes.byteLength,
    sizeBytes: bytes.byteLength,
    sha256: digest(bytes),
    preservation: BEHOLD_LYNC_PREFIX_PRESERVATION,
  };
}

function sourceSet(sources: ReturnType<typeof source>[]): string {
  const base = {
    protocol: BEHOLD_ORDERED_LYNC_SOURCE_SET_PROTOCOL,
    construction: "ordered_prefix_set",
    sourceCount: sources.length,
    totalSizeBytes: sources.reduce((sum, item) => sum + item.sizeBytes, 0),
    sources,
  };
  return JSON.stringify({ ...base, digest: digest(stableJson(base)) });
}

function withoutDigest(value: Record<string, unknown>): Record<string, unknown> {
  const { digest: _digest, ...base } = value;
  return base;
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
