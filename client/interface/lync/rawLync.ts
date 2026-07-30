import {
  parseLyncFiles,
  type LyncEventBody,
  type LyncLineDiagnostic,
  type LyncParseResult,
} from "@deepfates/lync/events";
import type { ConversationLoomSnapshot, ConversationTurnMeta } from "./storyRuntime";
import type { RawLyncTag } from "../types";
import {
  presentRawLyncEvent,
  resolveLyncPresentationProfiles,
  type RawLyncPresentation,
} from "./rawLyncPresentation";
import type {
  RawLyncCarriedCurationEvent,
  RawLyncCarriedKeep,
  RawLyncPayloadState,
  RawLyncPortableLocalTurn,
  RawLyncSourceArchiveMeta,
  RawLyncSourceRecord,
} from "./rawLyncArchiveTypes";

export interface RawLyncProjectionOptions {
  initialSelectedSourceIds?: string[];
  carriedCuration?: RawLyncCarriedCurationEvent[];
  carriedKeeps?: RawLyncCarriedKeep[];
  carriedLocalTurns?: RawLyncPortableLocalTurn[];
}

export interface RawLyncProjection {
  snapshot: ConversationLoomSnapshot;
  sourceEventCount: number;
  readableEventCount: number;
  structuralEventCount: number;
  unsupportedEventCount: number;
  unsupportedKinds: string[];
  annotationCount: number;
  branchPointCount: number;
  selectedSourceCount: number;
  selectedLocalTurnCount: number;
  nonconformingCount: number;
  warnings: string[];
}

/**
 * Read a protocol-level `.lync` file without turning it into a Loom first.
 * Textile's UI is tree-shaped, so navigation follows only parents[0]. Every
 * other parent remains on the turn metadata and is surfaced in the reader.
 * The source event id is carried separately from Textile's imported turn id;
 * curation exporters always target the source id.
 */
