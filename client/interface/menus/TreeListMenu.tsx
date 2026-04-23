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

const LinkIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    className="story-menu-icon"
  >
    <path
      d="M6.2 10.9 5.1 12a2.1 2.1 0 0 1-3-3l2.4-2.4a2.1 2.1 0 0 1 3 0l.6.6-.9.9-.6-.6a.9.9 0 0 0-1.2 0L3 9.9a.9.9 0 0 0 1.2 1.2l1.1-1.1.9.9zm3.6-5.8L10.9 4a2.1 2.1 0 0 1 3 3l-2.4 2.4a2.1 2.1 0 0 1-3 0l-.6-.6.9-.9.6.6a.9.9 0 0 0 1.2 0L13 6.1a.9.9 0 0 0-1.2-1.2l-1.1 1.1-.9-.9zM5.6 9.5l3.9-3.9.9.9-3.9 3.9-.9-.9z"
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
  onShareStory,
  onShareIndex,
  onHighlight,
}: TreeListProps) => {
  const treeEntries = sortTreeEntriesByRecency(trees);

  const actionColumns: Array<"story" | "share" | "json" | "thread"> = ["story"];
  if (onShareStory) actionColumns.push("share");
  if (onExportJson) actionColumns.push("json");
  if (onExportThread) actionColumns.push("thread");

  const getColumnIndex = (action: "share" | "json" | "thread") =>
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
          {onShareIndex ? (
            <button
              type="button"
              className="story-menu-action"
              title="Copy all stories link"
              aria-label="Copy all stories link"
              onClick={(event) => {
                event.stopPropagation();
                onShareIndex();
                onHighlight?.(0, 1);
              }}
              onMouseEnter={() => onHighlight?.(0, 1)}
              onFocus={() => onHighlight?.(0, 1)}
            >
              <LinkIcon />
              <span className="visually-hidden">Copy all stories link</span>
            </button>
          ) : null}
        </div>
      </div>

      {treeEntries.map(([key, tree], index) => {
        const rowIndex = index + 1;
        const isStorySelected =
          selectedIndex === rowIndex && selectedColumn === 0;
        const shareColumn = getColumnIndex("share");
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

              {onShareStory || onExportJson || onExportThread ? (
                <div
                  className="story-menu-actions"
                  role="group"
                  aria-label="Story actions"
                >
                  {onShareStory ? (
                    <button
                      type="button"
                      className={`story-menu-action ${
                        selectedIndex === rowIndex && selectedColumn === shareColumn
                          ? "selected"
                          : ""
                      }`}
                      title="Copy story link"
                      aria-label="Copy story link"
                      onClick={(event) => {
                        event.stopPropagation();
                        onShareStory(key);
                        onHighlight?.(rowIndex, shareColumn);
                      }}
                      onMouseEnter={() => onHighlight?.(rowIndex, shareColumn)}
                      onFocus={() => onHighlight?.(rowIndex, shareColumn)}
                    >
                      <LinkIcon />
                      <span className="visually-hidden">Copy story link</span>
                    </button>
                  ) : null}

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
