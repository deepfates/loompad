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
        branchPointCount: 1,
        annotationCount: 3,
        selectedSourceCount: 1,
        nonconformingCount: 0,
        warnings: [],
      }),
    ).toBe(
      'Imported "corpus.lync" — 3 turns · 1 branch point · 3 annotations · 1 selected source · conforming — START opens map · ↓ selects child · ←/→ compare siblings · focus reading surface + K to Keep',
    );
  });
});
