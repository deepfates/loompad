import type { LyncEventBody } from "@deepfates/lync/events";
import {
  BEHOLD_INHABITANT_PROFILE,
  presentLyncEvent,
  resolveLyncPresentationProfiles,
  type LyncPresentation,
  type LyncPresentationContext,
} from "../../../vendor/lync-presentation/index.js";

export { BEHOLD_INHABITANT_PROFILE, resolveLyncPresentationProfiles };

export type {
  LyncPresentation as RawLyncPresentation,
  LyncPresentationDiagnostic as RawLyncPresentationDiagnostic,
  LyncPresentationKind as RawLyncPresentationKind,
  LyncPresentationRole as RawLyncPresentationRole,
  LyncPresentationSection as RawLyncPresentationSection,
  LyncPresentationSource as RawLyncPresentationSource,
} from "../../../vendor/lync-presentation/index.js";

export type RawLyncPresentationContext = LyncPresentationContext;

/** Textile adapter: unsupported and unclaimed source events remain unpresented. */
export function presentRawLyncEvent(
  event: LyncEventBody,
  context: RawLyncPresentationContext = {},
): LyncPresentation | null {
  const result = presentLyncEvent(event, context);
  return result.status === "presented" ? result.presentation : null;
}
