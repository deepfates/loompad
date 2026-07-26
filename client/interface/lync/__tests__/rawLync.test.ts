import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createTestLoomClient } from "@deepfates/lync/client/testing";
import { projectRawLyncFile } from "../rawLync";
import { projectStoryTree, type ReadableLoom } from "../storyLoom";
import type {
  ConversationLoomMeta,
  ConversationTurnMeta,
  ConversationTurnPayload,
} from "../storyRuntime";

const fixtureUrl = new URL("./fixtures/corpus-loop.lync", import.meta.url);
const spliceKindsFixtureUrl = new URL(
  "../../../../tests/e2e/fixtures/splice-source-kinds.lync",
  import.meta.url,
);
const oxfordResidentFixtureUrl = new URL(
  "../../../../tests/e2e/fixtures/oxford-aster-human-semantic-v1.lync",
  import.meta.url,
);
const B = "0197e6a0-4a09-7000-8000-000000000002";
const C = "0197e6a0-4a09-7000-8000-000000000003";
const D = "0197e6a0-4a09-7000-8000-000000000004";

describe("raw .lync projection", () => {
  it("uses first-parent navigation while retaining source identity and annotations", () => {
    const projection = projectRawLyncFile(
      readFileSync(fixtureUrl, "utf8"),
      "corpus-loop.lync",
    );
    expect(projection.sourceEventCount).toBe(4);
    expect(projection.readableEventCount).toBe(4);
    expect(projection.structuralEventCount).toBe(0);
    expect(projection.unsupportedEventCount).toBe(0);
    expect(projection.annotationCount).toBe(2);
    expect(projection.branchPointCount).toBe(1);
    expect(projection.selectedSourceCount).toBe(1);
    expect(projection.nonconformingCount).toBe(0);
    expect(projection.warnings).toEqual([]);

    const turns = new Map(projection.snapshot.turns.map((turn) => [turn.id, turn]));
    expect(turns.get(D)?.parentId).toBe(B);
    expect(turns.get(D)?.meta.sourceId).toBe(D);
    expect(turns.get(D)?.meta.sourceParents).toEqual([B, C]);
    expect(turns.get(D)?.meta.extraParentIds).toEqual([C]);
    expect(turns.get(D)?.meta.rawTags?.map((tag) => tag.tag)).toEqual([
      "cooperation",
    ]);
    expect(turns.get(B)?.meta.sourceSelected).toBe(true);
    expect(turns.get(C)?.meta.sourceSelected).toBe(false);
  });

  it("survives Lync snapshot import even when internal turn ids are reminted", async () => {
    const projection = projectRawLyncFile(readFileSync(fixtureUrl, "utf8"));
    const looms = createTestLoomClient<
      ConversationTurnPayload,
      ConversationLoomMeta,
      ConversationTurnMeta
    >().looms;
    const imported = await looms.import(projection.snapshot);
    const loom = await looms.open(imported.id);
    const tree = await projectStoryTree(loom as unknown as ReadableLoom);
    const all = flatten(tree.root);
    const d = all.find((node) => node.sourceId === D);
    expect(d?.id).not.toBe(D);
    expect(d?.sourceParents).toEqual([B, C]);
    expect(d?.extraParentIds).toEqual([C]);
    expect(d?.rawTags?.map((tag) => tag.tag)).toEqual(["cooperation"]);
    expect(all.find((node) => node.sourceId === B)?.kept).toBe(true);
  });

  it("fails closed on garbage and damaged physical lines", () => {
    expect(() => projectRawLyncFile("not-json\n", "broken.lync")).toThrow(
      /broken\.lync:1 garbage/,
    );
    const damaged = {
      ...event("0197e6a0-4a09-7000-8000-000000000011", [], "damaged"),
      digest: `sha256:${"0".repeat(64)}`,
    };
    expect(() => projectRawLyncFile(`${JSON.stringify(damaged)}\n`, "damaged.lync")).toThrow(
      /damaged\.lync:1 damaged/,
    );
  });

  it("fails closed on same-id conflicts", () => {
    const id = "0197e6a0-4a09-7000-8000-000000000021";
    const corpus = [event(id, [], "first"), event(id, [], "different")]
      .map(JSON.stringify)
      .join("\n");
    expect(() => projectRawLyncFile(`${corpus}\n`, "conflict.lync")).toThrow(
      /conflict-variant: same id with different body bytes/,
    );
  });

  it("fails closed on missing parents and cyclic graph obstacles", () => {
    const missing = "0197e6a0-4a09-7000-8000-000000000031";
    const child = event(
      "0197e6a0-4a09-7000-8000-000000000032",
      [missing],
      "orphan",
    );
    expect(() => projectRawLyncFile(`${JSON.stringify(child)}\n`, "orphan.lync")).toThrow(
      /graph dangling: .*needs/,
    );

    const a = "0197e6a0-4a09-7000-8000-000000000041";
    const b = "0197e6a0-4a09-7000-8000-000000000042";
    const cycle = [event(a, [b], "a"), event(b, [a], "b")]
      .map(JSON.stringify)
      .join("\n");
    expect(() => projectRawLyncFile(`${cycle}\n`, "cycle.lync")).toThrow(
      /graph cycle: 0197.*0041 -> 0197.*0042/,
    );
  });

  it("imports accepted nonconforming events but names every warning", () => {
    const input = {
      ...event("0197e6a0-4a09-7000-8000-000000000051", [], "carried"),
      mystery: true,
    };
    const projection = projectRawLyncFile(`${JSON.stringify(input)}\n`, "carried.lync");
    expect(projection.sourceEventCount).toBe(1);
    expect(projection.nonconformingCount).toBe(1);
    expect(projection.warnings).toEqual([
      "carried.lync:1 nonconforming: unknown top-level field mystery",
    ]);
    expect(projection.snapshot.turns.at(-1)?.meta.sourceWarnings).toEqual([
      "unknown top-level field mystery",
    ]);
  });

  it("projects preserved Twitter archive text without changing source identity", () => {
    const id = "0197e6a0-4a09-7000-8000-000000000055";
    const input = {
      ...event(id, [], "unused"),
      kind: "twitter/tweet",
      payload: { id_str: "55", full_text: "Preserved archive text." },
    };

    const projection = projectRawLyncFile(`${JSON.stringify(input)}\n`, "twitter.lync");
    const turn = projection.snapshot.turns.find((candidate) => candidate.meta.sourceId === id);
    expect(turn?.payload.text).toBe("Preserved archive text.");
    expect(turn?.meta.sourceId).toBe(id);
  });

  it("keeps a multi-megabyte readable source exact in the imported story model", () => {
    const id = "0197e6a0-4a09-7000-8000-000000000056";
    const text = `BEGIN LARGE SOURCE\n${"exact-source-byte ".repeat(70_000)}END LARGE SOURCE`;
    const input = {
      ...event(id, [], "unused"),
      kind: "ocr/document",
      payload: { file: "combined.md", text, bytes: Buffer.byteLength(text) },
    };

    const projection = projectRawLyncFile(`${JSON.stringify(input)}\n`, "large.lync");
    const turn = projection.snapshot.turns.find((candidate) => candidate.meta.sourceId === id);
    expect(turn?.payload.text.length).toBe(text.length);
    expect(turn?.payload.text).toBe(text);
  });

  it("collapses unreadable tool steps to the nearest readable first-parent ancestor", () => {
    const a = "0197e6a0-4a09-7000-8000-000000000061";
    const tool = "0197e6a0-4a09-7000-8000-000000000062";
    const b = "0197e6a0-4a09-7000-8000-000000000063";
    const input = [
      event(a, [], "question"),
      {
        ...event(tool, [a], "unused"),
        payload: { message: { content: [{ type: "tool_use", name: "read" }] } },
      },
      event(b, [tool], "answer"),
    ]
      .map(JSON.stringify)
      .join("\n");
    const projection = projectRawLyncFile(`${input}\n`, "tools.lync");
    const turns = new Map(projection.snapshot.turns.map((turn) => [turn.id, turn]));
    expect(projection.sourceEventCount).toBe(3);
    expect(projection.readableEventCount).toBe(2);
    expect(projection.unsupportedEventCount).toBe(1);
    expect(projection.unsupportedKinds).toEqual(["lync/artifact"]);
    expect(turns.get(b)?.parentId).toBe(a);
    expect(turns.get(b)?.meta.sourceParents).toEqual([tool]);
  });

  it("projects every Splice raw-converter source kind without recursive guessing", () => {
    const projection = projectRawLyncFile(
      readFileSync(spliceKindsFixtureUrl, "utf8"),
      "splice-source-kinds.lync",
    );
    expect(projection.sourceEventCount).toBe(11);
    expect(projection.readableEventCount).toBe(9);
    expect(projection.structuralEventCount).toBe(2);
    expect(projection.unsupportedEventCount).toBe(0);
    expect(projection.unsupportedKinds).toEqual([]);

    const sourceTurns = projection.snapshot.turns.filter((turn) => turn.meta.sourceId);
    const kinds = sourceTurns.map((turn) => turn.meta.sourceKind);
    expect(new Set(kinds)).toEqual(
      new Set([
        "twitter/tweet",
        "twitter/like",
        "bluesky/post",
        "glowfic/thread",
        "glowfic/post",
        "ocr/set",
        "ocr/page",
        "ocr/document",
        "twitter/tweet-embed",
      ]),
    );
    expect(sourceTurns.find((turn) => turn.meta.sourceKind === "bluesky/post")?.payload.text)
      .toBe("Bluesky prose lives inside the preserved source record.");
    expect(sourceTurns.find((turn) => turn.meta.sourceKind === "twitter/tweet-embed")?.payload.text)
      .toContain("Cached tweet prose is extracted from inert oEmbed HTML.");
    expect(sourceTurns.find((turn) => turn.meta.sourceKind === "glowfic/post")?.payload.text)
      .toContain("When Carissa Sevar opens her eyes again");
    expect(sourceTurns.find((turn) => turn.meta.sourceKind === "glowfic/thread")?.meta.sourcePresentation)
      .toBe("structure");
    expect(sourceTurns.find((turn) => turn.meta.sourceKind === "ocr/set")?.meta.sourcePresentation)
      .toBe("structure");

    const tagged = sourceTurns.find((turn) => turn.meta.rawTags?.length);
    expect(tagged?.meta.sourceKind).toBe("glowfic/post");
    expect(tagged?.meta.rawTags?.map((tag) => tag.tag)).toEqual(["source-kind-proof"]);

    const embed = sourceTurns.find((turn) => turn.meta.sourceKind === "twitter/tweet-embed");
    const archiveTweet = sourceTurns.find(
      (turn) =>
        turn.meta.sourceKind === "twitter/tweet" &&
        (turn.payload.message as { id?: string }).id === "1000000000000000001",
    );
    expect(embed?.meta.sourceParents).toEqual([archiveTweet?.meta.sourceId]);
    expect(embed?.parentId).toBe(archiveTweet?.meta.sourceId);
  });

  it("presents the exact Oxford resident fixture and reconstructs unchanged source events", async () => {
    const raw = readFileSync(oxfordResidentFixtureUrl, "utf8");
    expect(Buffer.byteLength(raw)).toBe(6_743);
    expect(createHash("sha256").update(raw).digest("hex")).toBe(
      "f254829584b7597ab1e09e88e840be4efff631ee84ee7a595c4ee44cba069305",
    );

    const projection = projectRawLyncFile(raw, "oxford-aster-human-semantic-v1.lync");
    expect(projection.sourceEventCount).toBe(2);
    expect(projection.readableEventCount).toBe(1);
    expect(projection.structuralEventCount).toBe(1);
    expect(projection.unsupportedEventCount).toBe(0);

    const sourceTurns = projection.snapshot.turns.filter((turn) => turn.meta.sourceId);
    const root = sourceTurns.find((turn) => turn.meta.sourceKind === "lync/loom");
    const beat = sourceTurns.find((turn) => turn.meta.sourceKind === "lync/turn");
    expect(root?.payload.text).toContain("Behold resident life: OxfordAster");
    expect(beat?.payload.text).toContain("OxfordAster's condition:");
    expect(beat?.payload.text).toContain("Saw Birch");
    expect(beat?.payload.text).toContain("[script · exclusive] OxfordAster looked left, level.");
    expect(beat?.payload.text).toContain("The body confirmed facing east and level.");
    expect(beat?.payload.text).toContain("Birch left the current view.");
    expect(beat?.payload.text).not.toContain("visible-entity-1");
    expect(beat?.payload.text).not.toContain("lastSeenDistance");
    expect(beat?.meta.sourceLoomProfile).toBe("org.behold.inhabitant.v1");
    expect(beat?.meta.sourcePresentationContract).toBe(
      "org.behold.presentation.inhabitant-turn.v1",
    );
    expect(beat?.meta.sourcePresentationSource).toEqual({
      id: "019f9b8f-8a75-7de2-a306-6fe25fecb9a6",
      parents: ["019f9b8f-7b3e-7039-b3f3-82833021a250"],
      author: { actor: "OxfordAster", via: "behold@0.1.0-alpha.0" },
      kind: "lync/turn",
    });
    expect(beat?.meta.sourcePresentationSections?.map((section) => section.role)).toEqual([
      "perception",
      "action",
      "outcome",
      "perception",
    ]);
    expect(beat?.meta.sourcePresentationDiagnostics?.map((item) => item.code)).toContain(
      "withheld_observation_local_reference",
    );

    const looms = createTestLoomClient<
      ConversationTurnPayload,
      ConversationLoomMeta,
      ConversationTurnMeta
    >().looms;
    const imported = await looms.import(projection.snapshot);
    const tree = await projectStoryTree(
      (await looms.open(imported.id)) as unknown as ReadableLoom,
    );
    const sourceNodes = flatten(tree.root).filter((node) => node.sourceEvent);
    expect(sourceNodes).toHaveLength(2);
    expect(sourceNodes.map((node) => node.origin)).toEqual(["unknown", "unknown"]);
    expect(sourceNodes.map((node) => node.actor)).toEqual(["OxfordAster", "OxfordAster"]);
    expect(sourceNodes.map((node) => node.sourceEvent)).toEqual(
      raw.trim().split("\n").map((line) => JSON.parse(line)),
    );
  });

  it("shows only the pact's public utterance and never a sibling reasoning field", () => {
    const events = readFixtureEvents();
    const turnPayload = nestedRecord(events[1], "payload");
    const entityTurn = nestedRecord(turnPayload, "payload");
    const utterance = nestedRecord(entityTurn, "utterance");
    const assistant = nestedRecord(utterance, "assistant");
    assistant.content = "I can say this where the reader can see it.";
    utterance.reasoning = "PRIVATE REASONING MUST NOT BECOME PROSE";

    const projection = projectRawLyncFile(asLync(events), "public-utterance.lync");
    const prose = projection.snapshot.turns.find(
      (turn) => turn.meta.sourceKind === "lync/turn",
    )?.payload.text;
    expect(prose).toContain("I can say this where the reader can see it.");
    expect(prose).not.toContain("PRIVATE REASONING MUST NOT BECOME PROSE");
  });

  it("does not claim unknown resident profiles by nested shape", () => {
    const events = readFixtureEvents();
    nestedRecord(nestedRecord(events[0], "payload"), "meta").profile =
      "org.behold.unknown.v2";
    expect(() => projectRawLyncFile(asLync(events), "unknown-profile.lync")).toThrow(
      /No presentable events.*lync\/loom.*lync\/turn/,
    );
  });

  it("does not fall back to generic prose after the Behold profile claims a malformed turn", () => {
    const events = readFixtureEvents();
    const turnPayload = nestedRecord(events[1], "payload");
    nestedRecord(turnPayload, "meta").protocol = "behold.unknown-turn-link.v2";
    turnPayload.message = "THIS GENERIC FALLBACK MUST NOT BE SHOWN";

    const projection = projectRawLyncFile(asLync(events), "broken-pact.lync");
    expect(projection.sourceEventCount).toBe(2);
    expect(projection.structuralEventCount).toBe(1);
    expect(projection.readableEventCount).toBe(0);
    expect(projection.unsupportedEventCount).toBe(1);
    expect(projection.unsupportedKinds).toEqual(["lync/turn"]);
    expect(projection.snapshot.turns.map((turn) => turn.payload.text).join("\n"))
      .not.toContain("THIS GENERIC FALLBACK MUST NOT BE SHOWN");
  });

  it("keeps explicit rejection provenance distinct from an ordinary failure", () => {
    const rejected = readFixtureEvents();
    const rejectedOutcome = nestedRecord(
      nestedRecord(nestedRecord(rejected[1], "payload"), "payload"),
      "outcome",
    );
    rejectedOutcome.ok = false;
    rejectedOutcome.eventType = "policy_rejected";
    const rejectedText = projectRawLyncFile(asLync(rejected)).snapshot.turns.find(
      (turn) => turn.meta.sourceKind === "lync/turn",
    )?.payload.text;
    expect(rejectedText).toContain("look_direction was rejected (policy_rejected)");
    expect(rejectedText).not.toContain("look_direction failed (");

    const failed = readFixtureEvents();
    const failedOutcome = nestedRecord(
      nestedRecord(nestedRecord(failed[1], "payload"), "payload"),
      "outcome",
    );
    failedOutcome.ok = false;
    failedOutcome.eventType = "action_failed";
    const failedText = projectRawLyncFile(asLync(failed)).snapshot.turns.find(
      (turn) => turn.meta.sourceKind === "lync/turn",
    )?.payload.text;
    expect(failedText).toContain("look_direction failed (action_failed)");
    expect(failedText).not.toContain("failed or was rejected");
  });

  it("fails closed with named kinds when every event is unsupported", () => {
    const input = {
      ...event("0197e6a0-4a09-7000-8000-000000000071", [], "unused"),
      kind: "behold/entity-turn",
      payload: { payload: { observation: "domain-owned shape" } },
    };
    expect(() => projectRawLyncFile(`${JSON.stringify(input)}\n`, "unknown.lync"))
      .toThrow(/No presentable events.*behold\/entity-turn/);
  });
});

function flatten(node: import("../../types").StoryNode): import("../../types").StoryNode[] {
  return [node, ...(node.continuations ?? []).flatMap(flatten)];
}

function readFixtureEvents(): Record<string, unknown>[] {
  return readFileSync(oxfordResidentFixtureUrl, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function nestedRecord(
  value: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  const nested = value[field];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
    throw new Error(`Fixture field ${field} is not an object`);
  }
  return nested as Record<string, unknown>;
}

function asLync(events: Record<string, unknown>[]): string {
  return `${events.map(JSON.stringify).join("\n")}\n`;
}

function event(id: string, parents: string[], text: string) {
  return {
    v: 1,
    id,
    kind: "lync/artifact",
    at: "2026-07-06T04:10:00Z",
    author: { actor: "test" },
    parents,
    payload: { text },
  };
}
