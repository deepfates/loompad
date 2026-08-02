import type { ModelId } from "../../../shared/models";
import type { GenerationMode } from "../../../shared/generation";
import { Row } from "./Row";

export interface ModelFormState {
  id: ModelId | "";
  name: string;
  maxTokens: number;
  defaultTemp: number;
  generationMode: GenerationMode;
}

export type ModelEditorField =
  | "id"
  | "name"
  | "maxTokens"
  | "defaultTemp"
  | "generationMode"
  | "save"
  | "cancel"
  | "delete";

export type EditableModelField =
  | "id"
  | "name"
  | "maxTokens"
  | "defaultTemp";

interface ModelEditorProps {
  formState: ModelFormState;
  fields: ModelEditorField[];
  selectedField: ModelEditorField;
  editingField: EditableModelField | null;
  onSelectField: (field: ModelEditorField) => void;
  onActivateField: (field: ModelEditorField) => void;
  onFinishEditing: () => void;
  onChange: <Key extends keyof ModelFormState>(
    field: Key,
    value: ModelFormState[Key],
  ) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  mode: "create" | "edit";
  isSaving?: boolean;
  error?: string | null;
}

const FIELD_LABELS: Record<ModelEditorField, string> = {
  id: "Model ID",
  name: "Display Name",
  maxTokens: "Max Tokens",
  defaultTemp: "Default Temp",
  generationMode: "Generation",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
};

const fieldValue = (field: ModelEditorField, form: ModelFormState): string => {
  switch (field) {
    case "id":
      return form.id || "provider/model";
    case "name":
      return form.name || "Friendly name";
    case "maxTokens":
      return String(form.maxTokens);
    case "defaultTemp":
      return form.defaultTemp.toFixed(1);
    case "generationMode":
      return form.generationMode === "completion" ? "Raw continuation" : "Ax program";
    default:
      return "";
  }
};

export const ModelEditor = ({
  formState,
  fields,
  selectedField,
  editingField,
  onSelectField,
  onActivateField,
  onFinishEditing,
  onChange,
  onSubmit,
  onCancel,
  onDelete,
  mode,
  isSaving = false,
  error,
}: ModelEditorProps) => {
  return (
    <div className="menu-content">
      {fields.map((field) => {
        const selected = selectedField === field;
        const editing = editingField === field;

        if (editing) {
          const numeric = field === "maxTokens" || field === "defaultTemp";
          const value = numeric ? String(formState[field]) : formState[field];
          return (
            <label
              key={field}
              className="menu-item menu-item--row menu-item--pick selected model-editor-input-row"
            >
              <span className="menu-item-label">{FIELD_LABELS[field]}:</span>
              <input
                autoFocus
                className="model-editor-input"
                aria-label={FIELD_LABELS[field]}
                type={numeric ? "number" : "text"}
                min={field === "maxTokens" ? 1 : field === "defaultTemp" ? 0 : undefined}
                max={field === "maxTokens" ? 32768 : field === "defaultTemp" ? 2 : undefined}
                step={field === "defaultTemp" ? 0.1 : 1}
                value={value}
                onChange={(event) => {
                  if (field === "id") {
                    onChange("id", event.target.value as ModelId | "");
                  } else if (field === "name") {
                    onChange("name", event.target.value);
                  } else if (field === "maxTokens") {
                    onChange("maxTokens", Number(event.target.value));
                  } else {
                    onChange("defaultTemp", Number(event.target.value));
                  }
                }}
                onBlur={onFinishEditing}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>
          );
        }

        if (field === "maxTokens") {
          return (
            <Row
              key={field}
              kind="knob"
              label={FIELD_LABELS[field]}
              value={formState.maxTokens}
              min={1}
              max={32768}
              step={64}
              formatValue={(v) => String(Math.round(v))}
              selected={selected}
              onHover={() => onSelectField(field)}
              onActivate={() =>
                onChange("maxTokens", Math.min(32768, formState.maxTokens + 64))
              }
              onSetValue={(v) => onChange("maxTokens", Math.round(v))}
            />
          );
        }
        if (field === "defaultTemp") {
          return (
            <Row
              key={field}
              kind="knob"
              label={FIELD_LABELS[field]}
              value={formState.defaultTemp}
              min={0}
              max={2}
              step={0.1}
              formatValue={(v) => v.toFixed(1)}
              selected={selected}
              onHover={() => onSelectField(field)}
              onActivate={() =>
                onChange(
                  "defaultTemp",
                  Math.min(
                    2,
                    Math.round((formState.defaultTemp + 0.1) * 10) / 10,
                  ),
                )
              }
              onSetValue={(v) =>
                onChange("defaultTemp", Math.round(v * 10) / 10)
              }
            />
          );
        }
        if (field === "save" || field === "cancel" || field === "delete") {
          if (field === "delete" && mode !== "edit") return null;
          const preview =
            field === "save"
              ? isSaving
                ? "Saving…"
                : "Apply changes"
              : field === "cancel"
                ? "Discard changes"
                : "Remove this model";
          const onActivate = () => {
            if (field === "save") onSubmit();
            else if (field === "cancel") onCancel();
            else if (field === "delete" && onDelete) onDelete();
          };
          return (
            <Row
              key={field}
              kind="action"
              label={FIELD_LABELS[field]}
              preview={preview}
              stacked
              danger={field === "delete"}
              selected={selected}
              onHover={() => onSelectField(field)}
              onActivate={onActivate}
            />
          );
        }
        if (field === "generationMode") {
          return (
            <Row
              key={field}
              kind="pick"
              label={FIELD_LABELS[field]}
              value={fieldValue(field, formState)}
              selected={selected}
              onHover={() => onSelectField(field)}
              onActivate={() => onActivateField(field)}
            />
          );
        }
        const isLocked = field === "id" && mode === "edit";
        return (
          <Row
            key={field}
            kind="pick"
            label={
              FIELD_LABELS[field] + (isLocked ? " (locked)" : "")
            }
            value={fieldValue(field, formState)}
            showAdjust={false}
            selected={selected}
            onHover={() => onSelectField(field)}
            onActivate={() => {
              if (!isLocked) onActivateField(field);
            }}
          />
        );
      })}
      {error && <output className="error-message">{error}</output>}
    </div>
  );
};
