import type { StoryNode } from "../types";

/** Quiet proof and one explicit door into the focused source event's links. */
export function RawLyncIndicator({
  node,
  onOpenLinks,
}: {
  node: StoryNode | undefined;
  onOpenLinks?: () => void;
}) {
  if (!node?.sourceId) return null;
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