export function projectRawLyncFile(
  text: string,
  filename = "Imported Lync corpus",
  options: RawLyncProjectionOptions = {},
): RawLyncProjection {
  const bytes = new TextEncoder().encode(text);
  const parsed = parseLyncFiles([{ file: filename, bytes }]);
  assertSafeProjection(parsed);
  const heldLines = heldSourceLines(parsed);
  const nonconforming = heldLines.filter((line) => line.class === "nonconforming");
  const events = heldLines.map((line) => line.event!);

  const annotations = events.filter((event) => event.kind === "lync/annotation");
  const sources = events.filter((event) => event.kind !== "lync/annotation");
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const suppressedBy = criticalSuppressorsByTarget(events, parsed);
  const noTrainBy = noTrainAnnotationsByTarget(annotations, parsed);
  const loomProfiles = resolveLyncPresentationProfiles(sources);
  const presentations = new Map<string, RawLyncPresentation>();
  for (const event of sources) {
    const policy = policyState(event, suppressedBy, noTrainBy);
    const presentation = policy === "available"
      ? presentRawLyncEvent(event, { loomProfile: loomProfiles.get(event.id) })
      : withheldPresentation(event, policy, [
          ...(suppressedBy.get(event.id) ?? []),
          ...(noTrainBy.get(event.id) ?? []),
        ]);
    if (presentation) presentations.set(event.id, presentation);
  }
  const presented = sources.filter((event) => presentations.has(event.id));
  const unsupported = sources.filter((event) => !presentations.has(event.id));
  const unsupportedKinds = [...new Set(unsupported.map((event) => event.kind))].sort();
  if (presented.length === 0) {
    const detail = unsupportedKinds.length
      ? ` Unsupported kinds: ${unsupportedKinds.join(", ")}.`
      : "";
    throw new Error(`No presentable events in this .lync file.${detail}`);
  }

  const archivedIds = contentBoundArchiveIds(
    presented.map((event) => event.id),
    eventsById,
    annotations,
    suppressedBy,
    noTrainBy,
  );
  const sourceRecords = heldLines
    .filter((line) => archivedIds.has(line.id!))
    .map((line) => sourceRecordFor(line, suppressedBy, noTrainBy));

  const presentedIds = new Set(presented.map((event) => event.id));
  const navigationParents = new Map(
    presented.map((event) => [
      event.id,
      nearestPresentedFirstParent(event, eventsById, presentedIds),
    ]),
  );
  const warningsById = new Map(
    nonconforming.flatMap((line) =>
      line.id ? [[line.id, line.nonconformingReasons ?? [line.reason]] as const] : [],
    ),
  );
  const tagsByTarget = clusterTagsByTarget(annotations);
  const selectedIds = selectedSourceIds(annotations);
  for (const id of options.initialSelectedSourceIds ?? []) selectedIds.add(id);
  const childCounts = new Map<string, number>();
  for (const parent of navigationParents.values()) {
    if (parent) childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
  }
  const virtualId = `textile-raw-root:${presented[0]!.id}`;
  const createdAt = Math.min(...presented.map(eventTime));
  const loomId = `textile-raw:${presented[0]!.id}`;

  const archiveMeta: RawLyncSourceArchiveMeta = {
    schemaVersion: 1,
    sourceName: filename,
    partial: false,
    obstacles: [],
    suppressedPayloadIds: [...suppressedBy.keys()].sort(),
    noTrainTargetIds: [...noTrainBy.keys()].sort(),
    policyEventIds: [...new Set([
      ...[...suppressedBy.values()].flat(),
      ...[...noTrainBy.values()].flat(),
    ])].sort(),
    carriedCuration: [...(options.carriedCuration ?? [])],
    carriedKeeps: [...(options.carriedKeeps ?? [])],
    diagnostics: [],
  };
  const turns: ConversationLoomSnapshot["turns"] = [
    {
      id: virtualId,
      loomId,
      parentId: null,
      payload: { message: filename, text: filename },
      meta: {
        role: "corpus",
        author: "textile",
        rawVirtual: true,
        sourceArchive: archiveMeta,
      },
      createdAt,
    },
  ];

  for (const record of sourceRecords) {
    const author = record.envelope.author as
      | { actor?: unknown; via?: unknown }
      | undefined;
    turns.push({
      id: `textile-raw-source:${record.id}`,
      loomId,
      parentId: virtualId,
      payload: { message: record, text: "" },
      meta: {
        role: "raw-source",
        author: typeof author?.actor === "string" ? author.actor : "unknown",
        via: typeof author?.via === "string" ? author.via : undefined,
        rawSource: true,
      },
      createdAt: eventTime(eventsById.get(record.id)!),
    });
  }

  for (const event of orderByNavigationParent(presented, navigationParents)) {
    const navigationParent = navigationParents.get(event.id) ?? virtualId;
    const presentation = presentations.get(event.id)!;
    const meta: ConversationTurnMeta = {
      role: rawRole(event),
      author: event.author.actor,
      via: typeof event.author.via === "string" ? event.author.via : undefined,
      sourceId: event.id,
      sourceKind: event.kind,
      sourceParents: [...event.parents],
      extraParentIds: event.parents.slice(1),
      rawTags: tagsByTarget.get(event.id) ?? [],
      sourceSelected: selectedIds.has(event.id),
      sourceWarnings: warningsById.get(event.id) ?? [],
      sourcePresentation: presentation.kind,
      sourcePresentationContract: presentation.contract,
      sourcePresentationSource: presentation.source,
      sourcePresentationSections: presentation.sections.map((section) =>
        section.text === presentation.text
          ? {
              role: section.role,
              sourcePaths: [...section.sourcePaths],
              sameAsTurnText: true as const,
            }
          : section
      ),
      sourcePresentationDiagnostics: presentation.diagnostics,
      sourceLoomProfile: loomProfiles.get(event.id),
    };
    turns.push({
      id: event.id,
      loomId,
      parentId: navigationParent,
      payload: { message: presentation.text, text: presentation.text },
      meta,
      createdAt: eventTime(event),
    });
  }

  for (const local of options.carriedLocalTurns ?? []) {
    turns.push({
      id: local.turnId,
      loomId,
      parentId: local.parent?.id ?? virtualId,
      payload: { message: local.text, text: local.text },
      meta: {
        role: local.role ?? "prose",
        author: local.actor ?? "unknown",
        via: local.via,
        generatedBy: local.generatedBy,
        revises: local.revises,
        portableRole: local.role,
        portableRevises: local.revisesRef,
        portableTurnId: local.turnId,
        portableOriginLoomId: local.originLoomId,
        portableKeep: local.keepEvent,
        portableNotes: local.notes,
      },
      createdAt: local.keepEvent ? Date.parse(local.keepEvent.at) : createdAt,
    });
  }

  return {
    snapshot: {
      loom: {
        id: loomId,
        meta: { profile: "conversation", source: "raw-lync", title: filename },
        createdAt,
      },
      turns,
    },
    sourceEventCount: sources.length,
    readableEventCount: presented.filter(
      (event) => presentations.get(event.id)?.kind === "content",
    ).length,
    structuralEventCount: presented.filter(
      (event) => presentations.get(event.id)?.kind === "structure",
    ).length,
    unsupportedEventCount: unsupported.length,
    unsupportedKinds,
    annotationCount: annotations.length,
    branchPointCount: [...childCounts.values()].filter((count) => count > 1).length,
    selectedSourceCount: presented.filter((event) => selectedIds.has(event.id)).length,
    selectedLocalTurnCount: (options.carriedLocalTurns ?? []).filter(
      (turn) => turn.keepEvent,
    ).length,
    nonconformingCount: nonconforming.length,
    warnings: nonconforming.map(
      (line) => `${line.file}:${line.line} nonconforming: ${line.reason}`,
    ),
  };
}

