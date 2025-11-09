import { TreeListProps } from "../types";
import { sortTreeEntriesByRecency } from "../utils/storyMeta";

const SaveIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    className="story-menu-icon"
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
    className="story-menu-icon"
  >
    <path
      d="M4 2h8v3h2l1 2v4h-3v3H4v-3H1V7l1-2h2V2zm1 1v2h6V3H5zm8 5H3v3h1V8h8v3h1V8zm-3 5v-2H6v2h4z"
      fill="currentColor"
    />
  </svg>
);

export const TreeListMenu = ({
  trees,
  selectedIndex,
  selectedColumn,
  onSelect,
  onNew,
  onExportJson,
  onExportThread,
  onHighlight,
}: TreeListProps) => {
  const treeEntries = sortTreeEntriesByRecency(trees);

  const actionColumns: Array<"story" | "json" | "thread"> = ["story"];
  if (onExportJson) actionColumns.push("json");
  if (onExportThread) actionColumns.push("thread");

  const getColumnIndex = (action: "json" | "thread") =>
    actionColumns.indexOf(action);

  return (
    <div className="menu-content">
      <div className="story-menu-row" data-index={0}>
        <div
          className={`menu-item story-menu-item ${
            selectedIndex === 0 && selectedColumn === 0 ? "selected" : ""
          }`}
          aria-selected={selectedIndex === 0 && selectedColumn === 0}
          data-index={0}
          onClick={() => {
            onNew?.();
            onHighlight?.(0, 0);
          }}
          onMouseEnter={() => onHighlight?.(0, 0)}
          onFocus={() => onHighlight?.(0, 0)}
        >
          <div className="menu-item-body">
            <div className="menu-item-label">+ New Story</div>
          </div>
        </div>
      </div>

      {treeEntries.map(([key, tree], index) => {
        const rowIndex = index + 1;
        const isStorySelected =
          selectedIndex === rowIndex && selectedColumn === 0;
        const saveColumn = getColumnIndex("json");
        const printColumn = getColumnIndex("thread");

        return (
          <div className="story-menu-row" key={key} data-index={rowIndex}>
            <div
              className={`menu-item story-menu-item ${
                isStorySelected ? "selected" : ""
              }`}
              aria-selected={isStorySelected}
              data-index={rowIndex}
              onClick={() => {
                onSelect(key);
                onHighlight?.(rowIndex, 0);
              }}
              onMouseEnter={() => onHighlight?.(rowIndex, 0)}
              onFocus={() => onHighlight?.(rowIndex, 0)}
            >
              <div className="menu-item-body">
                <div className="menu-item-label">{key}</div>
                <div className="menu-item-preview">
                  {(tree.root.text ?? "").slice(0, 50)}...
                </div>
              </div>

              {onExportJson || onExportThread ? (
                <div
                  className="story-menu-actions"
                  role="group"
                  aria-label="Story export options"
                >
                  {onExportJson ? (
                    <button
                      type="button"
                      className={`story-menu-action ${
                        selectedIndex === rowIndex && selectedColumn === saveColumn
                          ? "selected"
                          : ""
                      }`}
                      title="Save story"
                      aria-label="Save story"
                      onClick={(event) => {
                        event.stopPropagation();
                        onExportJson(key);
                        onHighlight?.(rowIndex, saveColumn);
                      }}
                      onMouseEnter={() => onHighlight?.(rowIndex, saveColumn)}
                      onFocus={() => onHighlight?.(rowIndex, saveColumn)}
                    >
                      <SaveIcon />
                      <span className="visually-hidden">Save story</span>
                    </button>
                  ) : null}

                  {onExportThread ? (
                    <button
                      type="button"
                      className={`story-menu-action ${
                        selectedIndex === rowIndex &&
                        selectedColumn === printColumn
                          ? "selected"
                          : ""
                      }`}
                      title="Print thread"
                      aria-label="Print thread"
                      onClick={(event) => {
                        event.stopPropagation();
                        onExportThread(key);
                        onHighlight?.(rowIndex, printColumn);
                      }}
                      onMouseEnter={() => onHighlight?.(rowIndex, printColumn)}
                      onFocus={() => onHighlight?.(rowIndex, printColumn)}
                    >
                      <PrintIcon />
                      <span className="visually-hidden">Print thread</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
