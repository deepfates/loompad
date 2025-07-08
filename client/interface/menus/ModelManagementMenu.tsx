import { useState, useEffect } from "react";
import { useModels } from "../hooks/useModels";
import type { ModelConfig } from "../../../server/apis/generation";

interface ModelManagementMenuProps {
  selectedIndex: number;
  onNavigate: (direction: "up" | "down") => void;
  onAction: (action: "add" | "edit" | "delete", modelId?: string) => void;
}

export const ModelManagementMenu = ({
  selectedIndex,
  onNavigate,
  onAction,
}: ModelManagementMenuProps) => {
  const { models, loading, error, addModel, updateModel, deleteModel } = useModels();
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ModelConfig> & { id: string; modelId: string }>({
    id: "",
    name: "",
    modelId: "",
    maxTokens: 1024,
    defaultTemp: 0.7,
    baseURL: "",
    apiKey: "",
  });

  // All helper functions are declared as regular functions so they are hoisted
  // and can be used by the useEffect hook above the main return.

  function resetForm() {
    setFormData({
      id: "",
      name: "",
      modelId: "",
      maxTokens: 1024,
      defaultTemp: 0.7,
      baseURL: "",
      apiKey: "",
    });
  }

  function handleAddModel() {
    resetForm();
    setIsAddingModel(true);
  }

  function handleEditModel(modelId: string) {
    if (!models) return;
    const model = models[modelId];
    if (model) {
      setFormData({
        id: modelId,
        name: model.name,
        modelId: model.id,
        maxTokens: model.maxTokens,
        defaultTemp: model.defaultTemp,
        baseURL: model.baseURL || "",
        apiKey: model.apiKey || "",
      });
      setIsEditingModel(modelId);
    }
  }

  async function handleDeleteModel(modelId: string) {
    if (!models) return;
    if (window.confirm(`Are you sure you want to delete the model "${models[modelId]?.name}"?`)) {
      await deleteModel(modelId);
    }
  }

  // This function is called by the keyboard event listener
  function handleMenuAction(action: "enter" | "delete") {
    if (!models) return;
    const modelEntries = Object.entries(models);

    if (selectedIndex === modelEntries.length) {
      if (action === "enter") handleAddModel();
    } else if (selectedIndex < modelEntries.length) {
      const [modelId] = modelEntries[selectedIndex];
      if (action === "enter") {
        handleEditModel(modelId);
      } else if (action === "delete") {
        handleDeleteModel(modelId);
      }
    }
  }

  // Keyboard event handling hook is now at the top
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isAddingModel || isEditingModel) return; // Don't interfere with form input

      if (e.key === "Enter") {
        handleMenuAction("enter");
      } else if (e.key === "Backspace") {
        handleMenuAction("delete");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedIndex, models, isAddingModel, isEditingModel]);

  if (loading) {
    return (
      <div className="menu-content">
        <div className="menu-instructions">Loading models...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="menu-content">
        <div className="error-message">Error loading models: {error}</div>
      </div>
    );
  }

  async function handleSaveModel() {
    if (!formData.id || !formData.name || !formData.modelId) {
      alert("Please fill in all required fields (ID, Name, Model ID)");
      return;
    }

    // Ensure all required fields are present
    const modelData = {
      id: formData.id,
      name: formData.name,
      modelId: formData.modelId,
      maxTokens: formData.maxTokens || 1024,
      defaultTemp: formData.defaultTemp || 0.7,
      baseURL: formData.baseURL || "",
      apiKey: formData.apiKey || "",
    };

    const success = isEditingModel
      ? await updateModel(isEditingModel, modelData)
      : await addModel(modelData);

    if (success) {
      setIsAddingModel(false);
      setIsEditingModel(null);
      resetForm();
    }
  }

  function handleCancelForm() {
    setIsAddingModel(false);
    setIsEditingModel(null);
    resetForm();
  }

  const modelEntries = models ? Object.entries(models) : [];

  if (isAddingModel || isEditingModel) {
    return (
      <div className="menu-content">
        <div className="menu-instructions">
          {isAddingModel ? "Add New Model" : "Edit Model"}
        </div>
        <div className="model-form">
          <div className="form-field">
            <label>Model ID: *</label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="unique-model-id"
              disabled={!!isEditingModel}
            />
          </div>
          <div className="form-field">
            <label>Display Name: *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Custom Model"
            />
          </div>
          <div className="form-field">
            <label>API Model ID: *</label>
            <input
              type="text"
              value={formData.modelId}
              onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
              placeholder="gpt-4"
            />
          </div>
          <div className="form-field">
            <label>Base URL:</label>
            <input
              type="text"
              value={formData.baseURL}
              onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="form-field">
            <label>API Key:</label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
          <div className="form-field">
            <label>Max Tokens:</label>
            <input
              type="number"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 1024 })}
            />
          </div>
          <div className="form-field">
            <label>Default Temperature:</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={formData.defaultTemp}
              onChange={(e) => setFormData({ ...formData, defaultTemp: parseFloat(e.target.value) || 0.7 })}
            />
          </div>
          <div className="form-actions">
            <button onClick={handleSaveModel}>
              {isAddingModel ? "Add Model" : "Save Changes"}
            </button>
            <button onClick={handleCancelForm}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-content">
      <div className="menu-instructions">
        Use ↑/↓ to navigate, ↵ to edit, ⌫ to delete
      </div>
      
      {modelEntries.map(([modelId, config], index) => (
        <div
          key={modelId}
          className={`menu-item ${selectedIndex === index ? "selected" : ""}`}
        >
          <div className="menu-item-label">
            {config.name}
            {config.baseURL && config.baseURL !== "https://api.openai.com/v1" && (
              <span className="model-custom-indicator"> (Custom)</span>
            )}
          </div>
          <div className="menu-item-preview">
            Model: {config.id} | Max Tokens: {config.maxTokens} | Temp: {config.defaultTemp}
            {config.baseURL && (
              <div>URL: {config.baseURL}</div>
            )}
          </div>
        </div>
      ))}

      <div
        className={`menu-item ${selectedIndex === modelEntries.length ? "selected" : ""}`}
      >
        <div className="menu-item-label">+ Add New Model</div>
        <div className="menu-item-preview">Create a custom model configuration</div>
      </div>
    </div>
  );
}; 