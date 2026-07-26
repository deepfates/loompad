import type { StoryAnnotation, StoryNode } from "../types";
import type {
  RawLyncCarriedCurationEvent,
  RawLyncCarriedKeep,
  RawLyncPayloadState,
  RawLyncPortableLocalTurn,
  RawLyncSourceArchive,
  RawLyncSourceRecord,
} from "../lync/rawLyncArchiveTypes";
import type {
  RawLyncPresentationDiagnostic,
  RawLyncPresentationSection,
} from "../lync/rawLyncPresentationTypes";

const hasWindow = typeof window !== "undefined";

const sanitizeForFilename = (name: string): string => {
  const fallback = "story";
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  return trimmed
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
};

const triggerDownload = (filename: string, data: string, mimeType: string) => {
  if (!hasWindow) {
    console.warn("Download attempted in a non-browser environment.");
    return;
  }

  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const resolvePrimaryPath = (root: StoryNode): StoryNode[] => {
  const path: StoryNode[] = [];
  let current: StoryNode | undefined = root;

  while (current) {
    path.push(current);
    const continuations = current.continuations ?? [];
    if (!continuations.length) {
      break;
    }

    current = continuations[0];
  }

  return path;
};

export const downloadStoryTreeJson = (
  key: string,
  tree: { root: StoryNode },
): string => {
  const payload = {
    schemaVersion: 1,
    title: key,
    exportedAt: new Date().toISOString(),
    tree: tree.root,
  };

  const filename = `${sanitizeForFilename(key)}-tree.json`;
  const json = JSON.stringify(payload, null, 2);
  triggerDownload(filename, json, "application/json");
  return filename;
};

export const downloadStoryThreadText = (
  key: string,
  path: StoryNode[],
): string => {
  const segments = path
    .map((node) => node.text?.trim())
    .filter((text): text is string => Boolean(text && text.length));
  const content = segments.join("\n\n");
  const filename = `${sanitizeForFilename(key)}-thread.txt`;
  triggerDownload(filename, content, "text/plain");
  return filename;
};

export const getStoryPrimaryPath = (tree: { root: StoryNode }): StoryNode[] =>
  resolvePrimaryPath(tree.root);

/**
 * A single kept turn in the curated export: its own text/origin, the notes the
 * person attached, and the full thread of ancestor text leading to it — so the
 * export is a usable training record, not a bare line out of context.
 */
export interface KeptStoryEntry {
  id: string;
  text: string;
  origin: StoryNode["origin"];
  actor?: string;
  via?: string;
  annotations: StoryAnnotation[];
  thread: Array<{ id: string; text: string; origin: StoryNode["origin"] }>;
}

/**
 * Walk the tree in pre-order and collect every KEPT node (the curated set). The
 * person's swipe (`node.kept === true`) is the only filter; each entry carries
 * its annotations and its root→node thread. Pure — the export path and the
 * tests both call this, so the curated set is defined in ONE place.
 */
export const collectKeptEntries = (root: StoryNode): KeptStoryEntry[] => {
  const entries: KeptStoryEntry[] = [];
  const walk = (node: StoryNode, ancestors: StoryNode[]) => {
    const thread = [...ancestors, node];
    if (node.kept === true) {
      entries.push({
        id: node.id,
        text: node.text,
        origin: node.origin,
        actor: node.actor,
        via: node.via,
        annotations: node.annotations ?? [],
        thread: thread.map((n) => ({ id: n.id, text: n.text, origin: n.origin })),
      });
    }
    for (const child of node.continuations ?? []) walk(child, thread);
  };
  walk(root, []);
  return entries;
};

/** Build the curated-export payload (kept turns + annotations). Pure/testable. */
export const buildKeptStoryExport = (
  key: string,
  tree: { root: StoryNode },
) => ({
  schemaVersion: 1 as const,
  kind: "curated" as const,
  title: key,
  exportedAt: new Date().toISOString(),
  kept: collectKeptEntries(tree.root),
});

/**
 * EXPORT CURATED: download only the KEPT turns (with their annotations) — the
 * curated training set. Reuses the same download path as the other exports. If
 * nothing is kept the caller is told (NOTHING-SILENT); here we still emit an
 * empty curated file so an accidental empty export is visible, not silent.
 */
export const downloadKeptStoryJson = (
  key: string,
  tree: { root: StoryNode },
): string => {
  const payload = buildKeptStoryExport(key, tree);
  const filename = `${sanitizeForFilename(key)}-kept.json`;
  triggerDownload(filename, JSON.stringify(payload, null, 2), "application/json");
  return filename;
};

interface RawLyncAnnotationEvent {
  v: 1;
  id: string;
  kind: "lync/annotation";
  at: string;
  author: { actor: string; via?: string };
  parents: string[];
}

export interface RawLyncSelectionEvent extends RawLyncAnnotationEvent {
  payload: {
    label: "selection";
    chosen: string[];
    shown: string[];
    basis: "human pick";
  };
}

export interface RawLyncNoteEvent extends RawLyncAnnotationEvent {
  payload: {
    label: "note";
    text: string;
  };
}

export type RawLyncCurationEvent = RawLyncSelectionEvent | RawLyncNoteEvent;

/** True when a tree is Textile's projection of protocol-level source events. */
export const hasRawLyncSources = (root: StoryNode): boolean => {
  if (root.sourceId) return true;
  return (root.continuations ?? []).some(hasRawLyncSources);
};

/**
 * Export NEW positive keep marks as standard Lync selection annotations.
 * Imported selections have `kept` but no `keepMark`, so they are not duplicated.
 * `shown` is the set of source siblings visible at that navigation decision.
 */
export const buildRawLyncSelectionEvents = (
  tree: { root: StoryNode },
): RawLyncSelectionEvent[] => {
  const result: RawLyncSelectionEvent[] = [];
  const walk = (node: StoryNode, siblings: StoryNode[]) => {
    if (node.sourceId && node.kept === true && node.keepMark) {
      const shown = siblings.flatMap((sibling) => sibling.sourceId ?? []);
      const comparison = shown.length > 0 ? shown : [node.sourceId];
      result.push({
        v: 1,
        id: node.keepMark.id,
        kind: "lync/annotation",
        at: new Date(node.keepMark.createdAt).toISOString(),
        author: {
          actor: node.keepMark.actor ?? "textile-user",
          ...(node.keepMark.via ? { via: node.keepMark.via } : {}),
        },
        parents: comparison,
        payload: {
          label: "selection",
          chosen: [node.sourceId],
          shown: comparison,
          basis: "human pick",
        },
      });
    }
    const children = node.continuations ?? [];
    for (const child of children) walk(child, children);
  };
  walk(tree.root, [tree.root]);
  return result;
};

/**
 * Export human notes as protocol annotations on the exact source events they
 * describe. The note turn's id/time/author are retained, while its parent is
 * translated from Textile's imported turn id back to the portable source id.
 */
export const buildRawLyncNoteEvents = (
  tree: { root: StoryNode },
): RawLyncNoteEvent[] => {
  const result: RawLyncNoteEvent[] = [];
  const walk = (node: StoryNode) => {
    if (node.sourceId) {
      for (const note of node.annotations ?? []) {
        result.push({
          v: 1,
          id: note.id,
          kind: "lync/annotation",
          at: new Date(note.createdAt).toISOString(),
          author: {
            actor: note.actor ?? "unknown",
            ...(note.via ? { via: note.via } : {}),
          },
          parents: [node.sourceId],
          payload: { label: "note", text: note.text },
        });
      }
    }
    for (const child of node.continuations ?? []) walk(child);
  };
  walk(tree.root);
  return result;
};

/** Portable raw-corpus curation patch: selections plus human-authored notes. */
export const buildRawLyncCurationEvents = (
  tree: { root: StoryNode },
): RawLyncCurationEvent[] => [
  ...buildRawLyncSelectionEvents(tree),
  ...buildRawLyncNoteEvents(tree),
];

/** Download raw-corpus keeps and notes as newline-delimited Lync events. */
export const downloadRawLyncCuration = (
  key: string,
  tree: { root: StoryNode },
): string => {
  const events = buildRawLyncCurationEvents(tree);
  const body = events.map((event) => JSON.stringify(event)).join("\n");
  const filename = `${sanitizeForFilename(key)}-curation.lync`;
  triggerDownload(
    filename,
    body ? `${body}\n` : "",
    "application/x-lync+jsonl",
  );
  return filename;
};

/** @deprecated Use downloadRawLyncCuration. */
export const downloadRawLyncSelections = downloadRawLyncCuration;

export interface KeptContextParentRef {
  id: string;
  index: number;
  role: "first-parent" | "additional-parent";
  resolved: boolean;
}

export interface KeptContextPresentation {
  kind: "content" | "structure";
  contract: string;
  text: string;
  sections: RawLyncPresentationSection[];
  diagnostics: RawLyncPresentationDiagnostic[];
}

export interface KeptContextEventRecord {
  id: string;
  parentRefs: KeptContextParentRef[];
  envelope: Record<string, unknown>;
  payloadState: RawLyncPayloadState;
  payload?: Record<string, unknown>;
  sourceLine?: string;
  classification: "accepted" | "nonconforming";
  nonconformingReasons: string[];
  withheldBy: string[];
  presentation: KeptContextPresentation;
}

export interface KeptContextTarget {
  sourceId: string;
  keepEvent?: {
    id: string;
    at: string;
    author: { actor: string; via?: string };
  };
  sourceSelectionIds: string[];
  notes: Array<{
    id: string;
    at: string;
    author: { actor: string; via?: string };
    text: string;
  }>;
}

export interface KeptContextLocalTarget {
  turnId: string;
  originLoomId: string;
  contextPath: Array<{
    kind: "source-event" | "textile-turn";
    id: string;
  }>;
}

export interface KeptContextObstacle {
  class: "cycle" | "dangling" | "unavailable-due-to-conflict" | "archive-incomplete";
  target?: string;
  ids?: string[];
  missing?: string;
  id?: string;
  detail?: string;
}

export interface KeptContextManifest {
  schemaVersion: 1;
  kind: "textile/kept-context";
  title: string;
  storyIdentity: {
    /** Textile loom whose visible Stories row initiated this export. */
    loomId: string | null;
    /** Root turn rendered for that same loom at the action boundary. */
    rootTurnId: string;
    /** Complete source set visible in that immutable projection. */
    visibleSourceEventIds: string[];
    /** Policy-aware causal source set actually carried by this artifact. */
    exportedSourceEventIds: string[];
  };
  semantics: {
    keptTargets: "explicit-positive-keeps";
    context: "all-parent-causal-downset";
    localContext: "textile-parent-chain-plus-source-downset";
    readingPath: "first-parent";
    comparisonSiblings: "curation-only";
    actorRoles: "not-inferred";
  };
  keptTargets: KeptContextTarget[];
  localKeptTargets: KeptContextLocalTarget[];
  localTurns: RawLyncPortableLocalTurn[];
  targetDownsets: Array<{ target: string; ids: string[] }>;
  firstParentPaths: Array<{ target: string; ids: string[] }>;
  eventOrder: string[];
  events: KeptContextEventRecord[];
  policyEvents: KeptContextEventRecord[];
  curationPatch: RawLyncCarriedCurationEvent[];
  comparisonOnlyReferences: string[];
  dropReport: Array<{
    eventId: string;
    category: Exclude<RawLyncPayloadState, "available">;
    by: string[];
    effect: "payload-withheld";
  }>;
  partial: boolean;
  obstacles: KeptContextObstacle[];
}

export interface KeptContextArtifact {
  filename: string;
  markdown: string;
  manifest: KeptContextManifest;
}

export interface KeptContextStoryIdentity {
  loomId: string;
  rootTurnId: string;
  visibleSourceEventIds: string[];
}

const KEPT_MANIFEST_START = "<!-- textile-kept-manifest:v1";
const KEPT_MANIFEST_END = "textile-kept-manifest:end -->";

/** Build the deterministic, self-contained raw-Lync kept artifact. */
export function buildRawLyncKeptContextArtifact(
  key: string,
  tree: { root: StoryNode },
  identity?: KeptContextStoryIdentity,
): KeptContextArtifact {
  const nodesBySource = sourceNodes(tree.root);
  const fallback = tree.root.sourceArchive
    ? null
    : fallbackArchive(tree.root, nodesBySource);
  const archive = policySafeArchive(tree.root.sourceArchive ?? fallback!.archive);
  const recordsById = new Map(archive.records.map((record) => [record.id, record]));
  const currentCuration = buildRawLyncCurationEvents(tree);
  const allCuration = dedupeCuration([
    ...archive.carriedCuration,
    ...archiveCurationEvents(archive.records),
    ...currentCuration,
  ]);
  const keptNodes = [...nodesBySource.values()]
    .filter((node) => node.kept === true)
    .sort((a, b) => a.sourceId!.localeCompare(b.sourceId!));
  const treeEntries = indexStoryTree(tree.root);
  const keptLocalEntries = treeEntries
    .filter(({ node }) => !node.sourceId && node.kept === true)
    .sort((a, b) => portableTurnId(a.node).localeCompare(portableTurnId(b.node)));

  const obstacles: KeptContextObstacle[] = [...(fallback?.obstacles ?? [])];
  const sourceDownsets = keptNodes.map((node) => {
    const sourceId = node.sourceId!;
    const downset = causalDownset(sourceId, recordsById);
    obstacles.push(...downset.obstacles.map((obstacle) => ({ ...obstacle, target: sourceId })));
    return { target: sourceId, ids: downset.ids };
  });
  const localContexts = keptLocalEntries.map((entry) => {
    const target = portableTurnId(entry.node);
    const revisedLocal = entry.node.revisesPortableTurnId
      ? entryForPortableId(treeEntries, entry.node.revisesPortableTurnId)
      : undefined;
    const contextPath = uniqueStoryNodes([
      ...(revisedLocal?.path ?? entry.path.slice(0, -1)),
      ...(revisedLocal ? [revisedLocal.node] : []),
      entry.node,
    ]);
    const sourceAnchors = contextPath
      .flatMap((node) => node.sourceId ?? [])
      .concat(entry.node.revisesSourceId ?? [])
      .filter((id, index, ids) => ids.indexOf(id) === index);
    const ids = new Set<string>();
    for (const sourceId of sourceAnchors) {
      const downset = causalDownset(sourceId, recordsById);
      for (const id of downset.ids) ids.add(id);
      obstacles.push(...downset.obstacles.map((obstacle) => ({ ...obstacle, target })));
    }
    return {
      target,
      path: contextPath,
      sourceIds: causalOrder(ids, recordsById),
    };
  });
  const downsets = [
    ...sourceDownsets,
    ...localContexts.map((context) => ({
      target: context.target,
      ids: context.sourceIds,
    })),
  ];
  const included = new Set(downsets.flatMap((downset) => downset.ids));
  const includedLocalIds = new Set(
    localContexts.flatMap((context) => context.path
      .filter((node) => !node.sourceId && node !== tree.root)
      .map(portableTurnId)),
  );
  for (const entry of keptLocalEntries) includedLocalIds.add(portableTurnId(entry.node));
  const localTurns = treeEntries
    .filter(({ node }) => includedLocalIds.has(portableTurnId(node)))
    .map((entry) => portableLocalTurnFor(entry, identity?.loomId ?? "unknown"));
  const keptIds = new Set(keptNodes.map((node) => node.sourceId!));
  const curationPatch = allCuration.filter((event) =>
    curationTouchesContext(event, included, keptIds),
  );
  const keptTargets = keptNodes.map((node) =>
    keptTargetFor(node, archive, curationPatch),
  );
  const localKeptTargets = localContexts.map((context) => {
    const target = localTurns.find((turn) => turn.turnId === context.target)!;
    return {
      turnId: target.turnId,
      originLoomId: target.originLoomId,
      contextPath: uniqueContextRefs(context.path.flatMap((node) => {
        const revisionRef = node === entryForPortableId(keptLocalEntries, context.target)?.node
          ? node.revisesSourceId
            ? [{ kind: "source-event" as const, id: node.revisesSourceId }]
            : node.revisesPortableTurnId
              ? [{ kind: "textile-turn" as const, id: node.revisesPortableTurnId }]
              : []
          : [];
        if (node.sourceId) return [{ kind: "source-event" as const, id: node.sourceId }];
        const id = portableTurnId(node);
        return includedLocalIds.has(id)
          ? [...revisionRef, { kind: "textile-turn" as const, id }]
          : revisionRef;
      })),
    };
  });
  const eventOrder = causalOrder(included, recordsById);
  const firstParentPaths = keptTargets.map(({ sourceId }) => ({
    target: sourceId,
    ids: firstParentPath(sourceId, recordsById),
  }));
  const events = eventOrder.flatMap((id) => {
    const record = recordsById.get(id);
    return record ? [manifestEvent(record, nodesBySource, included)] : [];
  });
  const policyIds = new Set(
    events.flatMap((record) => record.withheldBy).filter((id) => !included.has(id)),
  );
  const policyEvents = [...policyIds]
    .sort()
    .flatMap((id) => {
      const record = recordsById.get(id);
      return record ? [manifestEvent(record, nodesBySource, policyIds)] : [];
    });
  for (const policyId of policyIds) {
    if (!recordsById.has(policyId)) {
      obstacles.push({
        class: "archive-incomplete",
        id: policyId,
        detail: "A policy event referenced by the drop report is absent from the source archive.",
      });
    }
  }
  const comparisonOnlyReferences = comparisonOnlyIds(curationPatch, included);
  const dropReport = events
    .filter((record) => record.payloadState !== "available")
    .map((record) => ({
      eventId: record.id,
      category: record.payloadState as Exclude<RawLyncPayloadState, "available">,
      by: record.withheldBy,
      effect: "payload-withheld" as const,
    }));
  const normalizedObstacles = uniqueObstacles([
    ...archive.obstacles,
    ...obstacles,
  ]);
  const manifest: KeptContextManifest = {
    schemaVersion: 1,
    kind: "textile/kept-context",
    title: key,
    storyIdentity: {
      loomId: identity?.loomId ?? null,
      rootTurnId: identity?.rootTurnId ?? tree.root.id,
      visibleSourceEventIds: identity?.visibleSourceEventIds ?? [...nodesBySource.keys()].sort(),
      exportedSourceEventIds: [...eventOrder],
    },
    semantics: {
      keptTargets: "explicit-positive-keeps",
      context: "all-parent-causal-downset",
      localContext: "textile-parent-chain-plus-source-downset",
      readingPath: "first-parent",
      comparisonSiblings: "curation-only",
      actorRoles: "not-inferred",
    },
    keptTargets,
    localKeptTargets,
    localTurns,
    targetDownsets: downsets,
    firstParentPaths,
    eventOrder,
    events,
    policyEvents,
    curationPatch,
    comparisonOnlyReferences,
    dropReport,
    partial: archive.partial || normalizedObstacles.length > 0 || dropReport.length > 0,
    obstacles: normalizedObstacles,
  };
  const filename = `${sanitizeForFilename(key)}-kept-context.md`;
  return { filename, manifest, markdown: renderKeptContextMarkdown(manifest) };
}

export function downloadRawLyncKeptContext(
  key: string,
  tree: { root: StoryNode },
  identity?: KeptContextStoryIdentity,
): KeptContextArtifact {
  const artifact = buildRawLyncKeptContextArtifact(key, tree, identity);
  triggerDownload(artifact.filename, artifact.markdown, "text/markdown");
  return artifact;
}

/** Parse the hidden machine manifest embedded in a kept-context Markdown file. */
export function parseKeptContextMarkdown(text: string): KeptContextManifest {
  const start = text.lastIndexOf(KEPT_MANIFEST_START);
  const end = text.lastIndexOf(KEPT_MANIFEST_END);
  if (start < 0 || end <= start) {
    throw new Error("Not a Textile kept-context Markdown artifact: machine manifest missing.");
  }
  const encoded = text
    .slice(start + KEPT_MANIFEST_START.length, end)
    .replace(/\s+/g, "");
  let raw: unknown;
  try {
    raw = JSON.parse(decodeBase64(encoded));
  } catch (error) {
    throw new Error(
      `Not a Textile kept-context Markdown artifact: invalid machine manifest (${error instanceof Error ? error.message : String(error)}).`,
    );
  }
  if (!raw || typeof raw !== "object") {
    throw new Error("Not a Textile kept-context Markdown artifact: manifest must be an object.");
  }
  const manifest = raw as Partial<KeptContextManifest>;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.kind !== "textile/kept-context" ||
    !Array.isArray(manifest.events) ||
    !Array.isArray(manifest.keptTargets)
  ) {
    throw new Error("Not a Textile kept-context Markdown artifact: unsupported manifest shape.");
  }
  return {
    ...(manifest as KeptContextManifest),
    localKeptTargets: Array.isArray(manifest.localKeptTargets)
      ? manifest.localKeptTargets
      : [],
    localTurns: Array.isArray(manifest.localTurns) ? manifest.localTurns : [],
  };
}

