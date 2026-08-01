import type { Loom, Turn, TurnId } from "@deepfates/lync";
import type { StoryAnnotation, StoryNode, StoryOrigin } from "../types";
import type {
  StoryDraft,
  StoryGeneratedBy,
  StoryLoom,
  StoryTurnMeta,
  StoryTurnPayload,
} from "./storyTypes";

type StoryTurn = Turn<StoryTurnPayload, StoryTurnMeta>;

/**
 * The read-layer view of a turn's `meta`: the provenance + role fields the
 * reader surfaces, widened PAST the story-specific role union so the SAME fold
 * reads a CONVERSATION loom (roles `"user"`/`"assistant"`) exactly as it reads a
 * story loom. `author`/`via`/`generatedBy` are the dee-9y0k provenance fields —
 * reused here, not reinvented, because provenance is first-class when reading a
 * multi-actor record.
 */
export interface ReadableTurnMeta {
  role?: string;
  author?: string;
  via?: string;
  generatedBy?: StoryGeneratedBy;
  revises?: TurnId;
  /** Present only on `role: "mark"` turns — the kept state this swipe records. */
  kept?: boolean;
  rawVirtual?: boolean;
  rawSource?: boolean;
  sourceArchive?: import("./rawLyncArchiveTypes").RawLyncSourceArchiveMeta;
  sourceId?: string;
  sourceKind?: string;
  sourceParents?: string[];
  extraParentIds?: string[];
  rawTags?: import("../types").RawLyncTag[];
  sourceSelected?: boolean;
  sourceWarnings?: string[];
  sourcePresentation?: "content" | "structure";
  sourcePresentationContract?: string;
  sourcePresentationSource?: import("./rawLyncPresentationTypes").RawLyncPresentationSource;
  sourcePresentationSections?: import("./rawLyncPresentationTypes").StoredRawLyncPresentationSection[];
  sourcePresentationDiagnostics?: import("./rawLyncPresentationTypes").RawLyncPresentationDiagnostic[];
  sourceLoomProfile?: string;
  sourceEnvelope?: Record<string, unknown>;
  sourceLocator?: import("./orderedLyncReviewTypes").OrderedLyncPresentationLocator;
  portableTurnId?: string;
  portableOriginLoomId?: string;
  portableRole?: string;
  portableRevises?: import("./rawLyncArchiveTypes").RawLyncPortableLocalTurn["revisesRef"];
  portableKeep?: import("./rawLyncArchiveTypes").RawLyncPortableLocalTurn["keepEvent"];
  portableNotes?: import("./rawLyncArchiveTypes").RawLyncPortableNote[];
  archiveSource?: import("./archiveTypes").ArchiveSourceRef;
}

/**
 * Any lync loom the reader can project — a story loom OR a non-story loom (a
 * conversation loom today; other shapes later). The payload is `unknown` on
 * purpose: `deriveTurnText` pulls display text from whichever field carries it
 * (`text` for story turns, `message` for conversation turns), so the reader is
 * not hardcoded to `StoryTurnPayload`. Story looms are assignable to this type.
 */
export type ReadableLoom = Loom<unknown, unknown, ReadableTurnMeta>;
type ReadableTurn = Turn<unknown, ReadableTurnMeta>;

/**
 * Derive a turn's displayable text WITHOUT assuming story shape. A story turn
 * carries `payload.text`; a conversation turn (what splice's
 * lync-claude-session emits, and what a hand-made conversation loom stamps)
 * carries `payload.message` — a string, or a structured Claude message whose
 * `content` holds the text. We read the first field that yields text.
 *
 * A payload with NO readable field is NOT silently blanked (that would hide a
 * shape the reader can't yet open): it throws, loud and specific, so an
 * unreadable loom surfaces instead of rendering empty turns.
 */
export function deriveTurnText(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const record = payload as { text?: unknown; message?: unknown };
    if (typeof record.text === "string") return record.text;
    if (typeof record.message === "string") return record.message;
    const fromMessage = textFromMessage(record.message);
    if (fromMessage !== null) return fromMessage;
  }
  throw new Error(
    "Turn payload has no readable text: expected a `text` (story) or " +
      "`message` (conversation) field.",
  );
}