function heldSourceLines(parsed: LyncParseResult): LyncLineDiagnostic[] {
  const eligible = new Set(parsed.viewEligibleIds);
  const held = new Map<string, LyncLineDiagnostic>();
  for (const line of parsed.lines) {
    if (!line.id || !line.event || !eligible.has(line.id)) continue;
    const existing = held.get(line.id);
    if (!existing || compareHeldLines(line, existing) < 0) held.set(line.id, line);
  }
  return [...held.values()].sort((a, b) => a.id!.localeCompare(b.id!));
}

function compareHeldLines(a: LyncLineDiagnostic, b: LyncLineDiagnostic): number {
  const richness = (line: LyncLineDiagnostic) =>
    (line.hasSig || line.sig ? 2 : 0) + (line.hasDigest || line.digest ? 1 : 0);
  const richnessDifference = richness(b) - richness(a);
  if (richnessDifference !== 0) return richnessDifference;
  return decodeLine(a).localeCompare(decodeLine(b));
}

function decodeLine(line: LyncLineDiagnostic): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(line.bytes);
}

function sourceRecordFor(
  line: LyncLineDiagnostic,
  suppressedBy: Map<string, string[]>,
  noTrainBy: Map<string, string[]>,
): RawLyncSourceRecord {
  const event = line.event!;
  const { payload, ...envelope } = event;
  const payloadState = policyState(event, suppressedBy, noTrainBy);
  const withheldBy = [...new Set([
    ...(event.critical === true ? [event.id] : []),
    ...(event.kind === "lync/annotation" && event.payload.label === "no-train"
      ? [event.id]
      : []),
    ...(suppressedBy.get(event.id) ?? []),
    ...(noTrainBy.get(event.id) ?? []),
  ])].sort();
  return {
    id: event.id,
    envelope,
    ...(payloadState === "available" ? { payload, sourceLine: decodeLine(line) } : {}),
    classification: line.class === "nonconforming" ? "nonconforming" : "accepted",
    nonconformingReasons: [...(line.nonconformingReasons ?? [])],
    payloadState,
    withheldBy,
  };
}