/** Recover importable source lines without inventing withheld payloads. */
export function keptContextImportSource(manifest: KeptContextManifest): {
  text: string;
  selectedSourceIds: string[];
  carriedCuration: RawLyncCarriedCurationEvent[];
  carriedKeeps: RawLyncCarriedKeep[];
  carriedLocalTurns: RawLyncPortableLocalTurn[];
} {
  const withheld = manifest.events.filter((event) => event.payloadState !== "available");
  if (withheld.length > 0) {
    throw new Error(
      `Kept context cannot be reopened as source: ${withheld.length} payload${withheld.length === 1 ? " is" : "s are"} intentionally withheld (${withheld.map((event) => event.id).join(", ")}).`,
    );
  }
  const byId = new Map(manifest.events.map((event) => [event.id, event]));
  const lines = manifest.eventOrder.map((id) => {
    const event = byId.get(id);
    if (!event) throw new Error(`Kept context source event ${id} is missing.`);
    if (event.sourceLine) return event.sourceLine;
    if (!event.payload) throw new Error(`Kept context source event ${id} has no payload.`);
    return JSON.stringify({ ...event.envelope, payload: event.payload });
  });
  return {
    text: lines.length ? `${lines.join("\n")}\n` : "",
    selectedSourceIds: manifest.keptTargets.map((target) => target.sourceId),
    carriedCuration: manifest.curationPatch,
    carriedKeeps: manifest.keptTargets.map((target) => ({
      sourceId: target.sourceId,
      keepEvent: target.keepEvent,
      sourceSelectionIds: target.sourceSelectionIds,
    })),
    carriedLocalTurns: manifest.localTurns,
  };
}

