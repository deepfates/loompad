import type { ImportedConversation } from "./storyRuntime";

function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** A compact import receipt that also teaches the raw-corpus interaction. */
export function formatImportedConversationNotice(result: ImportedConversation): string {
  if (result.kind === "twitter-archive" && result.archiveStats) {
    const stats = result.archiveStats;
    const owner = stats.ownerHandle === "__owner__" ? "Twitter archive" : `@${stats.ownerHandle}`;
    const accounting = [
      count(stats.tweets, "tweet"),
      count(stats.retweets, "retweet"),
      count(stats.likes, "like"),
      stats.unresolvedReplies ? count(stats.unresolvedReplies, "external reply") : "all held replies linked",
      stats.malformedRecords ? count(stats.malformedRecords, "malformed record") : "no malformed records",
    ].join(" · ");
    return `Imported ${owner} locally — ${accounting} — START opens map · ↓ enters the review row · ←/→ reviews archive items · K keeps · N notes`;
  }
  const summary = [
    ...(result.kind === "raw-lync"
      ? [
          count(result.sourceEventCount ?? result.turnCount, "source event"),
          count(result.readableEventCount ?? result.turnCount, "readable event"),
          count(result.structuralEventCount ?? 0, "structural event"),
          result.unsupportedEventCount
            ? `${count(result.unsupportedEventCount, "unsupported")} (${result.unsupportedKinds?.join(", ") || "unknown kind"})`
            : "all presented",
        ]
      : [count(result.turnCount, "turn")]),
    ...(result.kind === "raw-lync"
      ? [
          count(result.branchPointCount ?? 0, "branch point"),
          count(result.annotationCount ?? 0, "annotation"),
          count(result.selectedSourceCount ?? 0, "selected source"),
          ...(result.selectedLocalTurnCount
            ? [count(result.selectedLocalTurnCount, "kept Textile turn")]
            : []),
          result.nonconformingCount
            ? `${count(result.nonconformingCount, "nonconforming record")} (${result.warnings?.join("; ")})`
            : "conforming",
        ]
      : []),
  ].join(" · ");

  const controls =
    result.kind === "raw-lync"
      ? " — START opens map · L opens typed links · ↓ selects child · ←/→ compare siblings · focus reading surface + K to Keep"
      : "";
  return `Imported "${result.title}" — ${summary}${controls}`;
}
