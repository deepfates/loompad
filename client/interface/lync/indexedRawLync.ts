import {
  indexLyncSources,
  type IndexedLyncLine,
  type IndexedLyncUnion,
  type ReReadableLyncSource,
} from "@deepfates/lync/indexed-union";
import type { LyncEventBody } from "@deepfates/lync/events";

import { presentRawLyncEvent } from "./rawLyncPresentation";
import type { RawLyncProjection } from "./rawLync";
import type { ConversationLoomSnapshot, ConversationTurnMeta } from "./storyRuntime";
import type {
  OrderedLyncPresentationLocator,
  OrderedLyncReviewOwnership,
} from "./orderedLyncReviewTypes";
import type {
  OrderedLyncPrefixBinding,
  OrderedLyncSourceFile,
  OrderedLyncSourceSet,
} from "./orderedLyncSourceSet";

export interface IndexedRawLyncProjection extends RawLyncProjection {
  sourceCount: number;
  sourceBytes: number;
  diagnosticCount: number;
  ownership: OrderedLyncReviewOwnership;
}

/** Browser File adapter that exposes only the manifest-authenticated prefix. */
export function orderedLyncFileSource(source: OrderedLyncSourceFile): ReReadableLyncSource {
  const { binding, file } = source;
  return {
    file: file.name,
    size: binding.sizeBytes,
    expectedSha256: binding.sha256,
    async *stream() {
      const reader = file.slice(binding.startOffset, binding.endOffset).stream().getReader();
      let supplied = 0;
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) break;
          const remaining = binding.endOffset - supplied;
          if (remaining <= 0) {
            await reader.cancel();
            break;
          }
          const chunk = result.value.subarray(0, remaining);
          supplied += chunk.byteLength;
          yield chunk;
          if (supplied === binding.endOffset) {
            await reader.cancel();
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (supplied !== binding.endOffset) {
        throw new Error(`Ordered Lync source did not supply its complete prefix: ${file.name}.`);
      }
    },
    async read(start, end) {
      if (start < 0 || end < start || end > binding.endOffset) {
        throw new Error(`Ordered Lync reread is outside its bound prefix: ${file.name}.`);
      }
      return new Uint8Array(await file.slice(start, end).arrayBuffer());
    },
  };
}

/**
 * Index and project one authenticated Behold resident event at a time. Lync is
 * the only union/parser/topology authority; Textile retains public presenter
 * output and compact locators, never source lines or resident payload graphs.
 */
