import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { RawLyncIndicator } from "../RawLyncIndicator";
import type { StoryNode } from "../../types";

describe("RawLyncIndicator", () => {
  it("shows exact archive provenance without pretending it is a raw Lync event", () => {
    const node: StoryNode = {
      id: "turn-1",
      text: "A retained archive observation.",
      origin: "human",
      continuations: [],
      archiveSource: {
        profile: "splice/twitter-archive/v1",
        provider: "twitter",
        kind: "tweet",
        recordId: "1800000000000000003",
        parentRecordId: "1800000000000000002",
        parentHeld: true,
        accountId: "42",
        ownerHandle: "textile_demo",
        createdAt: "2026-07-26T18:04:00.000Z",
      },
    };
    const html = renderToStaticMarkup(<RawLyncIndicator node={node} />);
    expect(html).toContain("twitter tweet 1800000000000000003");
    expect(html).toContain("archive owner @textile_demo");
    expect(html).toContain("held reply parent 1800000000000000002");
    expect(html).not.toContain("lync ");
  });
});
