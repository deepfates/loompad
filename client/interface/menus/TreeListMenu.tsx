import { TreeListProps } from "../types";
import { sortTreeEntriesByRecency } from "../utils/storyMeta";

export const TreeListMenu = ({
  trees,
  selectedIndex,
  onSelect,
  onDelete,
  onNew,
  onExportJson,
  onExportThread,
}: TreeListProps) => {
  const treeEntries = sortTreeEntriesByRecency(trees);


  return (
    <div className="menu-content">
      <div
        className={`menu-item story-menu-item ${
          selectedIndex === 0 ? "selected" : ""
        }`}
        aria-selected={selectedIndex === 0}
        data-index={0}
      >
        <div className="menu-item-body">
          <div className="menu-item-label">+ New Story</div>
        </div>
      </div>

      {treeEntries.map(([key, tree], index) => (
        <div
          key={key}
          className={`menu-item story-menu-item ${
            selectedIndex === index + 1 ? "selected" : ""
          }`}
          aria-selected={selectedIndex === index + 1}
          data-index={index + 1}
        >
          <div className="menu-item-body">
            <div className="menu-item-label">{key}</div>
            <div className="menu-item-preview">
              {(tree.root.text ?? "").slice(0, 50)}...
            </div>
          </div>
          {(onExportJson || onExportThread) && (
            <div className="menu-item-actions" aria-label="Story actions">
              {onExportJson ? (
                <button
                  type="button"
                  className="menu-item-action"
                  title="Save story"
                  aria-label="Save story"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExportJson(key);
                  }}
                >
                  S
                </button>
              ) : null}
              {onExportThread ? (
                <button
                  type="button"
                  className="menu-item-action"
                  title="Print thread"
                  aria-label="Print thread"
                  onClick={(event) => {
                    event.stopPropagation();
                    onExportThread(key);
                  }}
                >
                  P
                </button>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
