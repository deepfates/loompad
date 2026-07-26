import { describe, expect, it } from "bun:test";
import {
  buildRawLyncKeptContextArtifact,
  buildKeptStoryExport,
  buildRawLyncCurationEvents,
  buildRawLyncNoteEvents,
  buildRawLyncSelectionEvents,
  collectKeptEntries,
  hasRawLyncSources,
  keptContextImportSource,
  parseKeptContextMarkdown,
} from "../storyExport";
import type { StoryNode } from "../../types";
import type {
  RawLyncPayloadState,
  RawLyncSourceArchive,
  RawLyncSourceRecord,
} from "../../lync/rawLyncArchiveTypes";

// A small curated tree: root → (A kept) → (A1) , (B) , where A carries a note.
// Only A is kept, so the curated set must contain exactly A (with its note and
// its root→A thread), never B or A1.
function curatedTree(): { root: StoryNode } {
  return {
    root: {
      id: "root",
      text: "Seed",
      origin: "human",
      actor: "ada",
      continuations: [
        {
          id: "A",
          text: "Kept branch",
          origin: "model",
          actor: "ada",
          kept: true,
          annotations: [
            { id: "n1", text: "training-worthy", actor: "ada", createdAt: 10 },
          ],
          continuations: [
            { id: "A1", text: "Child of kept", origin: "model", continuations: [] },
          ],
        },
        {
          id: "B",
          text: "Discarded branch",
          origin: "model",
          continuations: [],
        },
      ],
    },
  };
}

describe("curated (KEPT) export", () => {
  it("collects exactly the kept turns, with annotations and thread", () => {
    const entries = collectKeptEntries(curatedTree().root);
    expect(entries.map((e) => e.id)).toEqual(["A"]);
    const [a] = entries;
    expect(a.text).toBe("Kept branch");
    expect(a.origin).toBe("model");
    expect(a.annotations.map((n) => n.text)).toEqual(["training-worthy"]);
    // Thread is the root→node path so the kept line has its context.
    expect(a.thread.map((t) => t.id)).toEqual(["root", "A"]);
  });

  it("emits ONLY the kept set in the curated payload", () => {
    const tree = curatedTree();
    // Mark the root kept too — the set is now {root, A}, still never B or A1.
    tree.root.kept = true;
    const payload = buildKeptStoryExport("Story 1", tree);
    expect(payload.kind).toBe("curated");
    expect(payload.title).toBe("Story 1");
    expect(payload.kept.map((e) => e.id)).toEqual(["root", "A"]);
  });

  it("emits an empty curated set when nothing is kept (visible, not silent)", () => {
    const tree = curatedTree();
    // Drop every keep mark.
    tree.root.continuations![0].kept = undefined;
    const payload = buildKeptStoryExport("Story 1", tree);
    expect(payload.kept).toEqual([]);
  });
});

