import { TreeListProps } from "../types";

export const TreeListMenu = ({
  trees,
  selectedIndex,
  onSelect,
  onDelete,
  onNew,
}: TreeListProps) => {
  const treeEntries = Object.entries(trees);
  const totalItems = treeEntries.length + 1; // +1 for "New Story" option

  const handleSelect = (index: number) => {
    if (index === 0) {
      onNew?.();
    } else {
      onSelect(treeEntries[index - 1][0]);
    }
  };

  const handleDelete = (index: number) => {
    if (index > 0 && treeEntries.length > 1) {
      onDelete?.(treeEntries[index - 1][0]);
    }
  };

  return (
    <div className="menu-content">
      <div
        className={`menu-item ${selectedIndex === 0 ? "selected" : ""}`}
        aria-selected={selectedIndex === 0}
        data-index={0}
      >
        <div className="menu-item-label">+ New Story</div>
      </div>

      {treeEntries.map(([key, tree], index) => (
        <div
          key={key}
          className={`menu-item ${
            selectedIndex === index + 1 ? "selected" : ""
          }`}
          aria-selected={selectedIndex === index + 1}
          data-index={index + 1}
        >
          <div className="menu-item-label">{key}</div>
          <div className="menu-item-preview">
            {tree.root.text.slice(0, 50)}...
          </div>
        </div>
      ))}
    </div>
  );
};
