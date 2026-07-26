export type RawLyncPresentationKind = "content" | "structure";

export type RawLyncPresentationRole =
  "structure" | "perception" | "utterance" | "action" | "outcome";

export interface RawLyncPresentationSection {
  role: RawLyncPresentationRole;
  text: string;
  sourcePaths: string[];
}

export interface RawLyncPresentationDiagnostic {
  code: string;
  sourcePath: string;
}

export interface RawLyncPresentationSource {
  id: string;
  parents: string[];
  author: { actor: string; via?: string };
  kind: string;
}

/** A non-mutating readable view over one exact source event. */
export interface RawLyncPresentation {
  text: string;
  kind: RawLyncPresentationKind;
  contract: string;
  source?: RawLyncPresentationSource;
  sections?: RawLyncPresentationSection[];
  diagnostics?: RawLyncPresentationDiagnostic[];
}