describe("raw Lync selection export", () => {
  it("targets exact source siblings with the positive keep event identity", () => {
    const A = "0197e6a0-4a09-7000-8000-000000000001";
    const B = "0197e6a0-4a09-7000-8000-000000000002";
    const mark = "0197e6a0-4a09-7000-8000-00000000000e";
    const tree: { root: StoryNode } = {
      root: {
        id: "virtual",
        text: "corpus",
        origin: "unknown",
        continuations: [
          {
            id: "internal-a",
            sourceId: A,
            text: "A",
            origin: "model",
            kept: true,
            keepMark: { id: mark, createdAt: Date.parse("2026-07-06T04:10:15Z"), actor: "ada", via: "textile-browser" },
            continuations: [],
          },
          {
            id: "internal-b",
            sourceId: B,
            text: "B",
            origin: "model",
            continuations: [],
          },
        ],
      },
    };

    expect(hasRawLyncSources(tree.root)).toBe(true);
    expect(buildRawLyncSelectionEvents(tree)).toEqual([
      {
        v: 1,
        id: mark,
        kind: "lync/annotation",
        at: "2026-07-06T04:10:15.000Z",
        author: { actor: "ada", via: "textile-browser" },
        parents: [A, B],
        payload: {
          label: "selection",
          chosen: [A],
          shown: [A, B],
          basis: "human pick",
        },
      },
    ]);
  });

  it("does not duplicate a selection imported from the corpus", () => {
    const tree: { root: StoryNode } = {
      root: {
        id: "internal",
        sourceId: "0197e6a0-4a09-7000-8000-000000000001",
        text: "already selected",
        origin: "model",
        kept: true,
        continuations: [],
      },
    };
    expect(buildRawLyncSelectionEvents(tree)).toEqual([]);
  });

  it("exports human notes against exact source ids with portable authorship", () => {
    const source = "0197e6a0-4a09-7000-8000-000000000001";
    const note = "0197e6a0-4a09-7000-8000-00000000000f";
    const tree: { root: StoryNode } = {
      root: {
        id: "virtual",
        text: "corpus",
        origin: "unknown",
        continuations: [
          {
            id: "reminted-import-id",
            sourceId: source,
            text: "Source text",
            origin: "unknown",
            annotations: [
              {
                id: note,
                text: "Retain the provenance example.",
                actor: "Grace",
                via: "textile-browser",
                createdAt: Date.parse("2026-07-06T04:10:16Z"),
              },
            ],
            continuations: [],
          },
        ],
      },
    };

    expect(buildRawLyncNoteEvents(tree)).toEqual([
      {
        v: 1,
        id: note,
        kind: "lync/annotation",
        at: "2026-07-06T04:10:16.000Z",
        author: { actor: "Grace", via: "textile-browser" },
        parents: [source],
        payload: { label: "note", text: "Retain the provenance example." },
      },
    ]);
    expect(buildRawLyncCurationEvents(tree)).toEqual(buildRawLyncNoteEvents(tree));
  });
});

