import { TreeListProps } from "../types";

export const TreeListMenu = ({
  trees,
  selectedIndex,
  onSelect,
}: TreeListProps) => {
  const treeEntries = Object.entries(trees);

  return (
    <div className="menu-content">
      {treeEntries.map(([key, tree], index) => (
        <button
          key={key}
          className={`menu-item ${selectedIndex === index ? "selected" : ""}`}
          onClick={() => onSelect(key)}
          aria-selected={selectedIndex === index}
        >
          <div className="menu-item-label">{key}</div>
          <div className="menu-item-preview">
            {tree.root.text.slice(0, 50)}...
          </div>
        </button>
      ))}
    </div>
  );
};
