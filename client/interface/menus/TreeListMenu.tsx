import { TreeListProps } from "../types";
import {
  orderKeysByStorySort,
  type StorySortOption,
} from "../utils/storyMeta";
import { Row } from "../components/Row";

const SORT_LABELS: Record<StorySortOption, string> = {
  recent: "Recent",
  oldest: "Oldest",
};

const SaveIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="16"
    height="16"
    viewBox="0 0 16 16"
  >
    <path
      d="M3 2h7l3 3v9H3V2zm1 1v10h8V5.5L9.5 3H4zm2 5h4v5H6V8zm0-4h4v2H6V4z"
      fill="currentColor"
    />
  </svg>
);

const PrintIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="16"
    height="16"
    viewBox="0 0 16 16"
  >
    <path
      d="M4 2h8v3h2l1 2v4h-3v3H4v-3H1V7l1-2h2V2zm1 1v2h6V3H5zm8 5H3v3h1V8h8v3h1V8zm-3 5v-2H6v2h4z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Stories list.  Mirrors the Models-tab row layout:
 *   row 0 — Sort pick (Recent / A→Z / Z→A)
 *   row 1 — + New Story action
 *   row 2+ — each existing story as an action row whose trailing slot
 *            carries up to two sub-actions (export JSON / export thread)
 * The cursor is (rowIndex, columnIndex) — column 0 is the story body,
 * columns 1+ are the sub-actions in order.
 */
export const TreeListMenu = ({
  trees,
  selectedIndex,
  selectedColumn,
  sortOrder,
  onToggleSort,
  onSelect,
  onNew,
  onExportJson,
  onExportThread,
  onHighlight,
}: TreeListProps) => {
  const orderedKeys = orderKeysByStorySort(trees, sortOrder);
  const hasJson = Boolean(onExportJson);
  const hasThread = Boolean(onExportThread);
  const jsonColumn = hasJson ? 1 : -1;
  const threadColumn = hasThread ? (hasJson ? 2 : 1) : -1;

  return (
    <div className="menu-content">
      <Row
        kind="pick"
        label="Sort"
        value={SORT_LABELS[sortOrder]}
        selected={selectedIndex === 0 && selectedColumn === 0}
        onActivate={() => {
          onToggleSort?.(1);
          onHighlight?.(0, 0);
        }}
      />
      <Row
        kind="action"
        label="New Story"
        glyph="+"
        selected={selectedIndex === 1 && selectedColumn === 0}
        onActivate={() => {
          onNew?.();
          onHighlight?.(1, 0);
        }}
      />
      {orderedKeys.map((key, index) => {
        const tree = trees[key];
        const rowIndex = index + 2;
        const bodySelected =
          selectedIndex === rowIndex && selectedColumn === 0;
        const jsonSelected =
          hasJson &&
          selectedIndex === rowIndex &&
          selectedColumn === jsonColumn;
        const threadSelected =
          hasThread &&
          selectedIndex === rowIndex &&
          selectedColumn === threadColumn;

        const trailing =
          hasJson || hasThread ? (
            <div className="story-action-cluster" role="group">
              {hasJson ? (
                <button
                  type="button"
                  className={`story-action${jsonSelected ? " selected" : ""}`}
                  aria-label="Export story as JSON"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExportJson?.(key);
                    onHighlight?.(rowIndex, jsonColumn);
                  }}
                  onFocus={() => onHighlight?.(rowIndex, jsonColumn)}
                >
                  <SaveIcon />
                </button>
              ) : null}
              {hasThread ? (
                <button
                  type="button"
                  className={`story-action${threadSelected ? " selected" : ""}`}
                  aria-label="Export current thread"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExportThread?.(key);
                    onHighlight?.(rowIndex, threadColumn);
                  }}
                  onFocus={() => onHighlight?.(rowIndex, threadColumn)}
                >
                  <PrintIcon />
                </button>
              ) : null}
            </div>
          ) : undefined;

        const preview = (tree.root.text ?? "").slice(0, 60);

        return (
          <Row
            key={key}
            kind="action"
            label={key}
            preview={preview ? `${preview}…` : undefined}
            stacked
            trailing={trailing}
            selected={bodySelected}
            onActivate={() => {
              onSelect(key);
              onHighlight?.(rowIndex, 0);
            }}
          />
        );
      })}
    </div>
  );
};