function policyState(
  event: LyncEventBody,
  suppressedBy: Map<string, string[]>,
  noTrainBy: Map<string, string[]>,
): RawLyncPayloadState {
  if (event.critical === true) return "critical-policy";
  if (event.kind === "lync/annotation" && event.payload.label === "no-train") {
    return "no-train-policy";
  }
  const id = event.id;
  const suppressed = suppressedBy.has(id);
  const noTrain = noTrainBy.has(id);
  if (suppressed && noTrain) return "critical-suppressed-and-no-train";
  if (suppressed) return "critical-suppressed";
  if (noTrain) return "no-train";
  return "available";
}

function criticalSuppressorsByTarget(
  events: LyncEventBody[],
  parsed: LyncParseResult,
): Map<string, string[]> {
  const suppressed = new Set(parsed.suppression.suppressedPayloadIds);
  const result = new Map<string, string[]>();
  for (const event of events) {
    if (event.critical !== true) continue;
    for (const parent of event.parents) {
      if (!suppressed.has(parent)) continue;
      const ids = result.get(parent) ?? [];
      ids.push(event.id);
      result.set(parent, ids);
    }
  }
  for (const ids of result.values()) ids.sort();
  return result;
}

function contentBoundArchiveIds(
  presentedIds: string[],
  eventsById: Map<string, LyncEventBody>,
  annotations: LyncEventBody[],
  suppressedBy: Map<string, string[]>,
  noTrainBy: Map<string, string[]>,
): Set<string> {
  const retained = new Set<string>();
  const stack = [...presentedIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (retained.has(id)) continue;
    retained.add(id);
    for (const parent of eventsById.get(id)?.parents ?? []) stack.push(parent);
  }
  for (const annotation of annotations) {
    if (annotation.parents.some((parent) => retained.has(parent))) {
      retained.add(annotation.id);
    }
  }
  for (const policyMap of [suppressedBy, noTrainBy]) {
    for (const [target, ids] of policyMap) {
      if (!retained.has(target)) continue;
      for (const id of ids) retained.add(id);
    }
  }
  return retained;
}

function noTrainAnnotationsByTarget(
  annotations: LyncEventBody[],
  parsed: LyncParseResult,
): Map<string, string[]> {
  const suppressed = new Set(parsed.suppression.suppressedPayloadIds);
  const result = new Map<string, string[]>();
  for (const event of annotations) {
    if (suppressed.has(event.id) || event.payload.label !== "no-train") continue;
    for (const parent of event.parents) {
      const ids = result.get(parent) ?? [];
      ids.push(event.id);
      result.set(parent, ids);
    }
  }
  for (const ids of result.values()) ids.sort();
  return result;
}

function withheldPresentation(
  event: LyncEventBody,
  state: RawLyncPayloadState,
  by: string[],
): RawLyncPresentation {
  const reason = state.includes("critical-suppressed")
    ? "critical source suppression"
    : state === "critical-policy"
      ? "the source event's critical policy"
      : state === "no-train-policy"
        ? "the source event's no-train policy"
        : "a no-train annotation";
  const text = `Payload withheld by ${reason}.\nSource kind: ${event.kind}\nSource id: ${event.id}`;
  return {
    text,
    kind: "structure",
    contract: "lync/policy-withheld",
    source: {
      id: event.id,
      parents: [...event.parents],
      author: {
        actor: event.author.actor,
        ...(typeof event.author.via === "string" ? { via: event.author.via } : {}),
      },
      kind: event.kind,
    },
    sections: [{ role: "structure", text, sourcePaths: [] }],
    diagnostics: by.map((sourcePath) => ({
      code: state,
      sourcePath: `policy-event:${sourcePath}`,
    })),
  };
}

