import type { ModelConfig, ModelId } from "../../../shared/models";
import type { ModelSortOption } from "../types";

interface ModelsMenuProps {
  modelEntries: Array<[ModelId, ModelConfig]>;
  selectedIndex: number;
  sortOrder: ModelSortOption;
  onSortChange: (option: ModelSortOption) => void;
  onSelectIndex: (index: number) => void;
  onNew: () => void;
  onSelectModel: (modelId: ModelId) => void;
  onDeleteModel: (modelId: ModelId) => void;
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
  onSortChange,
  onSelectIndex,
  onNew,
  onSelectModel,
  onDeleteModel,
  isLoading = false,
  error,
}: ModelsMenuProps) => {
  return (
    <div className="menu-content models-menu">
      <div className="models-menu__header">
        <label className="models-menu__sort-label" htmlFor="models-sort">
          Sort
        </label>
        <select
          id="models-sort"
          className="models-menu__sort-select"
          value={sortOrder}
          onChange={(event) =>
            onSortChange(event.target.value as ModelSortOption)
          }
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`menu-item ${selectedIndex === 0 ? "selected" : ""}`}
        onClick={() => {
          onSelectIndex(0);
          onNew();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectIndex(0);
            onNew();
          }
        }}
      >
        <div className="menu-item-label">+ New Model</div>
        <div className="menu-item-preview">Add an OpenRouter model</div>
      </div>

      {modelEntries.map(([modelId, config], index) => {
        const listIndex = index + 1; // account for + New Model row
        return (
          <div
            key={modelId}
            className={`menu-item ${
              selectedIndex === listIndex ? "selected" : ""
            }`}
            onClick={() => {
              onSelectIndex(listIndex);
              onSelectModel(modelId);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectIndex(listIndex);
                onSelectModel(modelId);
              }
            }}
          >
            <div className="menu-item-label">{config.name}</div>
            <div className="menu-item-preview">
              {modelId} • Max Tokens: {config.maxTokens} • Temp: {config.defaultTemp}
            </div>
            <button
              type="button"
              className="models-menu__delete"
              onClick={(event) => {
                event.stopPropagation();
                onSelectIndex(listIndex);
                onDeleteModel(modelId);
              }}
            >
              Delete
            </button>
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
