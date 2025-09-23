/**
 * Shared text-seam regex constants (and tiny helpers) for use across client and server.
 *
 * These patterns support consistent handling of whitespace boundaries when joining
 * streamed or segmented text. They are CRLF-safe and focused on seam normalization.
 */

/**
 * Matches one or more leading newlines at the start of a string.
 * - Handles both LF and CRLF sequences.
 * - Useful for dropping duplicated leading newlines when the previous segment
 *   already ended with a newline.
 *
 * Example:
 *   "Line 1\n" + "\nLine 2" => drop the leading newline in the second segment
 */
export const LEADING_NEWLINES_RE = /^(?:\r?\n)+/;

/**
 * Matches one or more leading spaces or tabs at the start of a string.
 * - Does NOT match newlines.
 * - Useful for removing duplicated space/tab separation when the previous
 *   segment already ended with a space or tab.
 */
export const LEADING_SPACES_TABS_RE = /^[ \t]+/;

/**
 * Matches a single trailing newline (LF or CRLF) at the end of a string.
 * - Typically used for state tracking: did the previous segment end with a newline?
 */
export const ENDING_NEWLINE_RE = /\r?\n$/;

/**
 * Matches a single trailing whitespace character at the end of a string.
 * - Includes spaces, tabs, and newlines.
 * - Typically used for state tracking: did the previous segment end with any whitespace?
 */
export const ENDING_WHITESPACE_RE = /\s$/;

/**
 * Matches any non-whitespace character.
 * - Handy for whitespace-only checks: !NON_WHITESPACE_RE.test(text)
 */
export const NON_WHITESPACE_RE = /\S/;

/**
 * Utility: returns true if the string contains only whitespace.
 * Equivalent to: !/\S/.test(text)
 */
export function isWhitespaceOnly(text: string): boolean {
  return !NON_WHITESPACE_RE.test(text);
}

/**
 * Utility: returns true if the string ends with a newline (LF or CRLF).
 */
export function endsWithNewline(text: string): boolean {
  return ENDING_NEWLINE_RE.test(text);
}

/**
 * Utility: returns true if the string ends with any whitespace character.
 */
export function endsWithWhitespace(text: string): boolean {
  return ENDING_WHITESPACE_RE.test(text);
}
