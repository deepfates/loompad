import { describe, expect, it } from "bun:test";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StoryText } from "../StoryText";
import type { StoryNode } from "../../types";
import type { AuthorshipDisplay } from "../../lync/storyRuntime";

function render(
  path: StoryNode[],
  currentDepth: number,
  authorshipDisplay: AuthorshipDisplay = "ambient",
): string {
  return renderToStaticMarkup(
    <StoryText
      storyTextRef={createRef<HTMLDivElement>()}
      currentPath={path}
      currentDepth={currentDepth}
      isGeneratingAt={() => false}
      authorshipDisplay={authorshipDisplay}
    />,
  );
}

describe("StoryText prose surface", () => {
  const human: StoryNode = {
    id: "h",
    text: "A human seed.",
    continuations: [],
    origin: "human",
    actor: "ada",
    via: "textile-browser",
  };
  const model: StoryNode = {
    id: "m",
    text: " a model continuation.",
    continuations: [],
    origin: "model",
    actor: "ada",
    via: "textile-browser",
    generatedBy: { model: "test-model", temperature: 0.7 },
  };
  const unknown: StoryNode = {
    id: "u",
    text: "An imported turn.",
    continuations: [],
    origin: "unknown",
  };

  it("tags every rendered turn with a machine-legible data-origin", () => {
    const html = render([human, model], 1);
    expect(html).toContain('data-origin="human"');
    expect(html).toContain('data-origin="model"');
  });

  it("tags every rendered turn with a machine-legible data-actor and data-via", () => {
    // Authorship (the PERSON's actor, separate from the controller via) is
    // legible in the DOM per turn, paralleling data-origin — so an outside
    // checker can read who authored each turn without opening the store.
    const html = render([human, model], 1);
    expect(html).toContain('data-actor="ada"');
    expect(html).toContain('data-via="textile-browser"');
  });

  it("carries data-actor on the cursor (next-depth) turn too", () => {
    // The cursor-node branch wraps the frontier turn differently; authorship
    // must ride it just the same, so sibling enumeration can read the actor of
    // whichever continuation is on the path.
    const grace: StoryNode = {
      id: "g",
      text: " grace's turn.",
      continuations: [],
      origin: "human",
      actor: "grace",
      via: "textile-browser",
    };
    const html = render([human, grace], 0);
    expect(html).toContain('data-actor="grace"');
  });

  it("renders NO author byline in the reading column by default (Ambient)", () => {
    const html = render([human, model], 1);
    // Re-homed to the status strip: the prose column stays clean. None of the
    // old byline class, spelled-out label, or detail line appears in the prose.
    expect(html).not.toContain("story-origin");
    expect(html).not.toContain("model · test-model");
    expect(html).not.toContain("origin: model");
    expect(html).not.toContain("via: textile-browser");
  });

  it("renders NO byline and NO tint in Off mode", () => {
    const html = render([human, model], 1, "off");
    expect(html).not.toContain("story-origin");
    expect(html).not.toContain("story-tint");
  });

  it("adds a per-origin prose tint class ONLY in Detail mode", () => {
    const ambient = render([human, model], 1, "ambient");
    expect(ambient).not.toContain("story-tint");

    const detail = render([human, model], 1, "detail");
    expect(detail).toContain("story-tint--human");
    expect(detail).toContain("story-tint--model");
    // Still no caption — Detail tints, it does not spell out under the prose.
    expect(detail).not.toContain("story-origin");
  });

  it("tints an unknown turn in Detail mode too", () => {
    const detail = render([unknown], 0, "detail");
    expect(detail).toContain("story-tint--unknown");
  });

  it("separates imported corpus turns without changing exact source text", () => {
    const first: StoryNode = {
      ...human,
      id: "archive-1",
      text: "First archive beat.",
      portableTurnId: "portable-1",
    };
    const second: StoryNode = {
      ...human,
      id: "archive-2",
      text: "Second archive beat.",
      archiveSource: {
        profile: "splice/twitter-archive/v1",
        provider: "twitter",
        kind: "tweet",
        recordId: "2",
        parentRecordId: "1",
        parentHeld: true,
        accountId: "42",
        ownerHandle: "archivist",
        createdAt: "2026-07-26T00:00:00Z",
      },
    };
    const html = render([first, second], 1);
    expect(html.match(/story-turn-boundary/g)).toHaveLength(2);
    expect(html).toContain("First archive beat.");
    expect(html).toContain("Second archive beat.");
    expect(render([human, model], 1)).not.toContain("story-turn-boundary");
  });

  it("presents a multi-megabyte turn as an explicit bounded reader window", () => {
    const large: StoryNode = {
      ...unknown,
      id: "large",
      text: `BEGIN LARGE SOURCE\n${"x".repeat(1024 * 1024)}END LARGE SOURCE`,
    };
    const html = render([large], 0);
    expect(html).toContain("complete source text · characters 1–65,536 of");
    expect(html).toContain('aria-label="Last text page"');
    expect(html).toContain('class="story-large-text-area"');
    expect(html).toContain("BEGIN LARGE SOURCE");
    expect(html).not.toContain("END LARGE SOURCE");
    expect(html.length).toBeLessThan(80_000);
  });

  it("renders a sliding bounded path window without hiding history ownership", () => {
    const path = Array.from({ length: 100 }, (_, index): StoryNode => ({
      ...unknown,
      id: `turn-${index}`,
      text: `Turn ${index}.`,
      portableTurnId: `source-${index}`,
    }));
    const html = render(path, 75);

    expect(html.match(/data-node-id=/g)).toHaveLength(48);
    expect(html).toContain("29 earlier turns are preserved; move up to bring them into view.");
    expect(html).toContain("23 later turns are preserved; move down to bring them into view.");
    expect(html).toContain('data-node-id="turn-75"');
    expect(html).toContain('data-node-id="turn-76"');
    expect(html).not.toContain('data-node-id="turn-27"');
    expect(html).not.toContain('data-node-id="turn-77"');
  });
});