describe("raw Lync kept-context export", () => {
  it("exports exact kept targets with all-parent ancestry, not comparison siblings", () => {
    const tree = keptContextTree();
    const artifact = buildRawLyncKeptContextArtifact("Corpus proof", tree);
    const manifest = artifact.manifest;

    expect(manifest.keptTargets.map((target) => target.sourceId)).toEqual(["A", "D"]);
    expect(manifest.targetDownsets).toEqual([
      { target: "A", ids: ["R", "A"] },
      { target: "D", ids: ["R", "A", "X", "D"] },
    ]);
    expect(manifest.firstParentPaths).toEqual([
      { target: "A", ids: ["R", "A"] },
      { target: "D", ids: ["R", "A", "D"] },
    ]);
    expect(manifest.eventOrder).toEqual(["R", "A", "X", "D"]);
    expect(manifest.events.map((event) => event.id)).not.toContain("B");
    expect(manifest.events.find((event) => event.id === "X")?.presentation.contract)
      .toBe("textile/unsupported-source");
    expect(manifest.comparisonOnlyReferences).toEqual(["B"]);
    expect(manifest.curationPatch.find((event) => event.id === "keep-A")?.payload)
      .toEqual({
        label: "selection",
        chosen: ["A"],
        shown: ["A", "B"],
        basis: "human pick",
      });
    expect(manifest.keptTargets[0]?.sourceSelectionIds).toEqual(["source-select-A"]);
    expect(
      (manifest.curationPatch.find((event) => event.id === "source-select-A") as { digest?: string })
        ?.digest,
    ).toBe(`sha256:${"a".repeat(64)}`);
    expect(manifest.partial).toBe(false);

    expect(artifact.markdown).toContain("Kept prose A");
    expect(artifact.markdown).toContain("Kept prose D");
    expect(artifact.markdown).toContain("Unsupported source kind domain/unknown");
    expect(artifact.markdown).toContain("Additional causal ancestors");
    expect(artifact.markdown).toContain("Retain this exact exchange.");
    expect(artifact.markdown).not.toContain("Comparison prose B");
    expect(parseKeptContextMarkdown(artifact.markdown)).toEqual(manifest);

    const reopened = keptContextImportSource(manifest);
    const reopenedIds = reopened.text.trim().split("\n").map((line) => JSON.parse(line).id);
    expect(reopenedIds).toEqual(["R", "A", "X", "D"]);
    expect(reopened.selectedSourceIds).toEqual(["A", "D"]);
    expect(reopened.carriedCuration.map((event) => event.id)).toEqual([
      "keep-A",
      "keep-D",
      "note-A",
      "source-select-A",
    ]);
    expect(manifest.semantics.actorRoles).toBe("not-inferred");
  });

  it("is deterministic across source-record permutations", () => {
    const first = keptContextTree();
    const second = keptContextTree();
    second.root.sourceArchive!.records.reverse();
    expect(buildRawLyncKeptContextArtifact("Corpus proof", second).markdown)
      .toBe(buildRawLyncKeptContextArtifact("Corpus proof", first).markdown);
  });

  it("keeps a Textile revision as itself with its raw source ancestry", () => {
    const archive = sourceArchive([
      sourceRecord("R", [], "Raw root"),
      sourceRecord("A", ["R"], "Original raw prose"),
    ]);
    const tree: { root: StoryNode } = {
      root: {
        id: "virtual",
        text: "corpus",
        origin: "unknown",
        sourceArchive: archive,
        continuations: [{
          id: "visible-R",
          sourceId: "R",
          sourceKind: "notes/text",
          sourceParents: [],
          text: "Raw root",
          origin: "unknown",
          continuations: [{
            id: "visible-A",
            sourceId: "A",
            sourceKind: "notes/text",
            sourceParents: ["R"],
            text: "Original raw prose",
            origin: "unknown",
            continuations: [{
              id: "local-revision",
              text: "Human-edited alternative prose",
              origin: "human",
              actor: "Ada",
              via: "textile-browser",
              turnRole: "revision",
              revises: "visible-A",
              revisesSourceId: "A",
              kept: true,
              keepMark: {
                id: "keep-local",
                createdAt: Date.parse("2026-07-26T08:01:00Z"),
                actor: "Ada",
                via: "textile-browser",
              },
              annotations: [{
                id: "note-local",
                text: "Keep the edit as an edit.",
                actor: "Ada",
                via: "textile-browser",
                createdAt: Date.parse("2026-07-26T08:02:00Z"),
              }],
              continuations: [],
            }],
          }],
        }],
      },
    };

    const artifact = buildRawLyncKeptContextArtifact("revision.lync", tree, {
      loomId: "lync:origin",
      rootTurnId: "virtual",
      visibleSourceEventIds: ["A", "R"],
    });
    expect(artifact.manifest.keptTargets).toEqual([]);
    expect(artifact.manifest.localKeptTargets).toEqual([{
      turnId: "local-revision",
      originLoomId: "lync:origin",
      contextPath: [
        { kind: "source-event", id: "R" },
        { kind: "source-event", id: "A" },
        { kind: "textile-turn", id: "local-revision" },
      ],
    }]);
    expect(artifact.manifest.targetDownsets).toEqual([{
      target: "local-revision",
      ids: ["R", "A"],
    }]);
    expect(artifact.manifest.localTurns).toEqual([expect.objectContaining({
      turnId: "local-revision",
      originLoomId: "lync:origin",
      parent: { kind: "source-event", id: "A" },
      text: "Human-edited alternative prose",
      role: "revision",
      revisesRef: { kind: "source-event", id: "A" },
      keepEvent: expect.objectContaining({ id: "keep-local" }),
      notes: [expect.objectContaining({ id: "note-local" })],
    })]);
    expect(artifact.markdown).toContain("Human-edited alternative prose");
    expect(artifact.markdown).toContain("this is a Textile turn, not a rewritten raw source event");
    const reopened = keptContextImportSource(artifact.manifest);
    expect(reopened.selectedSourceIds).toEqual([]);
    expect(reopened.carriedLocalTurns).toEqual(artifact.manifest.localTurns);
  });

  it("reports missing ancestors as partial instead of silently dropping context", () => {
    const tree = keptContextTree();
    tree.root.sourceArchive!.records = tree.root.sourceArchive!.records.filter(
      (record) => record.id !== "X",
    );
    const manifest = buildRawLyncKeptContextArtifact("Partial proof", tree).manifest;
    expect(manifest.partial).toBe(true);
    expect(manifest.obstacles).toContainEqual({
      class: "dangling",
      missing: "X",
      target: "D",
    });
    expect(manifest.events.find((event) => event.id === "D")?.parentRefs[1]).toEqual({
      id: "X",
      index: 1,
      role: "additional-parent",
      resolved: false,
    });
  });

  it("keeps policy-withheld bodies out of Markdown and the machine manifest", () => {
    const archive = sourceArchive([
      sourceRecord("P", [], "DO NOT LEAK SUPPRESSED", "notes/text", "critical-suppressed", ["C"]),
      sourceRecord("N", ["P"], "DO NOT LEAK NO TRAIN", "notes/text", "no-train", ["Q"]),
      sourceRecord("C", ["P"], "DO NOT LEAK CRITICAL BODY", "future/embargo", "critical-policy", ["C"]),
      sourceRecord("Q", ["N"], "DO NOT LEAK POLICY BODY", "lync/annotation", "no-train-policy", ["Q"]),
    ]);
    for (const record of archive.records) {
      if (record.payloadState !== "available") {
        delete record.payload;
        delete record.sourceLine;
      }
    }
    archive.suppressedPayloadIds = ["P"];
    archive.noTrainTargetIds = ["N"];
    archive.policyEventIds = ["C", "Q"];
    const tree: { root: StoryNode } = {
      root: {
        id: "virtual",
        text: "policy corpus",
        origin: "unknown",
        sourceArchive: archive,
        continuations: [{
          id: "visible-N",
          sourceId: "N",
          sourceKind: "notes/text",
          sourceParents: ["P"],
          text: "Payload withheld by policy.",
          origin: "unknown",
          kept: true,
          continuations: [],
        }],
      },
    };

    const artifact = buildRawLyncKeptContextArtifact("Policy proof", tree);
    expect(artifact.manifest.events.map((event) => event.id)).toEqual(["P", "N"]);
    expect(artifact.manifest.policyEvents.map((event) => event.id)).toEqual(["C", "Q"]);
    expect(artifact.manifest.dropReport.map((drop) => drop.category)).toEqual([
      "critical-suppressed",
      "no-train",
    ]);
    expect(artifact.manifest.partial).toBe(true);
    expect(artifact.markdown).not.toContain("DO NOT LEAK");
    expect(JSON.stringify(artifact.manifest)).not.toContain("DO NOT LEAK");
    expect(() => keptContextImportSource(artifact.manifest)).toThrow(
      /payloads are intentionally withheld \(P, N\)/,
    );
  });

  it("re-applies policy to legacy records that incorrectly carried critical payloads", () => {
    const tree = keptContextTree();
    const record = tree.root.sourceArchive!.records.find((candidate) => candidate.id === "A")!;
    record.envelope.critical = true;
    record.payload = { text: "LEGACY CRITICAL SECRET" };
    record.sourceLine = JSON.stringify({ ...record.envelope, payload: record.payload });
    record.payloadState = "available";
    const artifact = buildRawLyncKeptContextArtifact("Legacy policy", tree);
    const safe = artifact.manifest.events.find((event) => event.id === "A")!;
    expect(safe.payloadState).toBe("critical-policy");
    expect(safe.payload).toBeUndefined();
    expect(safe.sourceLine).toBeUndefined();
    expect(artifact.markdown).not.toContain("LEGACY CRITICAL SECRET");
    expect(JSON.stringify(artifact.manifest)).not.toContain("LEGACY CRITICAL SECRET");
  });
});