export async function projectIndexedOrderedLyncSources(
  manifest: OrderedLyncSourceSet,
  sources: readonly ReReadableLyncSource[],
  filename = "Imported Lync source set",
): Promise<IndexedRawLyncProjection> {
  assertManifestSourceShape(manifest, sources);
  const index = await indexLyncSources(sources);
  assertSafeIndexedProjection(index);

  await authenticateResidentRoots(manifest, index);

  const loomId = `textile-indexed:${manifest.digest}`;
  const virtualId = `textile-indexed-root:${manifest.digest}`;
  let createdAt = Number.POSITIVE_INFINITY;
  let readableEventCount = 0;
  let structuralEventCount = 0;
  let diagnosticCount = 0;
  let retainedPresentationChars = filename.length * 2;
  const turns: ConversationLoomSnapshot["turns"] = [];
  const navigationParents = new Map<string, string | undefined>();

  for await (const { line, event } of index.events()) {
    const binding = manifest.sources[line.locator.source];
    if (!binding) throw new Error("Indexed Lync event names an unbound source.");
    assertResidentEventBinding(event, line, binding, index);
    const presentation = presentRawLyncEvent(event, {
      loomProfile: index.presentationProfile(event.id) ?? undefined,
    });
    if (!presentation) {
      throw new Error(
        `Cannot review ordered resident event ${event.id}: kind ${event.kind} has no public presentation.`,
      );
    }
    const parsedAt = Date.parse(event.at);
    const eventAt = Number.isFinite(parsedAt) ? parsedAt : 0;
    createdAt = Math.min(createdAt, eventAt);
    if (presentation.kind === "content") readableEventCount += 1;
    else structuralEventCount += 1;
    diagnosticCount += presentation.diagnostics.length;
    retainedPresentationChars += presentation.text.length;
    retainedPresentationChars += presentation.sections.reduce(
      (sum, section) => sum + (section.text === presentation.text ? 0 : section.text.length),
      0,
    );

    const firstParent = event.parents[0];
    navigationParents.set(event.id, firstParent);
    const source = index.sources[line.locator.source]!;
    const locator: OrderedLyncPresentationLocator = {
      ...line.locator,
      sourceSha256: source.sha256,
      residentEntityId: binding.entityId,
      manifestDigest: manifest.digest,
    };
    const meta: ConversationTurnMeta = {
      role: "artifact",
      author: event.author.actor,
      via: typeof event.author.via === "string" ? event.author.via : undefined,
      sourceId: event.id,
      sourceKind: event.kind,
      sourceParents: [...event.parents],
      extraParentIds: event.parents.slice(1),
      sourceWarnings: line.nonconformingReasons ? [...line.nonconformingReasons] : [],
      sourcePresentation: presentation.kind,
      sourcePresentationContract: presentation.contract,
      sourcePresentationSource: presentation.source,
      sourcePresentationSections: presentation.sections.map((section) =>
        section.text === presentation.text
          ? { role: section.role, sourcePaths: [...section.sourcePaths], sameAsTurnText: true }
          : section
      ),
      sourcePresentationDiagnostics: presentation.diagnostics,
      sourceLoomProfile: index.presentationProfile(event.id) ?? undefined,
      sourceLocator: locator,
    };
    turns.push({
      id: event.id,
      loomId,
      parentId: firstParent ?? virtualId,
      payload: { message: presentation.text, text: presentation.text },
      meta,
      createdAt: eventAt,
    });
  }

  if (turns.length === 0) throw new Error("Ordered Lync source set has no presentable events.");
  const known = new Set(turns.map((turn) => turn.id));
  for (const turn of turns) {
    if (turn.parentId !== virtualId && !known.has(turn.parentId!)) {
      throw new Error(`Cannot project ordered resident event ${turn.id}: first parent is unavailable.`);
    }
  }
  const childCounts = new Map<string, number>();
  for (const parent of navigationParents.values()) {
    if (parent) childCounts.set(parent, (childCounts.get(parent) ?? 0) + 1);
  }
  if (!Number.isFinite(createdAt)) createdAt = 0;
  turns.unshift({
    id: virtualId,
    loomId,
    parentId: null,
    payload: { message: filename, text: filename },
    meta: { role: "corpus", author: "textile", rawVirtual: true },
    createdAt,
  });

  const snapshot: ConversationLoomSnapshot = {
    loom: {
      id: loomId,
      meta: { profile: "conversation", source: "raw-lync", title: filename },
      createdAt,
    },
    turns,
  };
  const measured = inspectRetainedProjection(snapshot);
  const ownership: OrderedLyncReviewOwnership = {
    sourceBytes: manifest.totalSizeBytes,
    index: index.ownership,
    retainedPresentationChars,
    ...measured,
  };
  return {
    snapshot,
    sourceCount: manifest.sourceCount,
    sourceBytes: manifest.totalSizeBytes,
    diagnosticCount,
    ownership,
    sourceEventCount: index.viewEligibleIds.length,
    readableEventCount,
    structuralEventCount,
    unsupportedEventCount: 0,
    unsupportedKinds: [],
    annotationCount: 0,
    branchPointCount: [...childCounts.values()].filter((count) => count > 1).length,
    selectedSourceCount: 0,
    selectedLocalTurnCount: 0,
    nonconformingCount: index.lines.filter((line) => line.class === "nonconforming").length,
    warnings: index.lines.flatMap((line) =>
      line.class === "nonconforming"
        ? [`${line.locator.file}:${line.locator.line} nonconforming: ${line.reason}`]
        : []
    ),
  };
}

/** Ordinary browser entry from resolved operator-selected source files. */
export async function projectOrderedLyncSourceFiles(
  manifest: OrderedLyncSourceSet,
  files: readonly OrderedLyncSourceFile[],
  filename: string,
): Promise<IndexedRawLyncProjection> {
  return projectIndexedOrderedLyncSources(
    manifest,
    files.map(orderedLyncFileSource),
    filename,
  );
}

function assertManifestSourceShape(
  manifest: OrderedLyncSourceSet,
  sources: readonly ReReadableLyncSource[],
): void {
  if (sources.length !== manifest.sourceCount) {
    throw new Error(`Ordered Lync source set requires exactly ${manifest.sourceCount} sources.`);
  }
  sources.forEach((source, index) => {
    const binding = manifest.sources[index]!;
    if (source.size !== binding.sizeBytes || source.expectedSha256 !== binding.sha256) {
      throw new Error(`Ordered Lync source ${index + 1} does not match its manifest binding.`);
    }
  });
}

