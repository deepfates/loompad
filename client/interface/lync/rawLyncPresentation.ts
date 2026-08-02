import type { LyncEventBody } from "@deepfates/lync/events";
import {
  presentLyncEvent,
  type LyncPresentation,
  type LyncPresentationContext,
} from "@deepfates/lync/presentation";

export {
  BEHOLD_INHABITANT_PROFILE,
  resolveLyncPresentationProfiles,
} from "@deepfates/lync/presentation";

export type {
  LyncPresentation as RawLyncPresentation,
  LyncPresentationDiagnostic as RawLyncPresentationDiagnostic,
  LyncPresentationKind as RawLyncPresentationKind,
  LyncPresentationRole as RawLyncPresentationRole,
  LyncPresentationSection as RawLyncPresentationSection,
  LyncPresentationSource as RawLyncPresentationSource,
} from "@deepfates/lync/presentation";

export type RawLyncPresentationContext = LyncPresentationContext;

/** Textile adapter: unsupported and unclaimed source events remain unpresented. */
export function presentRawLyncEvent(
  event: LyncEventBody,
  context: RawLyncPresentationContext = {},
): LyncPresentation | null {
  const result = presentLyncEvent(event, context);
  return result.status === "presented" ? result.presentation : null;
}
