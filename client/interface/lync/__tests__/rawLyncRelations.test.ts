import { describe, expect, it } from "bun:test";
import type { StoryNode } from "../../types";
import { rawLyncMapModel, rawLyncRelationsFor } from "../rawLyncRelations";

const node = (
  id: string,
  text: string,
  sourceParents: string[],
  continuations: StoryNode[] = [],
): StoryNode => ({
  id: `turn:${id}`,
  text,
  origin: "unknown",
  sourceId: id,
  sourceKind: "corpus/message",
  sourceParents,
  extraParentIds: sourceParents.slice(1),
  continuations,
});

describe("raw Lync focused relations", () => {
  const synthesis = node("D", "Synthesis", ["B", "C"]);
  const branchB = node("B", "Branch B", ["A"], [synthesis]);
  const branchC = node("C", "Branch C", ["A"]);
  const pointer = node("P", "Current reading pointer", ["A"]);
  const root: StoryNode = {
    id: "virtual",
    text: "corpus.lync",
    origin: "unknown",
    continuations: [node("A", "Question", [], [branchB, branchC, pointer])],
    sourceArchive: {
      schemaVersion: 1,
      sourceName: "corpus.lync",
      partial: false,
      obstacles: [],
      suppressedPayloadIds: [],
      noTrainTargetIds: [],
      policyEventIds: [],
      carriedCuration: [],
      carriedKeeps: [],
      diagnostics: [],
      records: [
        {
          id: "ANN",
          envelope: { kind: "lync/annotation", parents: ["D"] },
          payload: { label: "score", value: 0.9 },
          classification: "accepted",
          nonconformingReasons: [],
          payloadState: "available",
          withheldBy: [],
        },
        {
          id: "P",
          envelope: { kind: "lync/pointer", parents: ["A"] },
          payload: { name: "reading", target: "D" },
          classification: "accepted",
          nonconformingReasons: [],
          payloadState: "available",
          withheldBy: [],
        },
      ],
    },
  };

  it("names both ordered causal parents and navigates the additional one", () => {
    const relations = rawLyncRelationsFor(root, synthesis);
    expect(relations.slice(0, 2).map((relation) => relation.kind)).toEqual([
      "first-parent",
      "additional-parent",
    ]);
    expect(relations[1]?.label).toContain("parent 2 · additional");
    expect(relations[1]?.targetPath?.at(-1)?.sourceId).toBe("C");
  });

  it("makes the fan-in child reachable from every cited parent", () => {
    const relations = rawLyncRelationsFor(root, branchC);
    const child = relations.find((relation) => relation.kind === "causal-child");
    expect(child?.label).toContain("uses this as parent 2");
    expect(child?.targetPath?.at(-1)?.sourceId).toBe("D");
  });

  it("keeps annotations and pointers distinct from causal edges", () => {
    const targetRelations = rawLyncRelationsFor(root, synthesis);
    expect(targetRelations.find((relation) => relation.kind === "annotation")?.label)
      .toContain("annotation · score");
    expect(targetRelations.find((relation) => relation.kind === "incoming-pointer")?.label)
      .toContain("incoming pointer · reading");

    const pointerRelations = rawLyncRelationsFor(root, pointer);
    const target = pointerRelations.find((relation) => relation.kind === "pointer-target");
    expect(target?.targetPath?.at(-1)?.sourceId).toBe("D");
    expect(target?.detail).toContain("not a causal-parent edge");
  });

  it("builds a passive typed MAP model without duplicating the first-parent tree", () => {
    const map = rawLyncMapModel(root);
    expect(map.relations).toEqual([
      {
        id: "additional-parent:D:1:C",
        kind: "additional-parent",
        fromNodeId: "turn:C",
        toNodeId: "turn:D",
        label: "D cites C as causal parent 2.",
      },
      {
        id: "pointer:P:D",
        kind: "pointer",
        fromNodeId: "turn:P",
        toNodeId: "turn:D",
        label: "Named pointer reading targets D; this is not a causal edge.",
      },
    ]);
    expect(map.annotations).toEqual([
      {
        nodeId: "turn:D",
        sourceId: "D",
        labels: ["score"],
        annotationIds: ["ANN"],
      },
    ]);
  });
});