function assertSafeIndexedProjection(index: IndexedLyncUnion): void {
  const issues: string[] = [];
  for (const line of index.lines) {
    if (["garbage", "damaged", "conflict-variant"].includes(line.class)) {
      issues.push(`${line.locator.file}:${line.locator.line} ${line.class}: ${line.reason}`);
    }
  }
  for (const pending of index.pendingParents) {
    issues.push(
      `${pending.locator.file}:${pending.locator.line} pending ${pending.id}: missing parent ${pending.missingParent}`,
    );
  }
  for (const obstacle of index.graphDiagnostics) {
    if (obstacle.class === "cycle") issues.push(`graph cycle: ${(obstacle.ids ?? []).join(" -> ")}`);
    else if (obstacle.class === "dangling") {
      issues.push(`graph dangling: ${obstacle.id ?? "event"} needs ${obstacle.missing ?? "a parent"}`);
    } else issues.push(`graph unavailable due to conflict: ${obstacle.id ?? "unknown event"}`);
  }
  if (index.conflictIds.length) issues.push(`conflicting ids: ${index.conflictIds.join(", ")}`);
  if (index.suppression.suppressedPayloadIds.length) {
    issues.push(`critical suppression affects: ${index.suppression.suppressedPayloadIds.join(", ")}`);
  }
  const unique = [...new Set(issues)];
  if (!unique.length) return;
  const shown = unique.slice(0, 6);
  const more = unique.length > shown.length ? `\n- …and ${unique.length - shown.length} more` : "";
  throw new Error(`Cannot review ordered .lync safely:\n- ${shown.join("\n- ")}${more}`);
}

async function authenticateResidentRoots(
  manifest: OrderedLyncSourceSet,
  index: IndexedLyncUnion,
): Promise<void> {
  for (let source = 0; source < manifest.sources.length; source += 1) {
    const binding = manifest.sources[source]!;
    const first = index.lines.find((line) => line.locator.source === source);
    if (!first?.id || first.locator.line !== 1 || first.envelope?.kind !== "lync/loom") {
      throw new Error(`Ordered Lync source has no resident root on line one: ${index.sources[source]?.file}.`);
    }
    const read = await index.readEvent(first.id);
    if (!read || read.line.locator.source !== source) {
      throw new Error(`Ordered Lync source root is unavailable: ${index.sources[source]?.file}.`);
    }
    const meta = read.event.payload.meta as Record<string, unknown> | undefined;
    if (
      read.event.parents.length !== 0 ||
      meta?.protocol !== "behold.entity-loom.v1" ||
      meta.entityId !== binding.entityId ||
      meta.profile !== binding.presentationProfile
    ) {
      throw new Error(`Ordered Lync source root does not match its resident binding: ${index.sources[source]?.file}.`);
    }
  }
}

function assertResidentEventBinding(
  event: LyncEventBody,
  line: IndexedLyncLine,
  binding: OrderedLyncPrefixBinding,
  index: IndexedLyncUnion,
): void {
  if (event.kind !== "lync/loom" && event.kind !== "lync/turn") {
    throw new Error(`Ordered resident source contains unsupported kind ${event.kind} at ${line.locator.file}:${line.locator.line}.`);
  }
  if (index.presentationProfile(event.id) !== binding.presentationProfile) {
    throw new Error(`Ordered resident event crosses or loses its bound presentation profile: ${event.id}.`);
  }
  if (event.kind === "lync/turn") {
    const payload = event.payload.payload as Record<string, unknown> | undefined;
    if (payload?.entityId !== binding.entityId) {
      throw new Error(`Ordered resident turn does not match its resident binding: ${event.id}.`);
    }
  }
}

function inspectRetainedProjection(snapshot: ConversationLoomSnapshot): {
  retainedSourceLineChars: number;
  retainedPrivatePayloadObjects: number;
  retainedRawBytes: number;
} {
  const seen = new Set<object>();
  let retainedSourceLineChars = 0;
  let retainedPrivatePayloadObjects = 0;
  let retainedRawBytes = 0;
  const visit = (value: unknown, key?: string) => {
    if (typeof value === "string") {
      if (key === "sourceLine") retainedSourceLineChars += value.length;
      return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (ArrayBuffer.isView(value)) {
      retainedRawBytes += value.byteLength;
      return;
    }
    if (key === "privateCausalFrames" || key === "private" || key === "sourcePayload") {
      retainedPrivatePayloadObjects += 1;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
  };
  visit(snapshot);
  return { retainedSourceLineChars, retainedPrivatePayloadObjects, retainedRawBytes };
}
