import type { StoryAnnotation, StoryNode } from "../types";
import type { ArchiveSourceRef } from "../lync/archiveTypes";

const MANIFEST_START = "<!-- textile-kept-conversation:v1";
const MANIFEST_END = "textile-kept-conversation:end -->";

export interface KeptConversationTurn {
  id: string;
  parentId: string | null;
  text: string;
  role?: string;
  actor?: string;
  via?: string;
  createdAt: number;
  archiveSource?: ArchiveSourceRef;
  keepEvent?: {
    id: string;
    at: string;
    author: { actor: string; via?: string };
  };
  notes: StoryAnnotation[];
}

export interface KeptConversationManifest {
  schemaVersion: 1;
  kind: "textile/kept-conversation";
  title: string;
  originalLoomId: string;
  semantics: {
    keptTargets: "explicit-positive-keeps";
    context: "loom-parent-path";
    siblings: "not-exported-unless-kept-or-ancestor";
    actorRoles: "preserved-not-inferred";
  };
  keptTargets: string[];
  turnOrder: string[];
  turns: KeptConversationTurn[];
}

export interface KeptConversationArtifact {
  filename: string;
  markdown: string;
  manifest: KeptConversationManifest;
}

export function hasArchiveConversationSources(node: StoryNode): boolean {
  if (node.archiveSource) return true;
  return (node.continuations ?? []).some(hasArchiveConversationSources);
}

interface IndexedNode {
  node: StoryNode;
  path: StoryNode[];
}

function portableId(node: StoryNode): string {
  return node.portableTurnId ?? node.id;
}

function indexTree(root: StoryNode): IndexedNode[] {
  const result: IndexedNode[] = [];
  const visit = (node: StoryNode, ancestors: StoryNode[]) => {
    const path = [...ancestors, node];
    result.push({ node, path });
    for (const child of node.continuations ?? []) visit(child, path);
  };
  visit(root, []);
  return result;
}

function safeIso(value: number): string {
  return new Date(Number.isFinite(value) ? value : 0).toISOString();
}

function filenamePart(value: string): string {
  return value.trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || "conversation";
}

