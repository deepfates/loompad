import type { ModelConfig, ModelId } from "../../../shared/models";
import type { ModelSortOption } from "../types";

interface ModelsMenuProps {
  modelEntries: Array<[ModelId, ModelConfig]>;
  selectedIndex: number;
  sortOrder: ModelSortOption;
  onSelectIndex: (index: number) => void;
  onToggleSort: (direction: -1 | 1) => void;
  onNew: () => void;
  onEditModel: (modelId: ModelId) => void;
  isLoading?: boolean;
  error?: string | null;
}

const SORT_LABELS: Record<ModelSortOption, string> = {
  "name-asc": "Name (A → Z)",
  "name-desc": "Name (Z → A)",
};

export const ModelsMenu = ({
  modelEntries,
  selectedIndex,
  sortOrder,
  onSelectIndex,
  onToggleSort,
  onNew,
  onEditModel,
  isLoading = false,
  error,
}: ModelsMenuProps) => {
  const handleSortActivate = () => {
    onToggleSort(1);
  };

  return (
    <div className="menu-content models-menu">
      <div
        className={`menu-item models-menu__sort ${selectedIndex === 0 ? "selected" : ""}`}
        role="button"
        tabIndex={0}
        onMouseEnter={() => onSelectIndex(0)}
        onClick={handleSortActivate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleSortActivate();
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            onToggleSort(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            onToggleSort(1);
          }
        }}
      >
        <div className="menu-item-label">Sort Models</div>
        <div className="menu-item-preview">
          {SORT_LABELS[sortOrder]} (◄► to change)
        </div>
      </div>

      <div
        className={`menu-item ${selectedIndex === 1 ? "selected" : ""}`}
        onMouseEnter={() => onSelectIndex(1)}
        onClick={() => {
          onSelectIndex(1);
          onNew();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectIndex(1);
            onNew();
          }
        }}
      >
        <div className="menu-item-label">+ New Model</div>
        <div className="menu-item-preview">Add an OpenRouter model</div>
      </div>

      {modelEntries.map(([modelId, config], index) => {
        const listIndex = index + 2; // account for sort + new rows
        return (
          <div
            key={modelId}
            className={`menu-item models-menu__item ${
              selectedIndex === listIndex ? "selected" : ""
            }`}
            onMouseEnter={() => onSelectIndex(listIndex)}
            onClick={() => {
              onSelectIndex(listIndex);
              onEditModel(modelId);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectIndex(listIndex);
                onEditModel(modelId);
              }
            }}
          >
            <div className="menu-item-label">{config.name}</div>
            <div className="menu-item-preview">
              {modelId} • Max Tokens: {config.maxTokens} • Temp: {config.defaultTemp}
            </div>
          </div>
        );
      })}

      {isLoading && (
        <output className="loading-message">Loading models…</output>
      )}
      {error && <output className="error-message">{error}</output>}
    </div>
  );
};
