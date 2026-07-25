/** Presentation boundary for source events too large for one wrapped DOM node. */
export const VIRTUAL_TEXT_THRESHOLD = 1024 * 1024;

/** One reversible reader window; the complete string stays in the story model. */
export const VIRTUAL_TEXT_PAGE_SIZE = 64 * 1024;
