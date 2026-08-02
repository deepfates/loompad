import type { LengthMode } from "../../shared/lengthPresets";

/**
 * Testable helpers for the user-selected semantic length controls.
 * These helpers select a visible prefix; they never rewrite generated text.
 */

export function getBoundaryRegex(mode: LengthMode): RegExp | null {
  switch (mode) {
    case "word":
      return null;
    case "sentence":
      return /[.?!](?:['"'»)\]}]+)?(?=\s|$)/;
    case "paragraph":
      return /\r?\n[ \t]*\r?\n|(?:^|\r?\n)[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*(?:\r?\n|$)/;
    case "page":
      return /\r?\n(?:[ \t]*\r?\n){2,}|(?:^|\r?\n)[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*(?:\r?\n|$)/;
  }
}

const OVERLAP = 32;

const getGlobalRegex = (() => {
  const cache = new WeakMap<RegExp, RegExp>();
  return (rx: RegExp): RegExp => {
    if (rx.flags.includes("g")) return rx;
    const cached = cache.get(rx);
    if (cached) return cached;
    const globalRx = new RegExp(rx.source, `${rx.flags}g`);
    cache.set(rx, globalRx);
    return globalRx;
  };
})();

export function findBoundaryCutoff(
  accumulated: string,
  sentIndex: number,
  rx: RegExp,
): number | null {
  const start = Math.max(0, sentIndex - OVERLAP);
  const search = accumulated.slice(start);
  const globalRx = getGlobalRegex(rx);

  let match: RegExpExecArray | null;
  while ((match = globalRx.exec(search)) !== null) {
    const end = match.index + match[0].length;
    if (start + end > sentIndex) return start + end;
  }
  return null;
}

/** Return the end of the first non-whitespace run once its boundary is known. */
export function findWordCutoff(text: string): number | null {
  const match = /\S+/.exec(text);
  if (!match) return null;
  const end = match.index + match[0].length;
  return end < text.length && /\s/.test(text[end]) ? end : null;
}
