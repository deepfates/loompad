export type {
  LyncPresentation as RawLyncPresentation,
  LyncPresentationDiagnostic as RawLyncPresentationDiagnostic,
  LyncPresentationKind as RawLyncPresentationKind,
  LyncPresentationRole as RawLyncPresentationRole,
  LyncPresentationSection as RawLyncPresentationSection,
  LyncPresentationSource as RawLyncPresentationSource,
} from "../../../vendor/lync-presentation/index.js";

/**
 * Compact on-Loom form for a presentation section. When a section is exactly
 * the turn's primary text, retain its role/path provenance without serializing
 * the same potentially multi-megabyte string a third time. The read fold
 * expands this marker back to the public Lync presentation shape.
 */
export type StoredRawLyncPresentationSection =
  | import("../../../vendor/lync-presentation/index.js").LyncPresentationSection
  | {
      role: import("../../../vendor/lync-presentation/index.js").LyncPresentationRole;
      sourcePaths: string[];
      sameAsTurnText: true;
    };
