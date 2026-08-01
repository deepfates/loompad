import type { IndexedLyncLocator, IndexedLyncOwnership } from "@deepfates/lync/indexed-union";

/** Compact provenance retained beside a public resident presentation. */
export interface OrderedLyncPresentationLocator extends IndexedLyncLocator {
  sourceSha256: string;
  residentEntityId: string;
  manifestDigest: string;
}

/** Measured ownership for the indexed union and Textile's retained session view. */
export interface OrderedLyncReviewOwnership {
  sourceBytes: number;
  index: IndexedLyncOwnership;
  retainedPresentationChars: number;
  retainedSourceLineChars: number;
  retainedPrivatePayloadObjects: number;
  retainedRawBytes: number;
}