function sourceNodes(root: StoryNode): Map<string, StoryNode> {
  const result = new Map<string, StoryNode>();
  const walk = (node: StoryNode) => {
    if (node.sourceId) result.set(node.sourceId, node);
    for (const child of node.continuations ?? []) walk(child);
  };
  walk(root);
  return result;
}

interface IndexedStoryNode {
  node: StoryNode;
  path: StoryNode[];
}

function indexStoryTree(root: StoryNode): IndexedStoryNode[] {
  const result: IndexedStoryNode[] = [];
  const walk = (node: StoryNode, path: StoryNode[]) => {
    const nextPath = [...path, node];
    result.push({ node, path: nextPath });
    for (const child of node.continuations ?? []) walk(child, nextPath);
  };
  walk(root, []);
  return result;
}

function portableTurnId(node: StoryNode): string {
  return node.portableTurnId ?? node.id;
}

function entryForPortableId(
  entries: IndexedStoryNode[],
  id: string,
): IndexedStoryNode | undefined {
  return entries.find((entry) => portableTurnId(entry.node) === id);
}

function uniqueContextRefs(
  refs: Array<{ kind: "source-event" | "textile-turn"; id: string }>,
): Array<{ kind: "source-event" | "textile-turn"; id: string }> {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueStoryNodes(nodes: StoryNode[]): StoryNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    const key = node.sourceId
      ? `source:${node.sourceId}`
      : `turn:${portableTurnId(node)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function portableLocalTurnFor(
  entry: IndexedStoryNode,
  fallbackLoomId: string,
): RawLyncPortableLocalTurn {
  const node = entry.node;
  const parentNode = entry.path.at(-2);
  const parent = parentNode
    ? parentNode.sourceId
      ? { kind: "source-event" as const, id: parentNode.sourceId }
      : entry.path.length > 2
        ? { kind: "textile-turn" as const, id: portableTurnId(parentNode) }
        : null
    : null;
  const keepEvent = node.keepMark
    ? {
        id: node.keepMark.id,
        at: new Date(node.keepMark.createdAt).toISOString(),
        author: {
          actor: node.keepMark.actor ?? "textile-user",
          ...(node.keepMark.via ? { via: node.keepMark.via } : {}),
        },
      }
    : undefined;
  return {
    turnId: portableTurnId(node),
    originLoomId: node.portableOriginLoomId ?? fallbackLoomId,
    parent,
    text: node.text,
    ...(node.turnRole || node.revisesSourceId || node.revisesPortableTurnId
      ? { role: node.turnRole ?? "revision" }
      : {}),
    ...(node.revisesSourceId
      ? { revisesRef: { kind: "source-event" as const, id: node.revisesSourceId } }
      : node.revisesPortableTurnId
        ? { revisesRef: { kind: "textile-turn" as const, id: node.revisesPortableTurnId } }
        : {}),
    ...(node.actor ? { actor: node.actor } : {}),
    ...(node.via ? { via: node.via } : {}),
    ...(node.generatedBy ? { generatedBy: node.generatedBy } : {}),
    ...(keepEvent ? { keepEvent } : {}),
    notes: [...(node.annotations ?? [])]
      .map((note) => ({ ...note }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function fallbackArchive(
  root: StoryNode,
  nodes: Map<string, StoryNode>,
): { archive: RawLyncSourceArchive; obstacles: KeptContextObstacle[] } {
  const records: RawLyncSourceRecord[] = [];
  for (const [id, node] of nodes) {
    if (!node.sourceEvent) continue;
    const { payload, ...envelope } = node.sourceEvent;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const critical = node.sourceEvent.critical === true;
    records.push({
      id,
      envelope,
      ...(!critical ? {
        payload: payload as Record<string, unknown>,
        sourceLine: JSON.stringify(node.sourceEvent),
      } : {}),
      classification: "accepted",
      nonconformingReasons: [],
      payloadState: critical ? "critical-policy" : "available",
      withheldBy: critical ? [id] : [],
    });
  }
  return {
    archive: {
      schemaVersion: 1,
      sourceName: root.text,
      partial: true,
      obstacles: [],
      suppressedPayloadIds: [],
      noTrainTargetIds: [],
      policyEventIds: [],
      carriedCuration: [],
      carriedKeeps: [],
      diagnostics: [],
      records: records.sort((a, b) => a.id.localeCompare(b.id)),
    },
    obstacles: [{
      class: "archive-incomplete",
      detail: "This older import did not carry a complete source archive; unsupported ancestors may be absent.",
    }],
  };
}

/** Re-apply policy at export time so legacy or hostile archive metadata cannot leak a body. */
function policySafeArchive(archive: RawLyncSourceArchive): RawLyncSourceArchive {
  const suppressed = new Set(archive.suppressedPayloadIds);
  const noTrain = new Set(archive.noTrainTargetIds);
  return {
    ...archive,
    records: archive.records.map((record) => {
      const criticalPolicy = record.envelope.critical === true;
      const noTrainPolicy =
        record.envelope.kind === "lync/annotation" && record.payload?.label === "no-train";
      const suppressedTarget = suppressed.has(record.id);
      const noTrainTarget = noTrain.has(record.id);
      let payloadState = record.payloadState;
      if (criticalPolicy) payloadState = "critical-policy";
      else if (noTrainPolicy) payloadState = "no-train-policy";
      else if (suppressedTarget && noTrainTarget) {
        payloadState = "critical-suppressed-and-no-train";
      } else if (suppressedTarget) payloadState = "critical-suppressed";
      else if (noTrainTarget) payloadState = "no-train";
      const withheld = payloadState !== "available";
      return {
        ...record,
        payloadState,
        ...(withheld ? { payload: undefined, sourceLine: undefined } : {}),
        withheldBy: [...new Set([
          ...record.withheldBy,
          ...(criticalPolicy || noTrainPolicy ? [record.id] : []),
        ])].sort(),
      };
    }),
  };
}

function keptTargetFor(
  node: StoryNode,
  archive: RawLyncSourceArchive,
  curation: RawLyncCarriedCurationEvent[],
): KeptContextTarget {
  const sourceId = node.sourceId!;
  const carried = archive.carriedKeeps.find((entry) => entry.sourceId === sourceId);
  const keepEvent = node.keepMark
    ? {
        id: node.keepMark.id,
        at: new Date(node.keepMark.createdAt).toISOString(),
        author: {
          actor: node.keepMark.actor ?? "textile-user",
          ...(node.keepMark.via ? { via: node.keepMark.via } : {}),
        },
      }
    : carried?.keepEvent;
  const sourceSelectionIds = new Set(carried?.sourceSelectionIds ?? []);
  for (const event of curation) {
    if (
      event.payload.label === "selection" &&
      event.id !== keepEvent?.id &&
      Array.isArray(event.payload.chosen) &&
      event.payload.chosen.includes(sourceId)
    ) sourceSelectionIds.add(event.id);
  }
  const notes = curation
    .filter((event) => event.payload.label === "note" && event.parents.includes(sourceId))
    .map((event) => ({
      id: event.id,
      at: event.at,
      author: event.author,
      text: typeof event.payload.text === "string" ? event.payload.text : "",
    }))
    .filter((note) => note.text.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    sourceId,
    ...(keepEvent ? { keepEvent } : {}),
    sourceSelectionIds: [...sourceSelectionIds].sort(),
    notes,
  };
}

function archiveCurationEvents(
  records: RawLyncSourceRecord[],
): RawLyncCarriedCurationEvent[] {
  return records.flatMap((record) => {
    if (
      record.payloadState !== "available" ||
      record.envelope.kind !== "lync/annotation" ||
      !record.payload
    ) return [];
    return [{
      ...record.envelope,
      payload: { ...record.payload },
    } as unknown as RawLyncCarriedCurationEvent];
  });
}

function curationTouchesContext(
  event: RawLyncCarriedCurationEvent,
  included: Set<string>,
  kept: Set<string>,
): boolean {
  if (event.parents.some((id) => included.has(id))) return true;
  const chosen = event.payload.chosen;
  return Array.isArray(chosen) && chosen.some(
    (id) => typeof id === "string" && kept.has(id),
  );
}

function causalDownset(
  target: string,
  records: Map<string, RawLyncSourceRecord>,
): { ids: string[]; obstacles: KeptContextObstacle[] } {
  const ids = new Set<string>();
  const obstacles: KeptContextObstacle[] = [];
  const stack: Array<{ id: string; path: string[] }> = [{ id: target, path: [] }];
  const expanded = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    const record = records.get(current.id);
    if (!record) {
      obstacles.push({ class: "dangling", missing: current.id });
      continue;
    }
    ids.add(current.id);
    if (current.path.includes(current.id)) {
      obstacles.push({
        class: "cycle",
        ids: current.path.slice(current.path.indexOf(current.id)),
      });
      continue;
    }
    if (expanded.has(current.id)) continue;
    expanded.add(current.id);
    for (const parent of eventParents(record)) {
      stack.push({ id: parent, path: [...current.path, current.id] });
    }
  }
  return {
    ids: causalOrder(ids, records),
    obstacles: uniqueObstacles(obstacles),
  };
}

function causalOrder(
  ids: Set<string>,
  records: Map<string, RawLyncSourceRecord>,
): string[] {
  const indegree = new Map([...ids].map((id) => [id, 0]));
  const children = new Map<string, string[]>();
  for (const id of ids) {
    for (const parent of eventParents(records.get(id)).filter((parent) => ids.has(parent))) {
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
      const bucket = children.get(parent) ?? [];
      bucket.push(id);
      children.set(parent, bucket);
    }
  }
  const ready = [...ids].filter((id) => indegree.get(id) === 0).sort();
  const result: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    result.push(id);
    for (const child of (children.get(id) ?? []).sort()) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) {
        ready.push(child);
        ready.sort();
      }
    }
  }
  for (const id of [...ids].sort()) if (!result.includes(id)) result.push(id);
  return result;
}

function firstParentPath(
  target: string,
  records: Map<string, RawLyncSourceRecord>,
): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let id: string | undefined = target;
  while (id && !seen.has(id)) {
    seen.add(id);
    const record = records.get(id);
    if (!record) break;
    path.push(id);
    id = eventParents(record)[0];
  }
  return path.reverse();
}

function eventParents(record: RawLyncSourceRecord | undefined): string[] {
  const parents = record?.envelope.parents;
  return Array.isArray(parents)
    ? parents.filter((parent): parent is string => typeof parent === "string")
    : [];
}

function manifestEvent(
  record: RawLyncSourceRecord,
  nodes: Map<string, StoryNode>,
  resolvedIds: Set<string>,
): KeptContextEventRecord {
  const node = nodes.get(record.id);
  const kind = typeof record.envelope.kind === "string"
    ? record.envelope.kind
    : "unknown";
  let presentation: KeptContextPresentation;
  if (record.payloadState !== "available") {
    presentation = {
      kind: "structure",
      contract: "lync/policy-withheld",
      text: `Payload withheld (${record.payloadState}).`,
      sections: [],
      diagnostics: record.withheldBy.map((id) => ({
        code: record.payloadState,
        sourcePath: `policy-event:${id}`,
      })),
    };
  } else if (node) {
    presentation = {
      kind: node.sourcePresentation ?? "content",
      contract: node.sourcePresentationContract ?? "textile/imported-presentation",
      text: node.text,
      sections: node.sourcePresentationSections ?? [],
      diagnostics: node.sourcePresentationDiagnostics ?? [],
    };
  } else {
    presentation = {
      kind: "structure",
      contract: "textile/unsupported-source",
      text: `Unsupported source kind ${kind}; payload is preserved in the machine manifest without recursive text guessing.`,
      sections: [],
      diagnostics: [{ code: "unsupported_source_kind", sourcePath: "payload" }],
    };
  }
  return {
    id: record.id,
    parentRefs: eventParents(record).map((id, index) => ({
      id,
      index,
      role: index === 0 ? "first-parent" : "additional-parent",
      resolved: resolvedIds.has(id),
    })),
    envelope: record.envelope,
    payloadState: record.payloadState,
    ...(record.sourceLine
      ? { sourceLine: record.sourceLine }
      : record.payload
        ? { payload: record.payload }
        : {}),
    classification: record.classification,
    nonconformingReasons: record.nonconformingReasons,
    withheldBy: record.withheldBy,
    presentation,
  };
}

function dedupeCuration(
  events: Array<RawLyncCarriedCurationEvent | RawLyncCurationEvent>,
): RawLyncCarriedCurationEvent[] {
  const byId = new Map<string, RawLyncCarriedCurationEvent>();
  for (const event of events) {
    byId.set(event.id, {
      ...event,
      payload: { ...event.payload },
    });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function comparisonOnlyIds(
  events: RawLyncCarriedCurationEvent[],
  included: Set<string>,
): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    const shown = event.payload.shown;
    if (!Array.isArray(shown)) continue;
    for (const id of shown) {
      if (typeof id === "string" && !included.has(id)) ids.add(id);
    }
  }
  return [...ids].sort();
}

function uniqueObstacles(
  obstacles: KeptContextObstacle[],
): KeptContextObstacle[] {
  const byKey = new Map<string, KeptContextObstacle>();
  for (const obstacle of obstacles) byKey.set(JSON.stringify(obstacle), obstacle);
  return [...byKey.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function renderKeptContextMarkdown(manifest: KeptContextManifest): string {
  const records = new Map(manifest.events.map((event) => [event.id, event]));
  const localTurns = new Map(manifest.localTurns.map((turn) => [turn.turnId, turn]));
  const totalTargets = manifest.keptTargets.length + manifest.localKeptTargets.length;
  const lines: string[] = [
    `# Kept context: ${manifest.title}`,
    "",
    `This artifact contains ${plural(totalTargets, "explicitly kept target")} plus each target's full causal context. Raw source targets carry their all-parent causal downset; Textile-authored turns carry their exact parent chain plus every source ancestor's all-parent downset. Comparison siblings are retained only in the embedded curation patch and are not treated as kept conversation content. Actor names are provenance; no user/assistant or training perspective is inferred.`,
    "",
  ];
  for (const target of manifest.keptTargets) {
    lines.push(`## Kept target \`${target.sourceId}\``, "");
    if (target.keepEvent) {
      lines.push(
        `Kept by **${escapeMarkdown(target.keepEvent.author.actor)}** at ${target.keepEvent.at} (event \`${target.keepEvent.id}\`).`,
        "",
      );
    } else if (target.sourceSelectionIds.length > 0) {
      lines.push(
        `Kept by carried source selection ${target.sourceSelectionIds.map((id) => `\`${id}\``).join(", ")}.`,
        "",
      );
    } else {
      lines.push("Kept state is explicit, but this carried archive has no surviving keep-event attribution.", "");
    }
    lines.push("### First-parent reading path", "");
    const path = manifest.firstParentPaths.find((candidate) => candidate.target === target.sourceId)?.ids ?? [];
    for (const id of path) renderMarkdownEvent(lines, records.get(id));
    const pathIds = new Set(path);
    const downset = manifest.targetDownsets.find((candidate) => candidate.target === target.sourceId)?.ids ?? [];
    const additional = downset.filter((id) => !pathIds.has(id));
    if (additional.length > 0) {
      lines.push("### Additional causal ancestors", "");
      for (const id of additional) renderMarkdownEvent(lines, records.get(id));
    }
    if (target.notes.length > 0) {
      lines.push("### Curation notes", "");
      for (const note of target.notes) {
        lines.push(
          `- **${escapeMarkdown(note.author.actor)}**, ${note.at}: ${note.text}`,
        );
      }
      lines.push("");
    }
  }
  for (const target of manifest.localKeptTargets) {
    const kept = localTurns.get(target.turnId);
    if (!kept) continue;
    lines.push(`## Kept Textile turn \`${target.turnId}\``, "");
    if (kept.keepEvent) {
      lines.push(
        `Kept by **${escapeMarkdown(kept.keepEvent.author.actor)}** at ${kept.keepEvent.at} (event \`${kept.keepEvent.id}\`).`,
        "",
      );
    }
    lines.push(
      `Origin loom \`${target.originLoomId}\`; this is a Textile turn, not a rewritten raw source event.`,
      "",
      "### Reading path",
      "",
    );
    const pathSourceIds = new Set<string>();
    for (const ref of target.contextPath) {
      if (ref.kind === "source-event") {
        pathSourceIds.add(ref.id);
        renderMarkdownEvent(lines, records.get(ref.id));
      } else {
        renderMarkdownLocalTurn(lines, localTurns.get(ref.id));
      }
    }
    const downset = manifest.targetDownsets.find(
      (candidate) => candidate.target === target.turnId,
    )?.ids ?? [];
    const additional = downset.filter((id) => !pathSourceIds.has(id));
    if (additional.length > 0) {
      lines.push("### Additional causal ancestors", "");
      for (const id of additional) renderMarkdownEvent(lines, records.get(id));
    }
    if (kept.notes.length > 0) {
      lines.push("### Curation notes", "");
      for (const note of kept.notes) {
        lines.push(
          `- **${escapeMarkdown(note.actor ?? "unknown")}**, ${new Date(note.createdAt).toISOString()}: ${note.text}`,
        );
      }
      lines.push("");
    }
  }
  lines.push("## Curation boundary", "");
  if (manifest.comparisonOnlyReferences.length > 0) {
    lines.push(
      `Shown for comparison but not exported as kept context: ${manifest.comparisonOnlyReferences.map((id) => `\`${id}\``).join(", ")}.`,
      "",
    );
  } else {
    lines.push("No comparison-only source ids were carried by the curation patch.", "");
  }
  lines.push("## Integrity and policy report", "");
  lines.push(`- Partial: **${manifest.partial ? "yes" : "no"}**`);
  lines.push(`- Payloads withheld: **${manifest.dropReport.length}**`);
  lines.push(`- Causal obstacles: **${manifest.obstacles.length}**`);
  for (const drop of manifest.dropReport) {
    lines.push(
      `- \`${drop.eventId}\`: ${drop.category}; payload withheld by ${drop.by.map((id) => `\`${id}\``).join(", ") || "policy"}.`,
    );
  }
  for (const obstacle of manifest.obstacles) {
    lines.push(`- ${obstacle.class}: ${obstacle.detail ?? obstacle.missing ?? obstacle.id ?? (obstacle.ids ?? []).join(" → ")}`);
  }
  lines.push(
    "",
    KEPT_MANIFEST_START,
    encodeBase64(JSON.stringify(manifest)),
    KEPT_MANIFEST_END,
    "",
  );
  return lines.join("\n");
}

function renderMarkdownLocalTurn(
  lines: string[],
  turn: RawLyncPortableLocalTurn | undefined,
): void {
  if (!turn) return;
  const actor = turn.actor ?? "unknown";
  const via = turn.via ? ` via ${turn.via}` : "";
  lines.push(
    `#### ${escapeMarkdown(actor)}${escapeMarkdown(via)} · Textile \`${turn.role ?? "turn"}\``,
    "",
    `origin loom \`${turn.originLoomId}\` · turn \`${turn.turnId}\``,
    "",
    turn.text,
    "",
  );
}

function renderMarkdownEvent(
  lines: string[],
  event: KeptContextEventRecord | undefined,
): void {
  if (!event) return;
  const author = event.envelope.author as { actor?: unknown; via?: unknown } | undefined;
  const actor = typeof author?.actor === "string" ? author.actor : "unknown";
  const via = typeof author?.via === "string" ? ` via ${author.via}` : "";
  const kind = typeof event.envelope.kind === "string" ? event.envelope.kind : "unknown";
  const at = typeof event.envelope.at === "string" ? event.envelope.at : "unknown time";
  lines.push(
    `#### ${escapeMarkdown(actor)}${escapeMarkdown(via)} · \`${kind}\``,
    "",
    `${at} · source \`${event.id}\``,
    "",
    event.presentation.text,
    "",
  );
  const extraParents = event.parentRefs.filter((parent) => parent.role === "additional-parent");
  if (extraParents.length > 0) {
    lines.push(
      `Additional causal parents: ${extraParents.map((parent) => `\`${parent.id}\``).join(", ")}.`,
      "",
    );
  }
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+.!|-])/g, "\\$1");
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}