/**
 * Pull text out of a structured message object (the real splice
 * lync-claude-session payload keeps the raw Claude `message`, whose `content`
 * is a string or an array of content blocks). String content wins; an array
 * concatenates its text blocks. Returns null when nothing text-like is found.
 */
function textFromMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const record = message as { text?: unknown; content?: unknown };
  if (typeof record.text === "string") return record.text;
  const content = record.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object") {
          const text = (block as { text?: unknown }).text;
          if (typeof text === "string") return text;
        }
        return "";
      })
      .filter((part) => part.length > 0);
    if (parts.length > 0) return parts.join("");
  }
  return null;
}

/**
 * Identity stamped into a turn's `meta` at append time. `actor`/`via` travel in
 * `meta` (not `event.body.author`) so they survive lync's buildFold. `generatedBy`
 * is present ONLY for model turns — its presence is what marks model origin.
 */
export interface StoryAuthorship {
  actor?: string;
  via?: string;
  generatedBy?: StoryGeneratedBy;
}

/** Fold identity into a turn's meta without inventing a parallel flag. */
function withAuthorship(
  meta: StoryTurnMeta,
  authorship?: StoryAuthorship,
): StoryTurnMeta {
  if (!authorship) return meta;
  const next: StoryTurnMeta = { ...meta };
  if (authorship.actor !== undefined) next.author = authorship.actor;
  if (authorship.via !== undefined) next.via = authorship.via;
  if (authorship.generatedBy !== undefined) next.generatedBy = authorship.generatedBy;
  return next;
}

/**
 * Derive origin EXPLICITLY from carried meta, never by absence alone:
 *   - `generatedBy` present            -> model
 *   - `role` is `"assistant"`          -> model (a conversation model turn)
 *   - `role` is `"user"`               -> human (a conversation person turn)
 *   - a person's `author` present      -> human
 *   - none of the above                -> unknown
 * The `role` rules read a CONVERSATION loom's origin from its explicit role,
 * not by absence — a story turn never carries `"user"`/`"assistant"`, so story
 * origins are unchanged. An unknowable turn reads "unknown", NEVER silent "human".
 */
function originFromMeta(meta: ReadableTurnMeta | undefined): StoryOrigin {
  if (meta?.generatedBy) return "model";
  if (meta?.role === "assistant") return "model";
  if (meta?.role === "user") return "human";
  // Imported archive actors identify durable writers, not a human/model
  // perspective. Domain presentation may expose that writer without guessing.
  if (meta?.role === "artifact" || meta?.role === "corpus") return "unknown";
  if (meta?.author) return "human";
  return "unknown";
}

