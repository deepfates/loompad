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
import {
  orderedLyncFileSource,
  projectIndexedOrderedLyncSources,
  projectOrderedLyncSourceFiles,
} from "../indexedRawLync";
import { importTextileFiles } from "../twitterArchiveImport";

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

  it("opens the ordinary two-resident set read-only with public text and authenticated locators only", async () => {
    const privateSentinel = "PRIVATE-RESIDENT-FRAME-MUST-NOT-BE-RETAINED";
    const cedarLines = cedar.toString("utf8").trimEnd().split("\n").map((line) => JSON.parse(line));
    cedarLines[1].payload.payload.privateCausalFrames = { secret: privateSentinel };
    const cedarPrivate = Buffer.from(`${cedarLines.map((line) => JSON.stringify(line)).join("\n")}\n`);
    const manifestText = sourceSet([
      source(0, "OxfordAster", "/canonical/OxfordAster/aster.lync", aster, "org.behold.inhabitant.v1"),
      source(1, "OxfordCedar", "/canonical/OxfordCedar/cedar.lync", cedarPrivate, "org.behold.inhabitant.v2"),
    ]);
    const manifestFile = new File([manifestText], "episode.sources.json");
    const files = [
      new File([Uint8Array.from(aster), "unbound later append\n"], "aster.lync"),
      new File([Uint8Array.from(cedarPrivate), "unbound later append\n"], "cedar.lync"),
    ];
    const manifest = parseOrderedLyncSourceSet(manifestText);
    const projection = await projectOrderedLyncSourceFiles(
      manifest,
      resolveOrderedLyncSourceFiles(manifest, files),
      manifestFile.name,
    );

    expect(projection.sourceCount).toBe(2);
    expect(projection.sourceEventCount).toBe(4);
    expect(projection.readableEventCount).toBe(2);
    expect(projection.structuralEventCount).toBe(2);
    expect(projection.snapshot.turns).toHaveLength(5);
    expect(projection.ownership.index.retainedRawBytes).toBe(0);
    expect(projection.ownership.index.retainedPayloadObjects).toBe(0);
    expect(projection.ownership.retainedSourceLineChars).toBe(0);
    expect(projection.ownership.retainedPrivatePayloadObjects).toBe(0);
    expect(projection.ownership.retainedRawBytes).toBe(0);
    const retained = JSON.stringify(projection.snapshot);
    expect(retained).not.toContain(privateSentinel);
    expect(retained).not.toContain("sourceLine");
    const cedarTurn = projection.snapshot.turns.find((turn) => turn.meta?.sourceKind === "lync/turn" && turn.meta.author === "OxfordCedar");
    expect(cedarTurn?.meta.sourceLocator).toMatchObject({
      file: "cedar.lync",
      source: 1,
      residentEntityId: "OxfordCedar",
      manifestDigest: manifest.digest,
      sourceSha256: manifest.sources[1]!.sha256,
    });

    const imported = await importTextileFiles([manifestFile, ...files]);
    expect(imported.readOnly).toBe(true);
    expect(imported.view?.tree.root.continuations).toHaveLength(2);
    expect(imported.turnCount).toBe(4);
    await expect(imported.view!.loom.appendTurn(null, { text: "mutation" }, { role: "prose" }))
      .rejects.toThrow(/read-only/);
  });

  it("normalizes browser-native Blob chunks to Lync's indexed admission bound", async () => {
    const bytes = new Uint8Array(1024 * 1024 + 65_536).fill(7);
    const file = {
      name: "wide-browser-chunk.lync",
      size: bytes.byteLength,
      slice: () => ({
        stream: () =>
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
        arrayBuffer: async () => bytes.slice().buffer,
      }),
    } as unknown as File;
    const binding = source(
      0,
      "OxfordWide",
      "/canonical/OxfordWide/wide-browser-chunk.lync",
      bytes,
      "org.behold.inhabitant.v2",
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of orderedLyncFileSource({ binding, file }).stream()) {
      chunks.push(chunk);
    }
    expect(chunks.map((chunk) => chunk.byteLength)).toEqual([1024 * 1024, 65_536]);
    expect(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))).toEqual(Buffer.from(bytes));
  });

  it("fails closed on union conflicts and source changes between index and projection", async () => {
    const lines = aster.toString("utf8").trimEnd().split("\n");
    const conflicting = JSON.parse(lines[1]!);
    conflicting.payload.payload.sequence = 999;
    const conflictBytes = Buffer.from(`${lines.join("\n")}\n${JSON.stringify(conflicting)}\n`);
    const conflictManifest = parseOrderedLyncSourceSet(sourceSet([
      source(0, "OxfordAster", "aster.lync", conflictBytes, "org.behold.inhabitant.v1"),
    ]));
    const conflictFile = new File([Uint8Array.from(conflictBytes)], "aster.lync");
    await expect(projectOrderedLyncSourceFiles(
      conflictManifest,
      resolveOrderedLyncSourceFiles(conflictManifest, [conflictFile]),
      "conflict.sources.json",
    )).rejects.toThrow(/conflict/);

    const manifest = parseOrderedLyncSourceSet(sourceSet([
      source(0, "OxfordAster", "aster.lync", aster, "org.behold.inhabitant.v1"),
    ]));
    const stable = orderedLyncFileSource(resolveOrderedLyncSourceFiles(manifest, [
      new File([Uint8Array.from(aster)], "aster.lync"),
    ])[0]!);
    let reads = 0;
    await expect(projectIndexedOrderedLyncSources(manifest, [{
      ...stable,
      async read(start, end) {
        const exact = await stable.read(start, end);
        reads += 1;
        if (reads === 1 && exact.length > 8) exact[8] ^= 1;
        return exact;
      },
    }], "changed.sources.json")).rejects.toThrow(/changed|reordered|no longer matches/);

    const truncated = orderedLyncFileSource(resolveOrderedLyncSourceFiles(manifest, [
      new File([Uint8Array.from(aster)], "aster.lync"),
    ])[0]!);
    await expect(projectIndexedOrderedLyncSources(manifest, [{
      ...truncated,
      async *stream() {
        let remaining = truncated.size - 1;
        for await (const chunk of truncated.stream()) {
          if (remaining <= 0) break;
          const held = chunk.subarray(0, remaining);
          remaining -= held.byteLength;
          yield held;
        }
      },
    }], "truncated.sources.json")).rejects.toThrow(/supplied .* expected|complete prefix/);
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