function keptContextTree(): { root: StoryNode } {
  const archive = sourceArchive([
    sourceRecord("B", ["R"], "Comparison prose B"),
    sourceRecord("D", ["A", "X"], "Kept prose D"),
    sourceRecord("R", [], "Root context"),
    sourceRecord("X", ["R"], "Machine-only source", "domain/unknown"),
      sourceRecord("A", ["R"], "Kept prose A"),
    ]);
  archive.records.push(annotationRecord(
    "source-select-A",
    ["A", "B"],
    { label: "selection", chosen: ["A"], shown: ["A", "B"], basis: "panel" },
  ));
  return {
    root: {
      id: "virtual",
      text: "corpus",
      origin: "unknown",
      sourceArchive: archive,
      continuations: [{
        id: "visible-R",
        sourceId: "R",
        sourceKind: "notes/text",
        sourceParents: [],
        text: "Root context",
        origin: "unknown",
        actor: "root-writer",
        continuations: [
          {
            id: "visible-A",
            sourceId: "A",
            sourceKind: "notes/text",
            sourceParents: ["R"],
            text: "Kept prose A",
            origin: "unknown",
            actor: "writer-a",
            kept: true,
            keepMark: {
              id: "keep-A",
              createdAt: Date.parse("2026-07-06T04:10:03Z"),
              actor: "curator",
              via: "textile-browser",
            },
            annotations: [{
              id: "note-A",
              text: "Retain this exact exchange.",
              actor: "curator",
              via: "textile-browser",
              createdAt: Date.parse("2026-07-06T04:10:05Z"),
            }],
            continuations: [{
              id: "visible-D",
              sourceId: "D",
              sourceKind: "notes/text",
              sourceParents: ["A", "X"],
              text: "Kept prose D",
              origin: "unknown",
              actor: "writer-d",
              kept: true,
              keepMark: {
                id: "keep-D",
                createdAt: Date.parse("2026-07-06T04:10:04Z"),
                actor: "curator",
                via: "textile-browser",
              },
              continuations: [],
            }],
          },
          {
            id: "visible-B",
            sourceId: "B",
            sourceKind: "notes/text",
            sourceParents: ["R"],
            text: "Comparison prose B",
            origin: "unknown",
            actor: "writer-b",
            continuations: [],
          },
        ],
      }],
    },
  };
}

