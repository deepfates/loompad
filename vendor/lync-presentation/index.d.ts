import type { LyncEventBody } from "@deepfates/lync/events";
export declare const BEHOLD_INHABITANT_PROFILE = "org.behold.inhabitant.v1";
export declare const BEHOLD_INHABITANT_PROFILE_V2 = "org.behold.inhabitant.v2";
export type LyncPresentationKind = "content" | "structure";
export type LyncPresentationRole = "content" | "structure" | "perception" | "utterance" | "action" | "outcome";
export interface LyncPresentationSection {
    role: LyncPresentationRole;
    text: string;
    /** Exact JSON paths in the source event used for this section. */
    sourcePaths: string[];
}
export interface LyncPresentationDiagnostic {
    code: string;
    sourcePath: string;
}
export interface LyncPresentationSource {
    id: string;
    parents: string[];
    author: {
        actor: string;
        via?: string;
    };
    kind: string;
}
/** A non-mutating readable projection over one exact source event. */
export interface LyncPresentation {
    text: string;
    kind: LyncPresentationKind;
    contract: string;
    source: LyncPresentationSource;
    sections: LyncPresentationSection[];
    diagnostics: LyncPresentationDiagnostic[];
}
export interface LyncPresentationContext {
    /** Exact profile inherited from a causal loom root, when unambiguous. */
    loomProfile?: string;
}
export type LyncPresentationResult = {
    status: "presented";
    presentation: LyncPresentation;
} | {
    status: "unsupported";
    contract: string;
    diagnostics: LyncPresentationDiagnostic[];
} | {
    status: "unclaimed";
};
/**
 * Resolve one source event through exact profile, exact kind, then the small
 * generic text/message pact. A claimed profile or kind never falls through
 * when its payload is malformed: callers receive an explicit unsupported
 * decision instead of plausible prose from an unrelated nested field.
 */
export declare function presentLyncEvent(event: LyncEventBody, context?: LyncPresentationContext): LyncPresentationResult;
/**
 * Resolve the one profile inherited through an event's causal parents.
 * Parent order and event identities are untouched. Conflicting inherited
 * profiles deliberately resolve to no profile rather than choosing one.
 */
export declare function resolveLyncPresentationProfiles(events: Iterable<LyncEventBody>): Map<string, string>;
/** Convert source HTML to inert, readable plain text without executing it. */
export declare function htmlToPlainText(html: string | null): string | null;