/** Refuse to build a plausible-looking partial tree from an unsafe union. */
function assertSafeProjection(parsed: LyncParseResult): void {
  const issues: string[] = [];
  for (const line of parsed.lines) {
    if (["garbage", "damaged", "conflict-variant"].includes(line.class)) {
      issues.push(`${line.file}:${line.line} ${line.class}: ${line.reason}`);
    }
  }
  for (const pending of parsed.pending) {
    issues.push(
      `${pending.file}:${pending.line} pending ${pending.id}: missing parent ${pending.missingParent}`,
    );
  }
  if (parsed.pendingOverflowCount > 0) {
    issues.push(`${parsed.pendingOverflowCount} pending events exceeded the parser limit`);
  }
  for (const obstacle of parsed.graphDiagnostics) {
    if (obstacle.class === "cycle") {
      issues.push(`graph cycle: ${(obstacle.ids ?? []).join(" -> ") || "unknown events"}`);
    } else if (obstacle.class === "dangling") {
      issues.push(`graph dangling: ${obstacle.id ?? "event"} needs ${obstacle.missing ?? "a parent"}`);
    } else {
      issues.push(`graph unavailable due to conflict: ${obstacle.id ?? "unknown event"}`);
    }
  }
  const unique = [...new Set(issues)];
  if (unique.length === 0) return;
  const shown = unique.slice(0, 6);
  const more = unique.length > shown.length ? `\n- …and ${unique.length - shown.length} more` : "";
  throw new Error(
    `Cannot import .lync safely; repair or remove these records:\n- ${shown.join("\n- ")}${more}`,
  );
}

function eventTime(event: LyncEventBody): number {
  const parsed = Date.parse(event.at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rawRole(event: LyncEventBody): string {
  const role = event.payload.role;
  if (typeof role === "string") return role;
  if (event.kind.includes("user")) return "user";
  if (event.kind.includes("assistant")) return "assistant";
  return "artifact";
}

function clusterTagsByTarget(events: LyncEventBody[]): Map<string, RawLyncTag[]> {
  const result = new Map<string, RawLyncTag[]>();
  for (const event of events) {
    if (event.payload.label !== "cluster") continue;
    const value = event.payload.value;
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    if (typeof record.tag !== "string") continue;
    for (const target of event.parents) {
      const bucket = result.get(target) ?? [];
      bucket.push({
        annotationId: event.id,
        label: "cluster",
        tag: record.tag,
        clusterId: typeof record.cluster_id === "number" ? record.cluster_id : undefined,
        rating: typeof record.rating === "string" ? record.rating : undefined,
        actor: event.author.actor,
      });
      result.set(target, bucket);
    }
  }
  return result;
}

function selectedSourceIds(events: LyncEventBody[]): Set<string> {
  const selected = new Set<string>();
  for (const event of events) {
    if (event.payload.label !== "selection" || !Array.isArray(event.payload.chosen)) continue;
    for (const id of event.payload.chosen) if (typeof id === "string") selected.add(id);
  }
  return selected;
}

/** Collapse non-readable tool steps without changing which first-parent chain is followed. */
function nearestPresentedFirstParent(
  event: LyncEventBody,
  eventsById: Map<string, LyncEventBody>,
  readableIds: Set<string>,
): string | undefined {
  let parent = event.parents[0];
  while (parent) {
    if (readableIds.has(parent)) return parent;
    parent = eventsById.get(parent)?.parents[0];
  }
  return undefined;
}

function orderByNavigationParent(
  events: LyncEventBody[],
  navigationParents: Map<string, string | undefined>,
): LyncEventBody[] {
  const pending = new Map(events.map((event) => [event.id, event]));
  const ordered: LyncEventBody[] = [];
  const emitted = new Set<string>();
  while (pending.size > 0) {
    const ready = [...pending.values()].filter((event) => {
      const parent = navigationParents.get(event.id);
      return !parent || emitted.has(parent);
    });
    if (ready.length === 0) {
      throw new Error("Cannot project .lync first-parent navigation: the source contains a cycle.");
    }
    ready.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    for (const event of ready) {
      pending.delete(event.id);
      emitted.add(event.id);
      ordered.push(event);
    }
  }
  return ordered;
}
