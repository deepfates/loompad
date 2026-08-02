import type { RawLyncPresentationDiagnostic } from "./rawLyncPresentationTypes";
import type { StoryGeneratedBy } from "./storyTypes";

export type RawLyncPayloadState =
  | "available"
  | "critical-policy"
  | "critical-suppressed"
  | "no-train"
  | "no-train-policy"
  | "critical-suppressed-and-no-train";

/** One lossless source record, except where policy explicitly withholds payload. */
export interface RawLyncSourceRecord {
  id: string;
  envelope: Record<string, unknown>;
  payload?: Record<string, unknown>;
  sourceLine?: string;
  classification: "accepted" | "nonconforming";
  nonconformingReasons: string[];
  payloadState: RawLyncPayloadState;
  withheldBy: string[];
}

/**
 * Lossless representation used inside Textile's Loom viewing index.
 *
 * Available source records keep their exact JSONL line instead of also copying
 * the parsed envelope and payload into a second Lync event. Policy-withheld
 * records have no source line, so their safe envelope remains inline. The read
 * layer expands either form to `RawLyncSourceRecord` when curation needs it.
 */
export interface StoredRawLyncSourceRecord {
  id: string;
  sourceLine?: string;
  envelope?: Record<string, unknown>;
  classification: "accepted" | "nonconforming";
  nonconformingReasons: string[];
  payloadState: RawLyncPayloadState;
  withheldBy: string[];
}

export interface RawLyncArchiveObstacle {
  class: "cycle" | "dangling" | "unavailable-due-to-conflict";
  ids?: string[];
  missing?: string;
  id?: string;
}

export interface RawLyncCarriedCurationEvent {
  v: 1;
  id: string;
  kind: "lync/annotation";
  at: string;
  author: { actor: string; via?: string };
  parents: string[];
  payload: Record<string, unknown>;
}

export interface RawLyncCarriedKeep {
  sourceId: string;
  keepEvent?: {
    id: string;
    at: string;
    author: { actor: string; via?: string };
  };
  sourceSelectionIds: string[];
}

export interface RawLyncPortableNote {
  id: string;
  text: string;
  actor?: string;
  via?: string;
  createdAt: number;
}

/**
 * A Textile-authored turn that extends an imported source conversation.
 * It is not promoted to a raw source event: the origin loom + turn id remain
 * explicit, and its parent says whether the edge lands on source or Textile.
 */
export interface RawLyncPortableLocalTurn {
  turnId: string;
  originLoomId: string;
  parent: { kind: "source-event" | "textile-turn"; id: string } | null;
  text: string;
  role?: string;
  revises?: string;
  revisesRef?: { kind: "source-event" | "textile-turn"; id: string };
  actor?: string;
  via?: string;
  generatedBy?: StoryGeneratedBy;
  generation?: import("./storyTypes").StoryGenerationRecord;
  keepEvent?: {
    id: string;
    at: string;
    author: { actor: string; via?: string };
  };
  notes: RawLyncPortableNote[];
}

/** Small root metadata; full source records travel as hidden sibling turns. */
export interface RawLyncSourceArchiveMeta {
  schemaVersion: 1;
  sourceName: string;
  partial: boolean;
  obstacles: RawLyncArchiveObstacle[];
  suppressedPayloadIds: string[];
  noTrainTargetIds: string[];
  policyEventIds: string[];
  carriedCuration: RawLyncCarriedCurationEvent[];
  carriedKeeps: RawLyncCarriedKeep[];
  diagnostics: RawLyncPresentationDiagnostic[];
}

export interface RawLyncSourceArchive extends RawLyncSourceArchiveMeta {
  records: RawLyncSourceRecord[];
}
