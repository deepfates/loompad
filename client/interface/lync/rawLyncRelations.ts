import type { StoryNode } from "../types";

export type RawLyncRelationKind =
  | "first-parent"
  | "additional-parent"
  | "causal-child"
  | "pointer-target"
  | "incoming-pointer"
  | "annotation";

export interface RawLyncRelation {
  id: string;
  kind: RawLyncRelationKind;
  label: string;
  detail: string;
  sourceEventId: string;
  targetSourceId?: string;
  targetPath?: StoryNode[];
}

export interface RawLyncMapRelation {
  id: string;
  kind: "additional-parent" | "pointer";
  fromNodeId: string;
  toNodeId: string;
  label: string;
}

export interface RawLyncMapAnnotation {
  nodeId: string;
  sourceId: string;
  labels: string[];
  annotationIds: string[];
}

export interface RawLyncMapModel {
  relations: RawLyncMapRelation[];
  annotations: RawLyncMapAnnotation[];
}

/**
 * Typed passive MAP layer. Only envelope-declared non-first parents and the
 * exact base Lync annotation/pointer pacts participate; payloads are never
 * searched recursively for relation-looking fields.
 */
export function rawLyncMapModel(root: StoryNode): RawLyncMapModel {
  const paths = sourcePaths(root);
  const relations: RawLyncMapRelation[] = [];
  const annotations = new Map<string, RawLyncMapAnnotation>();

  for (const [sourceId, path] of [...paths.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const child = path.at(-1)!;
    for (const [index, parentId] of (child.sourceParents ?? []).entries()) {
      if (index === 0) continue;
      const parent = paths.get(parentId)?.at(-1);
      if (!parent) continue;
      relations.push({
        id: `additional-parent:${sourceId}:${index}:${parentId}`,
        kind: "additional-parent",
        fromNodeId: parent.id,
        toNodeId: child.id,
        label: `${sourceId} cites ${parentId} as causal parent ${index + 1}.`,
      });
    }
  }

  for (const record of [...(root.sourceArchive?.records ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const kind = typeof record.envelope.kind === "string" ? record.envelope.kind : "";
    if (kind === "lync/annotation") {
      const label = stringField(record.payload, "label") ?? "untyped";
      for (const targetId of stringArray(record.envelope.parents)) {
        const target = paths.get(targetId)?.at(-1);
        if (!target) continue;
        const existing = annotations.get(target.id) ?? {
          nodeId: target.id,
          sourceId: targetId,
          labels: [],
          annotationIds: [],
        };
        existing.labels.push(label);
        existing.annotationIds.push(record.id);
        annotations.set(target.id, existing);
      }
      continue;
    }
    if (kind !== "lync/pointer") continue;
    const targetId = stringField(record.payload, "target");
    if (!targetId) continue;
    const pointer = paths.get(record.id)?.at(-1);
    const target = paths.get(targetId)?.at(-1);
    if (!pointer || !target) continue;
    const name = stringField(record.payload, "name") ?? "unnamed";
    relations.push({
      id: `pointer:${record.id}:${targetId}`,
      kind: "pointer",
      fromNodeId: pointer.id,
      toNodeId: target.id,
      label: `Named pointer ${name} targets ${targetId}; this is not a causal edge.`,
    });
  }

  return {
    relations,
    annotations: [...annotations.values()]
      .map((annotation) => ({
        ...annotation,
        labels: [...annotation.labels].sort(),
        annotationIds: [...annotation.annotationIds].sort(),
      }))
      .sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
  };
}

/**
 * Build the focused event's typed relation list without changing Textile's
 * first-parent tree projection. Envelope parents remain causal edges;
 * annotation targets and named pointer targets stay visibly different kinds.
 */
export function rawLyncRelationsFor(
  root: StoryNode,
  focused: StoryNode | undefined,
): RawLyncRelation[] {
  if (!focused?.sourceId) return [];
  const paths = sourcePaths(root);
  const relations: RawLyncRelation[] = [];

  for (const [index, parentId] of (focused.sourceParents ?? []).entries()) {
    const targetPath = paths.get(parentId);
    const kind = index === 0 ? "first-parent" : "additional-parent";
    relations.push({
      id: `${kind}:${focused.sourceId}:${index}:${parentId}`,
      kind,
      label: `${index === 0 ? "parent 1" : `parent ${index + 1} · additional`} · ${targetLabel(targetPath, parentId)}`,
      detail: `Causal input ${index + 1} of ${focused.sourceParents!.length}: ${parentId}`,
      sourceEventId: focused.sourceId,
      targetSourceId: parentId,
      targetPath,
    });
  }

  for (const [sourceId, path] of [...paths.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const child = path.at(-1)!;
    const parentIndex = child.sourceParents?.indexOf(focused.sourceId) ?? -1;
    if (parentIndex < 0) continue;
    relations.push({
      id: `causal-child:${focused.sourceId}:${sourceId}:${parentIndex}`,
      kind: "causal-child",
      label: `child · uses this as parent ${parentIndex + 1} · ${targetLabel(path, sourceId)}`,
      detail: `${sourceId} cites ${focused.sourceId} as causal input ${parentIndex + 1}.`,
      sourceEventId: focused.sourceId,
      targetSourceId: sourceId,
      targetPath: path,
    });
  }

  const records = root.sourceArchive?.records ?? [];
  for (const record of [...records].sort((a, b) => a.id.localeCompare(b.id))) {
    const kind = typeof record.envelope.kind === "string" ? record.envelope.kind : "";
    const parents = stringArray(record.envelope.parents);
    if (kind === "lync/annotation" && parents.includes(focused.sourceId)) {
      const label = stringField(record.payload, "label") ?? "untyped";
      relations.push({
        id: `annotation:${record.id}:${focused.sourceId}`,
        kind: "annotation",
        label: `annotation · ${label} · ${shortId(record.id)}`,
        detail: `Annotation ${record.id} targets this event; it is not a causal parent.`,
        sourceEventId: record.id,
        targetSourceId: focused.sourceId,
      });
    }
    if (kind !== "lync/pointer") continue;
    const pointerTarget = stringField(record.payload, "target");
    if (!pointerTarget) continue;
    const name = stringField(record.payload, "name") ?? "unnamed";
    if (record.id === focused.sourceId) {
      const targetPath = paths.get(pointerTarget);
      relations.push({
        id: `pointer-target:${record.id}:${pointerTarget}`,
        kind: "pointer-target",
        label: `pointer ${name} → ${targetLabel(targetPath, pointerTarget)}`,
        detail: `Named pointer ${record.id} targets ${pointerTarget}; this is not a causal-parent edge.`,
        sourceEventId: record.id,
        targetSourceId: pointerTarget,
        targetPath,
      });
    } else if (pointerTarget === focused.sourceId) {
      const pointerPath = paths.get(record.id);
      relations.push({
        id: `incoming-pointer:${record.id}:${focused.sourceId}`,
        kind: "incoming-pointer",
        label: `incoming pointer · ${name} · ${shortId(record.id)}`,
        detail: `Named pointer ${record.id} targets this event; this is not a causal-child edge.`,
        sourceEventId: record.id,
        targetSourceId: record.id,
        targetPath: pointerPath,
      });
    }
  }

  return relations;
}

function sourcePaths(root: StoryNode): Map<string, StoryNode[]> {
  const result = new Map<string, StoryNode[]>();
  const visit = (node: StoryNode, path: StoryNode[]) => {
    const next = [...path, node];
    if (node.sourceId) result.set(node.sourceId, next);
    for (const child of node.continuations ?? []) visit(child, next);
  };
  visit(root, []);
  return result;
}

function targetLabel(path: StoryNode[] | undefined, sourceId: string): string {
  if (!path) return `${shortId(sourceId)} (not readable here)`;
  const node = path.at(-1)!;
  const firstLine = node.text.split("\n", 1)[0]?.trim() || node.sourceKind || "event";
  const compact = firstLine.length > 36 ? `${firstLine.slice(0, 33)}…` : firstLine;
  return `${compact} · ${shortId(sourceId)}`;
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(-8) : id;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function stringField(
  value: Record<string, unknown> | undefined,
  key: string,
): string | null {
  return typeof value?.[key] === "string" ? value[key] : null;
}
