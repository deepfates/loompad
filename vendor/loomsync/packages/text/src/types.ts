import type { TurnId } from "../../core/src/index";

// Minimal v0.2 text payload. Richer app semantics should live in turn meta:
// role, author/provenance, revisions, responses, references, and other
// non-lineage relations should not be packed into this human-readable content.
export type TextPayload = { text: string };

export interface TextThreadTurn {
  id: TurnId;
  text: string;
}
