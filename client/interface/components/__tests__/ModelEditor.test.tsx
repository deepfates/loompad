import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ModelEditor, type ModelFormState } from "../ModelEditor";

const form: ModelFormState = {
  id: "anthropic/claude-opus-5",
  name: "Claude Opus 5",
  maxTokens: 1024,
  defaultTemp: 0.7,
  generationMode: "instruction",
};

describe("ModelEditor", () => {
  it("uses an inline model ID input instead of window.prompt", () => {
    const html = renderToStaticMarkup(
      <ModelEditor
        formState={form}
        fields={["id", "name", "save"]}
        selectedField="id"
        editingField="id"
        onSelectField={() => {}}
        onActivateField={() => {}}
        onFinishEditing={() => {}}
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        mode="create"
      />,
    );

    expect(html).toContain('aria-label="Model ID"');
    expect(html).toContain('value="anthropic/claude-opus-5"');
  });

  it("keeps a saved model ID locked during editing", () => {
    const html = renderToStaticMarkup(
      <ModelEditor
        formState={form}
        fields={["id", "name", "save"]}
        selectedField="id"
        editingField={null}
        onSelectField={() => {}}
        onActivateField={() => {}}
        onFinishEditing={() => {}}
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
        mode="edit"
      />,
    );

    expect(html).toContain("Model ID (locked)");
    expect(html).not.toContain('aria-label="Model ID"');
  });
});
