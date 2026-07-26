import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StoryMinimap } from "../StoryMinimap";
import type { StoryNode } from "../../types";

const child: StoryNode = {
  id: "child",
  text: "The selected continuation",
  origin: "human",
  continuations: [],
};

const root: StoryNode = {
  id: "root",
  text: "The focused root event",
  origin: "human",
  continuations: [child],
};

describe("StoryMinimap focus prose", () => {
  it("narrates the highlighted event, not its selected continuation", () => {
    const html = renderToStaticMarkup(
      <StoryMinimap
        tree={{ root }}
        currentDepth={0}
        selectedOptions={[0]}
        currentPath={[root, child]}
        inFlight={new Set()}
        generatingInfo={{}}
        lastMapNodeId={null}
        currentNodeId={root.id}
      />,
    );

    expect(html).toContain(">The focused root event<");
    expect(html).not.toContain(">The selected continuation<");
  });

  it("renders typed raw-Lync relations as passive MAP marks", () => {
    const synthesis: StoryNode = {
      id: "turn:D",
      text: "Synthesis",
      origin: "unknown",
      sourceId: "D",
      sourceParents: ["B", "C"],
      extraParentIds: ["C"],
      continuations: [],
    };
    const branchB: StoryNode = {
      id: "turn:B",
      text: "Branch B",
      origin: "unknown",
      sourceId: "B",
      sourceParents: ["A"],
      continuations: [synthesis],
    };
    const branchC: StoryNode = {
      id: "turn:C",
      text: "Branch C",
      origin: "unknown",
      sourceId: "C",
      sourceParents: ["A"],
      continuations: [],
    };
    const pointer: StoryNode = {
      id: "turn:P",
      text: "Pointer",
      origin: "unknown",
      sourceId: "P",
      sourceParents: ["A"],
      continuations: [],
    };
    const sourceRoot: StoryNode = {
      id: "turn:A",
      text: "Question",
      origin: "unknown",
      sourceId: "A",
      sourceParents: [],
      continuations: [branchB, branchC, pointer],
    };
    const virtualRoot: StoryNode = {
      id: "virtual",
      text: "dag-links.lync",
      origin: "unknown",
      continuations: [sourceRoot],
      sourceArchive: {
        schemaVersion: 1,
        sourceName: "dag-links.lync",
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
            payload: { label: "cluster" },
            classification: "accepted",
            nonconformingReasons: [],
            payloadState: "available",
            withheldBy: [],
          },
          {
            id: "P",
            envelope: { kind: "lync/pointer", parents: ["A"] },
            payload: { name: "current", target: "D" },
            classification: "accepted",
            nonconformingReasons: [],
            payloadState: "available",
            withheldBy: [],
          },
        ],
      },
    };
    const html = renderToStaticMarkup(
      <StoryMinimap
        tree={{ root: virtualRoot }}
        currentDepth={3}
        selectedOptions={[0, 0, 0]}
        currentPath={[virtualRoot, sourceRoot, branchB, synthesis]}
        inFlight={new Set()}
        generatingInfo={{}}
        lastMapNodeId={null}
        currentNodeId={synthesis.id}
      />,
    );

    expect(html).toContain('data-relation-kind="additional-parent"');
    expect(html).toContain('data-relation-kind="pointer"');
    expect(html).toContain('data-relation-kind="annotation"');
    expect(html).toContain('pointer-events="none"');
    expect(html).toContain("minimap-cross-edge--connected");
    expect(html).toContain("minimap-annotation-target--connected");
    expect(html).toContain("╱ parent+");
    expect(html).toContain("╌ pointer");
    expect(html).toContain("⋯ annotated");
  });
});
