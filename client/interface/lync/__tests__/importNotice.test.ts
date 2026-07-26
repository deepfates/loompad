import { describe, expect, it } from "bun:test";
import { formatImportedConversationNotice } from "../importNotice";

describe("raw Lync import notice", () => {
  it("reports corpus shape, prior selections, and the observed map-first controls", () => {
    expect(
      formatImportedConversationNotice({
        loomId: "loom",
        title: "corpus.lync",
        turnCount: 3,
        kind: "raw-lync",
        sourceEventCount: 4,
        readableEventCount: 3,
        structuralEventCount: 1,
        unsupportedEventCount: 0,
        unsupportedKinds: [],
        branchPointCount: 1,
        annotationCount: 3,
        selectedSourceCount: 1,
        nonconformingCount: 0,
        warnings: [],
      }),
    ).toBe(
      'Imported "corpus.lync" — 4 source events · 3 readable events · 1 structural event · all presented · 1 branch point · 3 annotations · 1 selected source · conforming — START opens map · L opens typed links · ↓ selects child · ←/→ compare siblings · focus reading surface + K to Keep',
    );
  });

  it("names every unsupported kind instead of reporting a plausible partial import", () => {
    expect(
      formatImportedConversationNotice({
        loomId: "loom",
        title: "partial.lync",
        turnCount: 1,
        kind: "raw-lync",
        sourceEventCount: 2,
        readableEventCount: 1,
        structuralEventCount: 0,
        unsupportedEventCount: 1,
        unsupportedKinds: ["tool/result"],
        branchPointCount: 0,
        annotationCount: 0,
        selectedSourceCount: 0,
        nonconformingCount: 0,
        warnings: [],
      }),
    ).toContain("1 unsupported (tool/result)");
  });
});
