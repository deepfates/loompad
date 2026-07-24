import type { ImportedConversation } from "./storyRuntime";

function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** A compact import receipt that also teaches the raw-corpus interaction. */
export function formatImportedConversationNotice(result: ImportedConversation): string {
  const summary = [
    count(result.turnCount, "turn"),
    ...(result.kind === "raw-lync"
      ? [
          count(result.branchPointCount ?? 0, "branch point"),
          count(result.annotationCount ?? 0, "annotation"),
          count(result.selectedSourceCount ?? 0, "selected source"),
          result.nonconformingCount
            ? `${count(result.nonconformingCount, "nonconforming record")} (${result.warnings?.join("; ")})`
            : "conforming",
        ]
      : []),
  ].join(" · ");

  const controls =
    result.kind === "raw-lync"
      ? " — START opens map · ↓ selects child · ←/→ compare siblings · focus reading surface + K to Keep"
      : "";
  return `Imported "${result.title}" — ${summary}${controls}`;
}