export async function projectStoryTree(
  loom: ReadableLoom,
  fallbackRootText = "",
): Promise<{ root: StoryNode }> {
  const rootTurns = await loom.childrenOf(null);
  // Textile stories are single-root projections. Later top-level revision
  // turns edit the seed root's visible text without reparenting its children.
  const rootTurn = rootTurns.find((turn) => turn.meta?.role !== "revision");
  if (!rootTurn) {
    return {
      root: {
        id: "root",
        text: fallbackRootText,
        continuations: [],
        origin: "unknown",
      },
    };
  }

  const rootNode: StoryNode = turnToStoryNode(rootTurn);
  const sourceRecords: import("./rawLyncArchiveTypes").RawLyncSourceRecord[] = [];
  const rootRevisions = rootTurns.filter(
    (turn) => turn.meta?.role === "revision" && turn.meta.revises === rootTurn.id,
  );
  const latestRootRevision = rootRevisions.at(-1);
  if (latestRootRevision) {
    rootNode.text = deriveTurnText(latestRootRevision.payload);
  }

  const appendChildren = async (
    parent: StoryNode,
    parentTurn: ReadableTurn,
  ) => {
    // A turn's children are a MIX: real story continuations, plus the curation
    // turns (keep marks + annotations) that ride the loom's own event log. Peel
    // the curation turns off so they annotate `parent` instead of appearing as
    // story branches — the base-model story flow reads exactly as before.
    const children = await loom.childrenOf(parentTurn.id);
    const storyChildren: ReadableTurn[] = [];
    const annotations: StoryAnnotation[] = [];
    const markTurns: ReadableTurn[] = [];
    for (const child of children) {
      const role = child.meta?.role;
      if (role === "annotation") annotations.push(annotationFromTurn(child));
      else if (role === "mark") markTurns.push(child);
      else if (role === "raw-source" && child.meta?.rawSource === true) {
        const record = rawSourceRecordFromTurn(child);
        if (record) sourceRecords.push(record);
      }
      else storyChildren.push(child);
    }
    if (annotations.length) {
      const existing = parent.annotations ?? [];
      parent.annotations = [...existing, ...annotations.filter(
        (annotation) => !existing.some((candidate) => candidate.id === annotation.id),
      )];
    }
    // Append-only toggle: childrenOf returns marks in append order, so the LAST
    // mark is the newest — its kept state wins. Nothing is deleted.
    const latestMark = markTurns.at(-1);
    if (latestMark) {
      parent.kept = latestMark.meta?.kept === true;
      parent.keepMark = parent.kept
        ? {
            id: latestMark.id,
            createdAt: latestMark.createdAt,
            actor: latestMark.meta?.author,
            via: latestMark.meta?.via,
          }
        : undefined;
    }

    parent.continuations = storyChildren.map(turnToStoryNode);
    for (let index = 0; index < storyChildren.length; index += 1) {
      const childTurn = storyChildren[index];
      const child = parent.continuations[index];
      const revises = childTurn?.meta?.revises;
      if (!child || !revises || child.revisesSourceId || child.revisesPortableTurnId) continue;
      const revisedIndex = storyChildren.findIndex((candidate) => candidate.id === revises);
      const revised = parent.continuations[revisedIndex];
      if (revised?.sourceId) child.revisesSourceId = revised.sourceId;
      else if (revised && (revised.portableTurnId || rootTurn.meta?.sourceArchive)) {
        child.revisesPortableTurnId = portableIdentity(revised);
      }
    }
    for (let index = 0; index < storyChildren.length; index += 1) {
      const child = parent.continuations[index];
      const childTurn = storyChildren[index];
      if (child && childTurn) {
        await appendChildren(child, childTurn);
      }
    }
  };

  await appendChildren(rootNode, rootTurn);
  if (rootTurn.meta?.sourceArchive) {
    const records = [...sourceRecords].sort((a, b) => a.id.localeCompare(b.id));
    rootNode.sourceArchive = { ...rootTurn.meta.sourceArchive, records };
    const recordsById = new Map(records.map((record) => [record.id, record]));
    attachSourceEvents(rootNode, recordsById);
    attachCarriedNotes(rootNode, rootTurn.meta.sourceArchive.carriedCuration);
  }
  return { root: rootNode };
}

function attachCarriedNotes(
  root: StoryNode,
  events: import("./rawLyncArchiveTypes").RawLyncCarriedCurationEvent[],
): void {
  const nodes = new Map<string, StoryNode>();
  const collect = (node: StoryNode) => {
    if (node.sourceId) nodes.set(node.sourceId, node);
    for (const child of node.continuations ?? []) collect(child);
  };
  collect(root);
  for (const event of events) {
    if (event.payload.label !== "note" || typeof event.payload.text !== "string") continue;
    for (const target of event.parents) {
      const node = nodes.get(target);
      if (!node || node.annotations?.some((note) => note.id === event.id)) continue;
      node.annotations = [...(node.annotations ?? []), {
        id: event.id,
        text: event.payload.text,
        actor: event.author.actor,
        via: event.author.via,
        createdAt: Date.parse(event.at),
      }];
    }
  }
}

