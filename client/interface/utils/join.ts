/**
 * A story path is a sequence of exact turn strings. Preserve those strings;
 * represent only the structural boundary that is otherwise absent from both
 * sides. This same rule is used for the visible prose and model context.
 */
export function storySeam(prev: string, next: string): "" | " " {
  if (!prev || !next || /\s$/.test(prev) || /^\s/.test(next)) return "";
  return " ";
}

/**
 * Join two strings with seam normalization.
 * Stored bytes remain unchanged; the returned string includes the explicit
 * structural seam when neither turn carries one.
 */
export function joinPair(prev: string, next: string): string {
  return prev + storySeam(prev, next) + next;
}

/**
 * Serialize a sequence of exact story turns as flowing prose.
 *
 * Example behaviors:
 * - "Hello " + " world" => "Hello  world" (both authored spaces survive)
 * - "Hello" + " world" => "Hello world"   (the next turn owns the seam)
 * - "Hello" + "world" => "Hello world"    (the turn boundary owns the seam)
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
    acc = joinPair(acc, seg || "");
  }

  return acc;
}

/**
 * Convenience helper for arrays.
 */
export function joinArray(segments: string[]): string {
  return joinSegments(segments);
}
