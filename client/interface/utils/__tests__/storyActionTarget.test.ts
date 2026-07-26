import { describe, expect, it } from "bun:test";
import { resolveStoryActionTarget } from "../storyActionTarget";

const tree = (rootId: string, sourceId: string, kept = false) => ({
  root: {
    id: rootId,
    text: "same visible title",
    origin: "unknown" as const,
    continuations: [{
      id: `turn:${sourceId}`,
      text: sourceId,
      origin: "unknown" as const,
      sourceId,
      kept,
      continuations: [],
    }],
  },
});

describe("resolveStoryActionTarget", () => {
  it("uses immutable loom identity rather than an ambiguous title", () => {
    const first = tree("root:a", "source:a");
    const kept = tree("root:b", "source:b", true);
    const target = resolveStoryActionTarget("loom:b", {
      trees: { "loom:a": first, "loom:b": kept },
      titles: { "loom:a": "same.lync", "loom:b": "same.lync" },
      currentLoomId: "loom:b",
      visibleTree: kept,
    });

    expect(target.loomId).toBe("loom:b");
    expect(target.title).toBe("same.lync");
    expect(target.rootTurnId).toBe("root:b");
    expect(target.sourceEventIds).toEqual(["source:b"]);
    expect(target.tree.root.continuations?.[0]?.kept).toBe(true);
  });

  it("refuses the formerly observed current-row/visible-tree divergence", () => {
    const catalogCurrent = tree("root:a", "source:a");
    const visiblyCurated = tree("root:b", "source:b", true);

    expect(() => resolveStoryActionTarget("loom:a", {
      trees: { "loom:a": catalogCurrent },
      titles: { "loom:a": "same.lync" },
      currentLoomId: "loom:a",
      visibleTree: visiblyCurated,
    })).toThrow("Story identity changed");
  });
});
