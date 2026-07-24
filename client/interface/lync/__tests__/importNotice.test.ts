import { describe, expect, it } from "bun:test";
import { formatImportedConversationNotice } from "../importNotice";

describe("raw Lync import notice", () => {
  it("reports corpus shape, prior selections, and the direct controls", () => {
    expect(
      formatImportedConversationNotice({
        loomId: "loom",
        title: "corpus.lync",
        turnCount: 3,
        kind: "raw-lync",
        branchPointCount: 1,
        annotationCount: 3,
        selectedSourceCount: 1,
        nonconformingCount: 0,
        warnings: [],
      }),
    ).toBe(
      'Imported "corpus.lync" — 3 turns · 1 branch point · 3 annotations · 1 selected source · conforming — ←/→ compare siblings · K toggles Keep · Esc shows map',
    );
  });
});
