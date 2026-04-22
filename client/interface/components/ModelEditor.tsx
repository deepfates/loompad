import type { ModelId } from "../../../shared/models";
import { Row } from "./Row";

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

const FIELD_LABELS: Record<ModelEditorField, string> = {
  id: "Model ID",
  name: "Display Name",
  maxTokens: "Max Tokens",
  defaultTemp: "Default Temp",
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
    <div className="menu-content">
      {fields.map((field) => {
        const selected = selectedField === field;

        if (field === "maxTokens") {
          return (
            <Row
              key={field}
              kind="knob"
              label={FIELD_LABELS[field]}
              value={formState.maxTokens}
              min={1}
              max={32768}
              formatValue={(v) => String(Math.round(v))}
              selected={selected}
              onHover={() => onSelectField(field)}
              onActivate={() =>
                onChange("maxTokens", Math.min(32768, formState.maxTokens + 64))
              }
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