function rawSourceRecordFromTurn(
  turn: ReadableTurn,
): import("./rawLyncArchiveTypes").RawLyncSourceRecord | null {
  if (!turn.payload || typeof turn.payload !== "object") return null;
  const message = (turn.payload as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const record = message as Partial<import("./rawLyncArchiveTypes").StoredRawLyncSourceRecord>;
  if (
    typeof record.id !== "string" ||
    !Array.isArray(record.nonconformingReasons) ||
    typeof record.payloadState !== "string"
  ) return null;
  if (record.payloadState === "available") {
    if (typeof record.sourceLine !== "string") return null;
    let source: unknown;
    try {
      source = JSON.parse(record.sourceLine);
    } catch {
      return null;
    }
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
    const { payload, ...envelope } = source as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return {
      id: record.id,
      envelope,
      payload: payload as Record<string, unknown>,
      sourceLine: record.sourceLine,
      classification: record.classification ?? "accepted",
      nonconformingReasons: [...record.nonconformingReasons],
      payloadState: record.payloadState,
      withheldBy: [...(record.withheldBy ?? [])],
    };
  }
  if (!record.envelope || typeof record.envelope !== "object") return null;
  return {
    id: record.id,
    envelope: record.envelope,
    classification: record.classification ?? "accepted",
    nonconformingReasons: [...record.nonconformingReasons],
    payloadState: record.payloadState,
    withheldBy: [...(record.withheldBy ?? [])],
  };
}

function attachSourceEvents(
  node: StoryNode,
  records: Map<string, import("./rawLyncArchiveTypes").RawLyncSourceRecord>,
): void {
  if (node.sourceId) {
    const record = records.get(node.sourceId);
    if (record?.payloadState === "available" && record.payload) {
      node.sourceEvent = { ...record.envelope, payload: record.payload };
    }
  }
  for (const child of node.continuations ?? []) attachSourceEvents(child, records);
}

/** Fold a `role: "annotation"` turn into the note shape the reader surfaces. */
function annotationFromTurn(turn: ReadableTurn): StoryAnnotation {
  return {
    id: turn.id,
    text: deriveTurnText(turn.payload),
    actor: turn.meta?.author,
    via: turn.meta?.via,
    createdAt: turn.createdAt,
  };
}

export async function appendStoryDraftChain(
  loom: StoryLoom,
  parentId: string | null,
  draft: StoryDraft,
  meta: StoryTurnMeta = { role: "prose" },
  authorship?: StoryAuthorship,
): Promise<Turn<StoryTurnPayload, StoryTurnMeta>> {
  const appended = await loom.appendTurn(
    parentId,
    { text: draft.text },
    withAuthorship(meta, authorship),
  );
  for (const child of draft.continuations ?? []) {
    // A child of a model draft is part of the same generation, so the same
    // authorship (including generatedBy) rides down the whole chain.
    await appendStoryDraftChain(loom, appended.id, child, { role: "prose" }, authorship);
  }
  return appended;
}

export async function appendStoryRevision(
  loom: StoryLoom,
  parentId: string | null,
  revision: StoryDraft,
  revises?: string,
  authorship?: StoryAuthorship,
): Promise<Turn<StoryTurnPayload, StoryTurnMeta>> {
  if (parentId === null) {
    const appended = await loom.appendTurn(
      null,
      { text: revision.text },
      withAuthorship({ role: "revision", revises }, authorship),
    );
    if (revises) {
      for (const child of revision.continuations ?? []) {
        await appendStoryDraftChain(loom, revises, child, { role: "prose" }, authorship);
      }
    }
    return appended;
  }
  return appendStoryDraftChain(
    loom,
    parentId,
    revision,
    { role: "revision", revises },
    authorship,
  );
}

export async function appendStoryDrafts(
  loom: StoryLoom,
  parentId: string | null,
  drafts: StoryDraft[],
  authorship?: StoryAuthorship,
): Promise<void> {
  for (const draft of drafts) {
    await appendStoryDraftChain(loom, parentId, draft, { role: "prose" }, authorship);
  }
}

/**
 * KEEP (the swipe): record a kept/discarded state for `targetId` as a
 * `role: "mark"` turn — a child of the target in the loom's OWN event log, so
 * it survives reload and rides sync. Append-only: keeping then un-keeping is
 * two mark turns, and the fold takes the latest. Returns the appended turn.
 */
export async function appendKeepMark(
  loom: StoryLoom,
  targetId: string,
  kept: boolean,
  authorship?: StoryAuthorship,
): Promise<Turn<StoryTurnPayload, StoryTurnMeta>> {
  return loom.appendTurn(
    targetId,
    { text: "" },
    withAuthorship({ role: "mark", kept }, authorship),
  );
}

/**
 * ANNOTATE: attach a note to `targetId` as a `role: "annotation"` turn — a child
 * of the target in the loom's own event log. Append-only; every note is kept.
 * A blank note is rejected loudly rather than persisted as an empty annotation.
 */
export async function appendAnnotation(
  loom: StoryLoom,
  targetId: string,
  text: string,
  authorship?: StoryAuthorship,
): Promise<Turn<StoryTurnPayload, StoryTurnMeta>> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot save an empty annotation.");
  return loom.appendTurn(
    targetId,
    { text: trimmed },
    withAuthorship({ role: "annotation" }, authorship),
  );
}

