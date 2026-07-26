import { useEffect, useState } from "react";
import type React from "react";
import type { StoryNode } from "../types";
import type { AuthorshipDisplay } from "../lync/storyRuntime";
import {
  VIRTUAL_TEXT_PAGE_SIZE,
  VIRTUAL_TEXT_THRESHOLD,
} from "../utils/largeText";

interface StoryTextProps {
  storyTextRef: React.RefObject<HTMLDivElement>;
  currentPath: StoryNode[];
  currentDepth: number;
  isGeneratingAt: (nodeId: string) => boolean;
  /**
   * How loudly authorship touches the reader. Only "detail" tints the prose
   * (model turns read faintly recessed); "off"/"ambient" leave it UNTOUCHED —
   * the reading column stays clean by default. The taste call lives in the
   * SELECT:CONFIG dial, never baked into the reading surface.
   */
  authorshipDisplay: AuthorshipDisplay;
}

interface StoryNodeProseProps {
  text: string;
  tail: string;
  className: string;
  origin: StoryNode["origin"];
  actor?: string;
  via?: string;
}

function LargeTextReader({
  text,
  className,
  origin,
  actor,
  via,
}: Omit<StoryNodeProseProps, "tail">) {
  const pageCount = Math.ceil(text.length / VIRTUAL_TEXT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [text]);
  const start = page * VIRTUAL_TEXT_PAGE_SIZE;
  const end = Math.min(text.length, start + VIRTUAL_TEXT_PAGE_SIZE);
  const visibleText = text.slice(start, end);
  const stopPagerKey = (event: React.KeyboardEvent) => {
    if (
      [
        "ArrowUp",
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "Enter",
        " ",
      ].includes(event.key)
    ) {
      event.stopPropagation();
    }
  };

  return (
    <span
      className={`${className} story-large-text-reader`}
      data-origin={origin}
      data-actor={actor}
      data-via={via}
    >
      <span className="story-large-text-status">
        {`complete source text · characters ${(start + 1).toLocaleString()}–${end.toLocaleString()} of ${text.length.toLocaleString()}`}
      </span>
      <span className="story-large-text-pager" aria-label="Source text pages">
        <button
          type="button"
          aria-label="First text page"
          disabled={page === 0}
          onKeyDown={stopPagerKey}
          onClick={() => setPage(0)}
        >
          FIRST
        </button>
        <button
          type="button"
          aria-label="Previous text page"
          disabled={page === 0}
          onKeyDown={stopPagerKey}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          PREV
        </button>
        <span>{`${page + 1}/${pageCount}`}</span>
        <button
          type="button"
          aria-label="Next text page"
          disabled={page >= pageCount - 1}
          onKeyDown={stopPagerKey}
          onClick={() =>
            setPage((current) => Math.min(pageCount - 1, current + 1))
          }
        >
          NEXT
        </button>
        <button
          type="button"
          aria-label="Last text page"
          disabled={page >= pageCount - 1}
          onKeyDown={stopPagerKey}
          onClick={() => setPage(pageCount - 1)}
        >
          LAST
        </button>
      </span>
      <textarea
        className="story-large-text-area"
        aria-label={`Source text characters ${start + 1} through ${end} of ${text.length}`}
        value={visibleText}
        readOnly
        wrap="soft"
        spellCheck={false}
        onKeyDown={(event) => {
          // Let the bounded native reader scroll without also moving Textile's
          // tree. K/N, Escape, and ` still bubble to the ordinary
          // curation/mode controls, so focusing the reader is not a trap.
          if (
            [
              "ArrowUp",
              "ArrowRight",
              "ArrowDown",
              "ArrowLeft",
              "PageUp",
              "PageDown",
              "Home",
              "End",
              " ",
            ].includes(event.key)
          ) {
            event.stopPropagation();
          }
        }}
      />
    </span>
  );
}

function StoryNodeProse({
  text,
  tail,
  className,
  origin,
  actor,
  via,
}: StoryNodeProseProps) {
  const completeText = `${text}${tail}`;
  if (completeText.length > VIRTUAL_TEXT_THRESHOLD) {
    return (
      <LargeTextReader
        text={completeText}
        className={className}
        origin={origin}
        actor={actor}
        via={via}
      />
    );
  }
  return (
    <span
      className={className}
      data-origin={origin}
      data-actor={actor}
      data-via={via}
    >
      {text}
      {tail}
    </span>
  );
}

function splitTrailingWhitespace(text: string): [body: string, tail: string] {
  let bodyEnd = text.length;
  while (bodyEnd > 0 && /\s/.test(text[bodyEnd - 1]!)) bodyEnd -= 1;
  return [text.slice(0, bodyEnd), text.slice(bodyEnd)];
}

export function StoryText({
  storyTextRef,
  currentPath,
  currentDepth,
  isGeneratingAt,
  authorshipDisplay,
}: StoryTextProps) {
  const tint = authorshipDisplay === "detail";
  // Generated story prose is deliberately seam-joined into one flowing text.
  // Imported corpus records are distinct beats; their source strings should
  // never need fabricated trailing whitespace to remain legible as turns.
  const showTurnBoundaries = currentPath.some(
    (segment) => segment.archiveSource || segment.sourceId || segment.portableTurnId,
  );
  return (
    <div ref={storyTextRef} className="story-text">
      {currentPath.map((segment, index) => {
        const isCurrentDepth = index === currentDepth;
        const isNextDepth = index === currentDepth + 1;
        const isLoading = isGeneratingAt(segment.id);

        const spanClasses = ["story-node"];
        if (isNextDepth) {
          spanClasses.push("cursor-node");
        } else if (isCurrentDepth) {
          spanClasses.push("text-theme-text");
        } else if (index < currentDepth) {
          spanClasses.push("text-theme-text", "opacity-80");
        } else {
          spanClasses.push("text-theme-text", "opacity-55");
        }
        if (isLoading) {
          spanClasses.push("opacity-50");
        }
        // Detail mode only: a subtle per-origin tint so model turns read faintly
        // recessed. Theme-var color-mix, no caption — prose text is unchanged in
        // every other mode.
        if (tint) {
          spanClasses.push(`story-tint--${segment.origin}`);
        }

        const [body, tail] = isNextDepth
          ? splitTrailingWhitespace(segment.text)
          : [segment.text, ""];
        return (
          <span
            key={segment.id}
            className={showTurnBoundaries ? "story-turn-boundary" : undefined}
            data-node-id={segment.id}
            data-source-text-length={segment.text.length}
          >
            <StoryNodeProse
              text={body}
              tail={tail}
              className={spanClasses.join(" ")}
              origin={segment.origin}
              actor={segment.actor}
              via={segment.via}
            />
          </span>
        );
      })}
    </div>
  );
}