function sourceArchive(records: RawLyncSourceRecord[]): RawLyncSourceArchive {
  return {
    schemaVersion: 1,
    sourceName: "fixture.lync",
    partial: false,
    obstacles: [],
    suppressedPayloadIds: [],
    noTrainTargetIds: [],
    policyEventIds: [],
    carriedCuration: [],
    carriedKeeps: [],
    diagnostics: [],
    records,
  };
}

function sourceRecord(
  id: string,
  parents: string[],
  text: string,
  kind = "notes/text",
  payloadState: RawLyncPayloadState = "available",
  withheldBy: string[] = [],
): RawLyncSourceRecord {
  const envelope = {
    v: 1,
    id,
    kind,
    at: `2026-07-06T04:10:0${Math.min(id.charCodeAt(0) % 10, 9)}Z`,
    author: { actor: `actor-${id}` },
    parents,
  };
  const payload = { text };
  return {
    id,
    envelope,
    payload,
    sourceLine: JSON.stringify({ ...envelope, payload }),
    classification: "accepted",
    nonconformingReasons: [],
    payloadState,
    withheldBy,
  };
}

function annotationRecord(
  id: string,
  parents: string[],
  payload: Record<string, unknown>,
): RawLyncSourceRecord {
  const envelope = {
    v: 1,
    id,
    kind: "lync/annotation",
    at: "2026-07-06T04:10:09Z",
    author: { actor: "source-curator" },
    parents,
    digest: `sha256:${"a".repeat(64)}`,
  };
  return {
    id,
    envelope,
    payload,
    sourceLine: JSON.stringify({ ...envelope, payload }),
    classification: "accepted",
    nonconformingReasons: [],
    payloadState: "available",
    withheldBy: [],
  };
}