function turnToStoryNode(turn: ReadableTurn): StoryNode {
  const meta = turn.meta;
  const payload = turn.payload as { message?: unknown } | null;
  const text = deriveTurnText(turn.payload);
  const sourceEvent = meta?.sourceEnvelope
    ? { ...meta.sourceEnvelope, payload: payload?.message }
    : undefined;
  return {
    id: turn.id,
    text,
    // Archive/portable artifacts need their source time for an honest reopen.
    // Keep legacy story projections byte-for-byte shaped as before.
    ...(meta?.archiveSource || meta?.portableTurnId ? { createdAt: turn.createdAt } : {}),
    continuations: [],
    origin: originFromMeta(meta),
    actor: meta?.author,
    via: meta?.via,
    generatedBy: meta?.generatedBy,
    turnRole: meta?.portableRole ?? (meta?.archiveSource ? meta.role : undefined),
    ...(meta?.archiveSource ? { archiveSource: meta.archiveSource } : {}),
    portableTurnId: meta?.portableTurnId,
    portableOriginLoomId: meta?.portableOriginLoomId,
    revisesSourceId: meta?.portableRevises?.kind === "source-event"
      ? meta.portableRevises.id
      : undefined,
    revisesPortableTurnId: meta?.portableRevises?.kind === "textile-turn"
      ? meta.portableRevises.id
      : undefined,
    kept: meta?.sourceSelected === true || meta?.portableKeep ? true : undefined,
    keepMark: meta?.portableKeep
      ? {
          id: meta.portableKeep.id,
          createdAt: Date.parse(meta.portableKeep.at),
          actor: meta.portableKeep.author.actor,
          via: meta.portableKeep.author.via,
        }
      : undefined,
    annotations: meta?.portableNotes?.map((note) => ({ ...note })),
    sourceId: meta?.sourceId,
    sourceKind: meta?.sourceKind,
    sourceParents: meta?.sourceParents,
    extraParentIds: meta?.extraParentIds,
    rawTags: meta?.rawTags,
    sourceWarnings: meta?.sourceWarnings,
    sourcePresentation: meta?.sourcePresentation,
    sourcePresentationContract: meta?.sourcePresentationContract,
    sourcePresentationSource: meta?.sourcePresentationSource,
    sourcePresentationSections: meta?.sourcePresentationSections?.map((section) =>
      "sameAsTurnText" in section && section.sameAsTurnText
        ? { role: section.role, text, sourcePaths: [...section.sourcePaths] }
        : section
    ),
    sourcePresentationDiagnostics: meta?.sourcePresentationDiagnostics,
    sourceLoomProfile: meta?.sourceLoomProfile,
    sourceLocator: meta?.sourceLocator,
    sourceEvent,
  };
}

function portableIdentity(node: StoryNode): string {
  return node.portableTurnId ?? node.id;
}
