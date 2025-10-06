import type { ModelId } from "../../../shared/models";

export interface ModelFormState {
  id: ModelId | "";
  name: string;
  maxTokens: number;
  defaultTemp: number;
}

interface ModelEditorProps {
  formState: ModelFormState;
  onChange: <Key extends keyof ModelFormState>(field: Key, value: ModelFormState[Key]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  mode: "create" | "edit";
  isSaving?: boolean;
  error?: string | null;
}

export const ModelEditor = ({
  formState,
  onChange,
  onSubmit,
  onCancel,
  mode,
  isSaving = false,
  error,
}: ModelEditorProps) => {
  const handleNumberChange = (
    field: "maxTokens" | "defaultTemp",
    value: string,
  ) => {
    if (field === "maxTokens") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        onChange(field, parsed);
      } else if (value === "") {
        onChange(field, 0 as ModelFormState[typeof field]);
      }
    } else {
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed)) {
        onChange(field, parsed);
      } else if (value === "") {
        onChange(field, 0 as ModelFormState[typeof field]);
      }
    }
  };

  return (
    <form
      className="model-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="model-editor__title">
        {mode === "create" ? "New Model" : "Edit Model"}
      </h2>
      <label className="model-editor__label" htmlFor="model-id">
        Model ID
      </label>
      <input
        id="model-id"
        className="model-editor__input"
        type="text"
        value={formState.id}
        onChange={(event) => onChange("id", event.target.value as ModelId | "")}
        placeholder="provider/model"
        required
        disabled={mode === "edit"}
      />

      <label className="model-editor__label" htmlFor="model-name">
        Display Name
      </label>
      <input
        id="model-name"
        className="model-editor__input"
        type="text"
        value={formState.name}
        onChange={(event) => onChange("name", event.target.value)}
        placeholder="Friendly name"
        required
      />

      <label className="model-editor__label" htmlFor="model-max-tokens">
        Max Tokens
      </label>
      <input
        id="model-max-tokens"
        className="model-editor__input"
        type="number"
        min={1}
        step={1}
        value={formState.maxTokens}
        onChange={(event) => handleNumberChange("maxTokens", event.target.value)}
        required
      />

      <label className="model-editor__label" htmlFor="model-default-temp">
        Default Temperature
      </label>
      <input
        id="model-default-temp"
        className="model-editor__input"
        type="number"
        min={0}
        max={2}
        step={0.1}
        value={formState.defaultTemp}
        onChange={(event) => handleNumberChange("defaultTemp", event.target.value)}
        required
      />

      {error && <output className="error-message model-editor__error">{error}</output>}

      <div className="model-editor__actions">
        <button type="submit" className="model-editor__submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="model-editor__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};
