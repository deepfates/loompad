import { describe, expect, it } from "bun:test";

import type { StoryNode } from "../../types";
import {
  buildKeptConversationArtifact,
  parseKeptConversationMarkdown,
} from "../conversationKeptExport";
import {
  importKeptConversationMarkdownText,
  openStoryLoom,
} from "../../lync/storyRuntime";
import { projectStoryTree } from "../../lync/storyLoom";

const source = (recordId: string, parentRecordId: string | null) => ({
  profile: "splice/twitter-archive/v1" as const,
  provider: "twitter" as const,
  kind: "tweet" as const,
  recordId,
  parentRecordId,
  parentHeld: parentRecordId !== null,
  accountId: "42",
  ownerHandle: "archivist",
  createdAt: "2026-07-26T00:00:00Z",
});

function tree(): { root: StoryNode } {
  return {
    root: {
      id: "root-runtime",
      portableTurnId: "root-portable",
      portableOriginLoomId: "lync:archive",
      text: "Twitter archive @archivist",
      origin: "unknown",
      actor: "archivist",
      turnRole: "corpus",
      createdAt: 1,
      continuations: [
        {
          id: "first-runtime",
          portableTurnId: "first-portable",
          portableOriginLoomId: "lync:archive",
          text: "The first thread turn.",
          origin: "human",
          actor: "archivist",
          turnRole: "user",
          createdAt: 2,
          archiveSource: source("100", null),
          continuations: [{
            id: "kept-runtime",
            portableTurnId: "kept-portable",
            portableOriginLoomId: "lync:archive",
            text: "The reply worth keeping.",
            origin: "human",
            actor: "archivist",
            turnRole: "user",
            createdAt: 3,
            archiveSource: source("101", "100"),
            kept: true,
            keepMark: { id: "keep-101", createdAt: 4, actor: "Ada", via: "textile-browser" },
            annotations: [{ id: "note-101", text: "This is the hinge.", actor: "Ada", createdAt: 5 }],
            continuations: [],
          }],
        },
        {
          id: "sibling-runtime",
          portableTurnId: "sibling-portable",
          text: "Visible but not kept.",
          origin: "human",
          actor: "archivist",
          turnRole: "user",
          createdAt: 6,
          archiveSource: source("200", null),
          continuations: [],
        },
      ],
    },
  };
}

describe("portable kept conversation", () => {
  it("exports only kept targets plus parent context with explicit provenance", () => {
    const artifact = buildKeptConversationArtifact("Archive review", tree(), "lync:archive");
    expect(artifact.manifest.keptTargets).toEqual(["kept-portable"]);
    expect(artifact.manifest.turnOrder).toEqual([
      "root-portable",
      "first-portable",
      "kept-portable",
    ]);
    expect(artifact.markdown).toContain("The reply worth keeping.");
    expect(artifact.markdown).toContain("twitter/tweet 101");
    expect(artifact.markdown).toContain("This is the hinge.");
    expect(artifact.markdown).not.toContain("Visible but not kept.");
    expect(parseKeptConversationMarkdown(artifact.markdown)).toEqual(artifact.manifest);
  });

  it("reopens the kept path with source identity, keep, and note", async () => {
    const artifact = buildKeptConversationArtifact("Archive review", tree(), "lync:archive");
    const imported = await importKeptConversationMarkdownText(artifact.markdown);
    const reopened = await projectStoryTree(await openStoryLoom(imported.loomId));
    const first = reopened.root.continuations?.[0];
    const target = first?.continuations?.[0];
    expect(reopened.root.text).toBe("Twitter archive @archivist");
    expect(target?.text).toBe("The reply worth keeping.");
    expect(target?.archiveSource?.recordId).toBe("101");
    expect(target?.kept).toBe(true);
    expect(target?.annotations?.map((note) => note.text)).toEqual(["This is the hinge."]);
    expect(reopened.root.continuations).toHaveLength(1);
  });

  it("carries a generated turn's full receipt once through export and reopen", async () => {
    const generated = tree();
    const target = generated.root.continuations?.[0]?.continuations?.[0];
    if (!target) throw new Error("fixture target missing");
    target.origin = "model";
    target.generatedBy = { model: "provider/model", generationTurnId: "generation-1" };
    target.generation = {
      model: "provider/model",
      generationMode: "completion",
      program: "textile/raw-continuation-v2",
      reasoningPolicy: "low",
      providerGenerationId: "gen-provider-1",
      reasoning: { text: "retained reasoning" },
      usage: { totalTokens: 12, reasoningTokens: 3 },
    };

    const artifact = buildKeptConversationArtifact("Generated", generated, "loom:generated");
    expect(artifact.manifest.turns.filter((turn) => turn.generation)).toHaveLength(1);
    const imported = await importKeptConversationMarkdownText(artifact.markdown);
    const reopened = await projectStoryTree(await openStoryLoom(imported.loomId));
    const reopenedTarget = reopened.root.continuations?.[0]?.continuations?.[0];
    expect(reopenedTarget?.generation).toEqual(target.generation);
    expect(reopenedTarget?.generatedBy).toEqual(target.generatedBy);
  });
});
