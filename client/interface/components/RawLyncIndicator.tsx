import type { StoryNode } from "../types";

/** Quiet proof and one explicit door into the focused source event's links. */
export function RawLyncIndicator({
  node,
  onOpenLinks,
}: {
  node: StoryNode | undefined;
  onOpenLinks?: () => void;
}) {
  if (!node?.sourceId && !node?.archiveSource) return null;
  if (!node.sourceId && node.archiveSource) {
    const source = node.archiveSource;
    const detail = [
      `source ${source.provider} ${source.kind} ${source.recordId}`,
      `archive owner @${source.ownerHandle}`,
      source.parentRecordId
        ? `${source.parentHeld ? "held" : "external"} reply parent ${source.parentRecordId}`
        : "archive root record",
      source.createdAt,
    ].filter(Boolean).join(" · ");
    return (
      <span
        className="story-curation-status story-source-status"
        aria-label={detail}
        title={detail}
      >
        <span className="story-source-status__label">
          {source.provider} {source.kind} {source.recordId}
        </span>
      </span>
    );
  }
  if (!node.sourceId) return null;
  const extraParents = node.extraParentIds ?? [];
  const tags = node.rawTags ?? [];
  const warnings = node.sourceWarnings ?? [];
  const detail = [
    `source ${node.sourceId}`,
    node.sourceKind,
    node.sourcePresentation === "structure" ? "structural event" : null,
    node.sourceParents?.length ? `parents: ${node.sourceParents.join(", ")}` : "root event",
    tags.length ? `tags: ${tags.map((tag) => tag.tag).join(", ")}` : null,
    warnings.length ? `nonconforming: ${warnings.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const label = (
    <span className="story-source-status__label">
        lync {node.sourceId.slice(-8)}
        {extraParents.length
          ? ` · +${extraParents.length} parent${extraParents.length === 1 ? "" : "s"}`
          : ""}
        {node.sourcePresentation === "structure" ? " · structure" : ""}
        {tags.length ? ` · ${tags.map((tag) => tag.tag).join(", ")}` : ""}
        {warnings.length ? ` · ⚠ ${warnings.length}` : ""}
        {onOpenLinks ? " · links" : ""}
    </span>
  );
  return onOpenLinks ? (
    <button
      type="button"
      className="story-curation-status story-source-status"
      aria-label={`${detail}. Open typed Lync links.`}
      title={`${detail} · open links (L)`}
      onClick={onOpenLinks}
    >
      {label}
    </button>
  ) : (
    <span className="story-curation-status story-source-status" aria-label={detail} title={detail}>
      {label}
    </span>
  );
}
