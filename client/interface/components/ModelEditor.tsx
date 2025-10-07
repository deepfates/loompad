import { MenuKnob } from "./MenuKnob";
import type { ModelId } from "../../../shared/models";

export interface ModelFormState {
  id: ModelId | "";
  name: string;
  maxTokens: number;
  defaultTemp: number;
}

export type ModelEditorField =
  | "id"
  | "name"
  | "maxTokens"
  | "defaultTemp"
  | "save"
  | "cancel"
  | "delete";

interface ModelEditorProps {
  formState: ModelFormState;
  fields: ModelEditorField[];
  selectedField: ModelEditorField;
  onSelectField: (field: ModelEditorField) => void;
  onActivateField: (field: ModelEditorField) => void;
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

const SORTABLE_FIELDS: Record<ModelEditorField, string> = {
  id: "Model ID",
  name: "Display Name",
  maxTokens: "Max Tokens",
  defaultTemp: "Default Temperature",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
};

const formatFieldValue = (
  field: ModelEditorField,
  formState: ModelFormState,
) => {
  switch (field) {
    case "id":
      return formState.id || "provider/model";
    case "name":
      return formState.name || "Friendly name";
    case "maxTokens":
      return `${formState.maxTokens}`;
    case "defaultTemp":
      return formState.defaultTemp.toFixed(1);
    default:
      return "";
  }
};

export const ModelEditor = ({
  formState,
  fields,
  selectedField,
  onSelectField,
  onActivateField,
  onChange,
  onSubmit,
  onCancel,
  onDelete,
  mode,
  isSaving = false,
  error,
}: ModelEditorProps) => {
  return (
    <div className="menu-content model-editor-menu">
      <div className="model-editor-menu__header">
        <h2 className="model-editor-menu__title">
          {mode === "create" ? "New Model" : "Edit Model"}
        </h2>
        <p className="model-editor-menu__hint">
          Use ▲▼ to choose a field. Press A to edit text, ◄► to adjust numbers, and START to
          return to the list.
        </p>
      </div>

      {fields.map((field) => {
        if (field === "maxTokens" || field === "defaultTemp") {
          const min = field === "maxTokens" ? 1 : 0;
          const max = field === "maxTokens" ? 32768 : 2;
          const step = field === "maxTokens" ? 1 : 0.1;
          return (
            <div
              key={field}
              className="model-editor-menu__knob"
              onMouseEnter={() => onSelectField(field)}
            >
              <MenuKnob
                label={SORTABLE_FIELDS[field]}
                value={formState[field] as number}
                min={min}
                max={max}
                step={step}
                onChange={(value) =>
                  onChange(field, value as ModelFormState[typeof field])
                }
                selected={selectedField === field}
              />
            </div>
          );
        }

        if (field === "save" || field === "cancel" || field === "delete") {
          const isDelete = field === "delete";
          const isSelected = selectedField === field;
          const label = SORTABLE_FIELDS[field];
          const isDisabled = field === "delete" && mode !== "edit";
          const handleActivate = () => {
            if (field === "save") {
              onSubmit();
            } else if (field === "cancel") {
              onCancel();
            } else if (field === "delete" && onDelete) {
              onDelete();
            }
          };

          if (isDisabled) {
            return null;
          }

          return (
            <div
              key={field}
              className={`menu-item model-editor-menu__action ${
                isSelected ? "selected" : ""
              } ${isDelete ? "danger" : ""}`}
              role="button"
              tabIndex={0}
              onMouseEnter={() => onSelectField(field)}
              onClick={() => handleActivate()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleActivate();
                }
              }}
            >
              <div className="menu-item-label">{label}</div>
              <div className="menu-item-preview">
                {field === "save"
                  ? isSaving
                    ? "Saving…"
                    : "Apply changes"
                  : field === "cancel"
                    ? "Discard changes"
                    : "Remove this model"}
              </div>
            </div>
          );
        }

        const isLocked = field === "id" && mode === "edit";
        const isSelected = selectedField === field;
        const value = formatFieldValue(field, formState);

        return (
          <div
            key={field}
            className={`menu-item model-editor-menu__field ${
              isSelected ? "selected" : ""
            } ${isLocked ? "locked" : ""}`}
            role={isLocked ? undefined : "button"}
            tabIndex={isLocked ? -1 : 0}
            aria-disabled={isLocked}
            onMouseEnter={() => onSelectField(field)}
            onClick={() => {
              if (!isLocked) {
                onActivateField(field);
              }
            }}
            onKeyDown={(event) => {
              if (isLocked) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivateField(field);
              }
            }}
          >
            <div className="menu-item-label">
              {SORTABLE_FIELDS[field]}
              {isLocked ? " (locked)" : ""}
            </div>
            <div className="menu-item-preview">{value}</div>
          </div>
        );
      })}

      {error && <output className="error-message">{error}</output>}
    </div>
  );
};
