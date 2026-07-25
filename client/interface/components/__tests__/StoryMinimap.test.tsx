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
});
