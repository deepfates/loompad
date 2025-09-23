/**
 * Whitespace seam-normalizing join utilities for client-side text assembly.
 *
 * Goals:
 * - Preserve necessary spaces/newlines that are already present.
 * - Avoid duplicate spaces/newlines when they occur across boundaries.
 * - Never invent separators (no adding spaces if none exist).
 *
 * This mirrors the server-side streaming normalization behavior so that
 * prompts or concatenated client text remain consistent with streamed output.
 */

import {
  LEADING_NEWLINES_RE,
  LEADING_SPACES_TABS_RE,
  ENDING_NEWLINE_RE,
  ENDING_WHITESPACE_RE,
} from "../../../shared/textSeams";

/**
 * Returns a version of `next` with duplicated leading whitespace at the seam removed,
 * based on how `prev` ends.
 *
 * Rules:
 * - If `prev` ends with a newline (CRLF or LF), drop all leading newlines from `next`.
 * - Else if `prev` ends with whitespace (space or tab), drop leading spaces/tabs from `next`.
 * - Otherwise, leave `next` unchanged.
 */
export function normalizeNextForSeam(prev: string, next: string): string {
  if (!next) return next;

  const prevEndedWithNewline = ENDING_NEWLINE_RE.test(prev);
  const prevEndedWithWhitespace = ENDING_WHITESPACE_RE.test(prev);

  if (prevEndedWithNewline) {
    // Remove one or more leading CRLF/LF
    return next.replace(LEADING_NEWLINES_RE, "");
  }

  if (prevEndedWithWhitespace) {
    // Remove leading spaces/tabs only (preserve any leading newline)
    return next.replace(LEADING_SPACES_TABS_RE, "");
  }

  return next;
}

/**
 * Join two strings with seam normalization.
 * Equivalent to: prev + normalizeNextForSeam(prev, next)
 */
export function joinPair(prev: string, next: string): string {
  return prev + normalizeNextForSeam(prev, next);
}

/**
 * Join an array (or iterable) of string segments while normalizing seams at each boundary.
 *
 * Example behaviors:
 * - "Hello " + " world" => "Hello world"  (drops duplicate boundary space)
 * - "Line 1\n\n" + "\nLine 2" => "Line 1\n\nLine 2"  (drops duplicate boundary newline)
 * - "Hello" + " world" => "Hello world"  (keeps existing separator from next)
 * - "Hello" + "world" => "Helloworld"    (does not invent separators)
 */
export function joinSegments(segments: Iterable<string>): string {
  let acc = "";
  let first = true;

  for (const seg of segments) {
    if (first) {
      acc = seg || "";
      first = false;
      continue;
    }
    acc += normalizeNextForSeam(acc, seg || "");
  }

  return acc;
}

/**
 * Convenience helper for arrays.
 */
export function joinArray(segments: string[]): string {
  return joinSegments(segments);
}
