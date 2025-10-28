import type { StoryNode } from "../types";

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

    const preferredIndex =
      typeof current.lastSelectedIndex === "number" &&
      current.lastSelectedIndex >= 0 &&
      current.lastSelectedIndex < continuations.length
        ? current.lastSelectedIndex
        : 0;

    current = continuations[preferredIndex];
  }

  return path;
};

export const downloadStoryTreeJson = (
  key: string,
  tree: { root: StoryNode },
): void => {
  const payload = {
    schemaVersion: 1,
    title: key,
    exportedAt: new Date().toISOString(),
    tree: tree.root,
  };

  const filename = `${sanitizeForFilename(key)}-tree.json`;
  const json = JSON.stringify(payload, null, 2);
  triggerDownload(filename, json, "application/json");
};

export const downloadStoryThreadText = (
  key: string,
  tree: { root: StoryNode },
): void => {
  const nodes = resolvePrimaryPath(tree.root);
  const segments = nodes
    .map((node) => node.text?.trim())
    .filter((text): text is string => Boolean(text && text.length));
  const content = segments.join("\n\n");
  const filename = `${sanitizeForFilename(key)}-thread.txt`;
  triggerDownload(filename, content, "text/plain");
};

export const getStoryPrimaryPath = (tree: { root: StoryNode }): StoryNode[] =>
  resolvePrimaryPath(tree.root);