function heading(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/#/g, "\\#");
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function manifestComment(manifest: KeptConversationManifest): string {
  const encoded = encodeBase64(JSON.stringify(manifest));
  const lines = encoded.match(/.{1,100}/g) ?? [];
  return `${MANIFEST_START}\n${lines.join("\n")}\n${MANIFEST_END}`;
}

function sourceLabel(source: ArchiveSourceRef | undefined): string {
  if (!source) return "Textile turn";
  return `${source.provider}/${source.kind} ${source.recordId}`;
}

function renderMarkdown(manifest: KeptConversationManifest): string {
  const byId = new Map(manifest.turns.map((turn) => [turn.id, turn]));
  const sections = manifest.keptTargets.map((targetId, targetIndex) => {
    const path: KeptConversationTurn[] = [];
    const seen = new Set<string>();
    let current = byId.get(targetId);
    while (current && !seen.has(current.id)) {
      path.push(current);
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    path.reverse();
    const target = byId.get(targetId)!;
    const body = path.map((turn) => {
      const provenance = [
        turn.actor ? `actor ${turn.actor}` : "actor unknown",
        sourceLabel(turn.archiveSource),
        safeIso(turn.createdAt),
      ].join(" · ");
      const notes = turn.notes.length
        ? `\n\nNotes:\n${turn.notes.map((note) => `- ${note.actor ? `${note.actor}: ` : ""}${note.text}`).join("\n")}`
        : "";
      return `### ${heading(provenance)}\n\n${turn.text}${notes}`;
    }).join("\n\n");
    return `## Kept ${targetIndex + 1}: ${heading(sourceLabel(target.archiveSource))}\n\n${body}`;
  }).join("\n\n---\n\n");
  const empty = manifest.keptTargets.length === 0
    ? "No turns were explicitly kept. The empty result is intentional and machine-readable."
    : bodyOrFallback(sections);
  return [
    `# ${heading(manifest.title)} — kept conversations`,
    "",
    "This portable Textile artifact contains only explicitly kept turns and each turn's Loom-parent context. Nearby siblings are not treated as selected or rejected examples. Actor and source identities are preserved; no user/assistant training perspective is inferred.",
    "",
    empty,
    "",
    manifestComment(manifest),
    "",
  ].join("\n");
}

function bodyOrFallback(value: string): string {
  return value || "No readable kept paths were available.";
}

export function buildKeptConversationArtifact(
  title: string,
  tree: { root: StoryNode },
  originalLoomId: string,
): KeptConversationArtifact {
  const entries = indexTree(tree.root);
  const kept = entries
    .filter(({ node }) => node.kept === true)
    .sort((a, b) => portableId(a.node).localeCompare(portableId(b.node)));
  const included = new Set(kept.flatMap(({ path }) => path.map(portableId)));
  const turns = entries.flatMap(({ node, path }) => {
    const id = portableId(node);
    if (!included.has(id)) return [];
    const parent = path.length > 1 ? path[path.length - 2] : null;
    return [{
      id,
      parentId: parent ? portableId(parent) : null,
      text: node.text,
      role: node.turnRole,
      actor: node.actor,
      via: node.via,
      createdAt: node.createdAt ?? 0,
      archiveSource: node.archiveSource,
      keepEvent: node.kept && node.keepMark
        ? {
            id: node.keepMark.id,
            at: safeIso(node.keepMark.createdAt),
            author: {
              actor: node.keepMark.actor ?? "unknown",
              ...(node.keepMark.via ? { via: node.keepMark.via } : {}),
            },
          }
        : undefined,
      notes: (node.annotations ?? []).map((note) => ({ ...note })),
    }];
  });
  const manifest: KeptConversationManifest = {
    schemaVersion: 1,
    kind: "textile/kept-conversation",
    title,
    originalLoomId,
    semantics: {
      keptTargets: "explicit-positive-keeps",
      context: "loom-parent-path",
      siblings: "not-exported-unless-kept-or-ancestor",
      actorRoles: "preserved-not-inferred",
    },
    keptTargets: kept.map(({ node }) => portableId(node)),
    turnOrder: turns.map((turn) => turn.id),
    turns,
  };
  return {
    filename: `${filenamePart(title)}-kept-conversations.md`,
    manifest,
    markdown: renderMarkdown(manifest),
  };
}

export function parseKeptConversationMarkdown(text: string): KeptConversationManifest {
  const start = text.lastIndexOf(MANIFEST_START);
  const end = text.lastIndexOf(MANIFEST_END);
  if (start < 0 || end <= start) {
    throw new Error("Not a Textile kept-conversation artifact: machine manifest missing.");
  }
  const encoded = text.slice(start + MANIFEST_START.length, end).replace(/\s+/g, "");
  let raw: unknown;
  try {
    raw = JSON.parse(decodeBase64(encoded));
  } catch (error) {
    throw new Error(
      `Not a Textile kept-conversation artifact: invalid manifest (${
        error instanceof Error ? error.message : String(error)
      }).`,
    );
  }
  const manifest = raw as Partial<KeptConversationManifest>;
  if (
    !raw || typeof raw !== "object" || manifest.schemaVersion !== 1
    || manifest.kind !== "textile/kept-conversation"
    || typeof manifest.originalLoomId !== "string"
    || !Array.isArray(manifest.keptTargets)
    || !Array.isArray(manifest.turnOrder)
    || !Array.isArray(manifest.turns)
  ) {
    throw new Error("Not a Textile kept-conversation artifact: unsupported manifest shape.");
  }
  return manifest as KeptConversationManifest;
}

export function downloadKeptConversationArtifact(
  title: string,
  tree: { root: StoryNode },
  originalLoomId: string,
): KeptConversationArtifact {
  const artifact = buildKeptConversationArtifact(title, tree, originalLoomId);
  if (typeof window !== "undefined") {
    const url = URL.createObjectURL(new Blob([artifact.markdown], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = artifact.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  return artifact;
}
