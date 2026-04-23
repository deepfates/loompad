import type { ModelConfig, ModelId } from "../../../shared/models";
import type { ModelSortOption } from "../types";
import { Row } from "../components/Row";

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
  "name-asc": "A → Z",
  "name-desc": "Z → A",
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
  return (
    <div className="menu-content">
      <Row
        kind="pick"
        label="Sort"
        value={SORT_LABELS[sortOrder]}
        selected={selectedIndex === 0}
        onHover={() => onSelectIndex(0)}
        onActivate={() => onToggleSort(1)}
      />
      <Row
        kind="action"
        label="New Model"
        glyph="+"
        preview="Add an OpenRouter model"
        stacked
        selected={selectedIndex === 1}
        onHover={() => onSelectIndex(1)}
        onActivate={() => {
          onSelectIndex(1);
          onNew();
        }}
      />
      {modelEntries.map(([modelId, config], index) => {
        const listIndex = index + 2;
        return (
          <Row
            key={modelId}
            kind="action"
            label={config.name}
            preview={`${modelId} · ${config.maxTokens}tok · T=${config.defaultTemp}`}
            stacked
            selected={selectedIndex === listIndex}
            onHover={() => onSelectIndex(listIndex)}
            onActivate={() => {
              onSelectIndex(listIndex);
              onEditModel(modelId);
            }}
          />
        );
      })}
      {isLoading && (
        <output className="loading-message">Loading models…</output>
      )}
      {error && <output className="error-message">{error}</output>}
    </div>
  );
};
