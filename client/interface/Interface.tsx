import { useCallback, useRef, useEffect, useState, useMemo } from "react";

import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useMenuSystem } from "./hooks/useMenuSystem";
import { useStoryTree, INITIAL_STORY } from "./hooks/useStoryTree";
import { useOfflineStatus } from "./hooks/useOfflineStatus";
import { useScrollSync } from "./hooks/useScrollSync";
import { useModels } from "./hooks/useModels";

import { DPad } from "./components/DPad";
import { GamepadButton } from "./components/GamepadButton";
import { MenuButton } from "./components/MenuButton";
import { MenuScreen } from "./components/MenuScreen";
import { NavigationDots } from "./components/NavigationDots";
import { StoryMinimap } from "./components/StoryMinimap";
import { useTheme } from "./components/ThemeToggle";
import {
  ModelEditor,
  type ModelFormState,
  type ModelEditorField,
} from "./components/ModelEditor";

import { SettingsMenu } from "./menus/SettingsMenu";
import { TreeListMenu } from "./menus/TreeListMenu";
import { ModelsMenu } from "./menus/ModelsMenu";
import { EditMenu } from "./menus/EditMenu";
import { InstallPrompt } from "./components/InstallPrompt";
import ModeBar from "./components/ModeBar";
import { splitTextToNodes } from "./utils/textSplitter";
import { scrollElementIntoViewIfNeeded, isAtBottom } from "./utils/scrolling";

import type { StoryNode, MenuType, ModelSortOption } from "./types";
import type { ModelId, ModelConfig } from "../../shared/models";
import { DEFAULT_LENGTH_MODE } from "../../shared/lengthPresets";
import {
  orderKeysReverseChronological,
  getDefaultStoryKey,
  getStoryMeta,
  setStoryMeta,
  touchStoryUpdated,
  touchStoryActive,
} from "./utils/storyMeta";
import {
  downloadStoryThreadText,
  downloadStoryTreeJson,
} from "./utils/storyExport";

const DEFAULT_PARAMS = {
  temperature: 0.7,
  lengthMode: DEFAULT_LENGTH_MODE,
  model: "meta-llama/llama-3.1-405b" as ModelId,
  textSplitting: true,
  autoModeIterations: 0,
};

const createEmptyModelForm = (): ModelFormState => ({
  id: "" as ModelId | "",
  name: "",
  maxTokens: 1024,
  defaultTemp: 0.7,
});

export const GamepadInterface = () => {
  const { isOnline, isOffline, wasOffline } = useOfflineStatus();
  const { theme, setTheme } = useTheme();
  const [lastMapNodeId, setLastMapNodeId] = useState<string | null>(null);

  // (select menu navigation now handled in useMenuSystem)

  const {
    activeMenu,
    setActiveMenu,
    selectedParam,
    setSelectedParam,
    selectedTreeIndex,
    setSelectedTreeIndex,
    selectedTreeColumn,
    setSelectedTreeColumn,
    selectedModelIndex,
    setSelectedModelIndex,
    selectedModelField,
    setSelectedModelField,
    menuParams,
    setMenuParams,
    handleMenuNavigation,
  } = useMenuSystem(DEFAULT_PARAMS);

  const {
    models,
    loading: modelsLoading,
    error: modelsError,
    saving: modelsSaving,
    createModel,
    updateModel,
    deleteModel,
    getModelName,
  } = useModels();

  const [modelSort, setModelSort] = useState<ModelSortOption>("name-asc");
  const [modelForm, setModelForm] = useState<ModelFormState>(() =>
    createEmptyModelForm(),
  );
  const [modelEditorMode, setModelEditorMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingModelId, setEditingModelId] = useState<ModelId | null>(null);
  const [modelFormError, setModelFormError] = useState<string | null>(null);
  const [pendingModelSelection, setPendingModelSelection] =
    useState<ModelId | null>(null);

  const {
    trees,
    currentTreeKey,
    storyTree,
    currentDepth,
    selectedOptions,
    inFlight,
    generatingInfo,
    isGeneratingAt,
    isAnyGenerating,
    error,
    handleStoryNavigation,
    setCurrentTreeKey,
    getCurrentPath,
    getOptionsAtDepth,
    setTrees,
    setStoryTree,
    setSelectionByPath,
  } = useStoryTree(menuParams);

  // Compute reverse-chronologically ordered trees for menus
  const orderedKeys = useMemo(
    () => orderKeysReverseChronological(trees),
    [trees],
  );
  // Use orderedKeys directly where needed; no reordered trees object required

  const sortedModelEntries = useMemo(() => {
    if (!models) return [] as Array<[ModelId, ModelConfig]>;
    const entries = Object.entries(models) as Array<[ModelId, ModelConfig]>;
    const sorted = [...entries].sort((a, b) => {
      const nameA = a[1].name.toLowerCase();
      const nameB = b[1].name.toLowerCase();
      const compare = nameA.localeCompare(nameB);
      return modelSort === "name-desc" ? -compare : compare;
    });
    return sorted;
  }, [models, modelSort]);

  const modelOrder = useMemo(
    () => sortedModelEntries.map(([modelId]) => modelId),
    [sortedModelEntries],
  );

  const modelEditorFields = useMemo<ModelEditorField[]>(() => {
    const base: ModelEditorField[] = [
      "id",
      "name",
      "maxTokens",
      "defaultTemp",
      "save",
      "cancel",
    ];

    if (modelEditorMode === "edit") {
      return [...base, "delete"];
    }

    return base;
  }, [modelEditorMode]);

  const currentModelEditorField =
    modelEditorFields[selectedModelField] ?? modelEditorFields[0] ?? "id";

  // On first load, default to the most recently active story (if any)
  const hasAppliedDefault = useRef(false);

  useEffect(() => {
    if (hasAppliedDefault.current) return;
    const keys = Object.keys(trees);
    if (!keys.length) return;
    const preferred = getDefaultStoryKey(trees) ?? orderedKeys[0];
    if (preferred && currentTreeKey !== preferred) {
      setCurrentTreeKey(preferred);
    }
    if (preferred) touchStoryActive(preferred);
    hasAppliedDefault.current = true;
  }, [trees, orderedKeys, currentTreeKey, setCurrentTreeKey]);

  // Calculate current highlighted node for map
  const highlightedNode = useMemo(() => {
    let node = storyTree.root;
    for (let depth = 0; depth < currentDepth; depth++) {
      const idx = selectedOptions[depth];
      const child = node.continuations?.[idx];
      if (!child) break;
      node = child;
    }
    return node;
  }, [storyTree, currentDepth, selectedOptions]);

  const storyTextRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { queueScroll, cancel } = useScrollSync({
    containerRef: storyTextRef,
    prefersReducedMotion,
    padding: 8,
  });

  const handleNewTree = useCallback(() => {
    const newKey = `Story ${Object.keys(trees).length + 1}`;
    setTrees((prev) => ({
      ...prev,
      [newKey]: INITIAL_STORY,
    }));
    touchStoryActive(newKey);
    setCurrentTreeKey(newKey);
    setActiveMenu(null);
  }, [trees, setTrees, setCurrentTreeKey, setActiveMenu]);

  const handleDeleteTree = useCallback(
    (key: string) => {
      if (window.confirm(`Are you sure you want to delete "${key}"?`)) {
        setTrees((prev) => {
          const newTrees = { ...prev };
          delete newTrees[key];
          return newTrees;
        });
        {
          const meta = getStoryMeta();
          if (meta[key]) {
            delete meta[key];
            setStoryMeta(meta);
          }
        }

        // If we deleted the current tree, switch to another one
        if (key === currentTreeKey) {
          const remaining = orderKeysReverseChronological(trees).filter(
            (k) => k !== key,
          );
          if (remaining.length > 0) {
            setCurrentTreeKey(remaining[0]);
            touchStoryActive(remaining[0]);
          }
        }
      }
    },
    [currentTreeKey, trees, setTrees, setCurrentTreeKey],
  );

  const handleExportTree = useCallback(
    (key: string) => {
      const tree = trees[key];
      if (!tree) return;
      downloadStoryTreeJson(key, tree);
    },
    [trees],
  );

  const handleExportThread = useCallback(
    (key: string) => {
      const tree = trees[key];
      if (!tree) return;
      downloadStoryThreadText(key, tree);
    },
    [trees],
  );

  const handleStoryHighlight = useCallback(
    (index: number, column: number) => {
      setSelectedTreeIndex(index);
      setSelectedTreeColumn(column);
    },
    [setSelectedTreeIndex, setSelectedTreeColumn],
  );

  const cycleModelSort = useCallback((_delta: -1 | 1 = 1) => {
    setModelSort((prev) => {
      if (prev === "name-asc") {
        return "name-desc";
      }
      return "name-asc";
    });
  }, []);

  const handleModelFormChange = useCallback(
    <Key extends keyof ModelFormState>(
      field: Key,
      value: ModelFormState[Key],
    ) => {
      setModelForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const handleStartNewModel = useCallback(() => {
    setModelEditorMode("create");
    setEditingModelId(null);
    setModelForm(createEmptyModelForm());
    setModelFormError(null);
    setSelectedModelField(0);
    setActiveMenu("model-editor");
  }, [setActiveMenu, setSelectedModelField]);

  const handleEditModel = useCallback(
    (modelId: ModelId) => {
      const config = models?.[modelId];
      if (!config) return;
      setModelEditorMode("edit");
      setEditingModelId(modelId);
      setModelForm({
        id: modelId,
        name: config.name,
        maxTokens: config.maxTokens,
        defaultTemp: config.defaultTemp,
      });
      setModelFormError(null);
      setSelectedModelField(0);
      setActiveMenu("model-editor");
    },
    [models, setActiveMenu, setSelectedModelField],
  );

  const showModelsMenu = useCallback(
    (focusModelId?: ModelId | null) => {
      const targetId =
        focusModelId ??
        (models && models[menuParams.model] ? menuParams.model : modelOrder[0]);
      if (targetId) {
        const index = modelOrder.indexOf(targetId);
        if (index >= 0) {
          setSelectedModelIndex(index + 2);
        }
      } else {
        setSelectedModelIndex(1);
      }
      setModelFormError(null);
      setActiveMenu("models");
    },
    [
      menuParams.model,
      modelOrder,
      models,
      setActiveMenu,
      setSelectedModelIndex,
    ],
  );

  const handleCancelModelEdit = useCallback(() => {
    if (modelEditorMode === "edit" && editingModelId && models?.[editingModelId]) {
      const config = models[editingModelId];
      setModelForm({
        id: editingModelId,
        name: config.name,
        maxTokens: config.maxTokens,
        defaultTemp: config.defaultTemp,
      });
    } else {
      setModelForm(createEmptyModelForm());
      setEditingModelId(null);
      setModelEditorMode("create");
    }
    setModelFormError(null);
    showModelsMenu(editingModelId);
  }, [
    editingModelId,
    modelEditorMode,
    models,
    showModelsMenu,
  ]);

  const handleModelEditorHighlight = useCallback(
    (field: ModelEditorField) => {
      const index = modelEditorFields.indexOf(field);
      if (index >= 0) {
        setSelectedModelField(index);
      }
    },
    [modelEditorFields, setSelectedModelField],
  );

  const handleDeleteModel = useCallback(
    async (modelId: ModelId) => {
      const totalModels = models ? Object.keys(models).length : 0;
      if (totalModels <= 1) {
        setModelFormError("At least one model must remain.");
        return;
      }

      const modelName = models?.[modelId]?.name ?? modelId;
      if (!window.confirm(`Delete model "${modelName}"?`)) {
        return;
      }

      try {
        const updated = await deleteModel(modelId);
        setModelFormError(null);

        if (menuParams.model === modelId) {
          const remainingIds = Object.keys(updated) as ModelId[];
          if (remainingIds.length > 0) {
            setMenuParams((prev) => ({ ...prev, model: remainingIds[0] }));
          }
        }

        if (editingModelId === modelId) {
          const remainingEntries = Object.entries(updated) as Array<[
            ModelId,
            ModelConfig,
          ]>;
          if (remainingEntries.length > 0) {
            const [firstId, config] = remainingEntries[0];
            setEditingModelId(firstId);
            setModelEditorMode("edit");
            setModelForm({
              id: firstId,
              name: config.name,
              maxTokens: config.maxTokens,
              defaultTemp: config.defaultTemp,
            });
            setPendingModelSelection(firstId);
            setSelectedModelField(0);
          } else {
            setEditingModelId(null);
            setModelEditorMode("create");
            setModelForm(createEmptyModelForm());
            setSelectedModelField(0);
          }
        }
      } catch (err) {
        setModelFormError(
          err instanceof Error ? err.message : "Failed to delete model",
        );
      }
    },
    [
      deleteModel,
      editingModelId,
      menuParams.model,
      models,
      setMenuParams,
      setPendingModelSelection,
    ],
  );

  const handleSubmitModel = useCallback(async () => {
    const trimmedId = `${modelForm.id ?? ""}`.trim();
    const trimmedName = modelForm.name.trim();
    if (!trimmedId) {
      setModelFormError("Model ID is required.");
      return;
    }
    if (!trimmedName) {
      setModelFormError("Model name is required.");
      return;
    }
    if (!Number.isFinite(modelForm.maxTokens) || modelForm.maxTokens <= 0) {
      setModelFormError("Max tokens must be greater than 0.");
      return;
    }
    if (
      Number.isNaN(modelForm.defaultTemp) ||
      modelForm.defaultTemp < 0 ||
      modelForm.defaultTemp > 2
    ) {
      setModelFormError("Default temperature must be between 0 and 2.");
      return;
    }

    try {
      let nextFocusId: ModelId | null = null;
      if (modelEditorMode === "create") {
        const newId = trimmedId as ModelId;
        await createModel(newId, {
          name: trimmedName,
          maxTokens: modelForm.maxTokens,
          defaultTemp: modelForm.defaultTemp,
        });
        setModelEditorMode("edit");
        setEditingModelId(newId);
        setModelForm({
          id: newId,
          name: trimmedName,
          maxTokens: modelForm.maxTokens,
          defaultTemp: modelForm.defaultTemp,
        });
        setPendingModelSelection(newId);
        setMenuParams((prev) => ({ ...prev, model: newId }));
        nextFocusId = newId;
      } else if (editingModelId) {
        await updateModel(editingModelId, {
          name: trimmedName,
          maxTokens: modelForm.maxTokens,
          defaultTemp: modelForm.defaultTemp,
        });
        setModelForm({
          id: editingModelId,
          name: trimmedName,
          maxTokens: modelForm.maxTokens,
          defaultTemp: modelForm.defaultTemp,
        });
        setPendingModelSelection(editingModelId);
        nextFocusId = editingModelId;
      }
      setModelFormError(null);
      showModelsMenu(nextFocusId);
    } catch (err) {
      setModelFormError(
        err instanceof Error ? err.message : "Failed to save model",
      );
    }
  }, [
    createModel,
    updateModel,
    modelEditorMode,
    modelForm,
    editingModelId,
    setMenuParams,
    showModelsMenu,
  ]);

  const handleModelEditorAdjust = useCallback(
    (field: ModelEditorField, delta: number) => {
      if (field === "maxTokens") {
        setModelForm((prev) => {
          const next = Math.max(1, prev.maxTokens + delta * 64);
          return {
            ...prev,
            maxTokens: next,
          };
        });
        setModelFormError(null);
      } else if (field === "defaultTemp") {
        setModelForm((prev) => {
          const next = Math.max(
            0,
            Math.min(2, Number((prev.defaultTemp + delta * 0.1).toFixed(1))),
          );
          return {
            ...prev,
            defaultTemp: next,
          };
        });
        setModelFormError(null);
      }
    },
    [],
  );

  const handleModelEditorActivate = useCallback(
    (field: ModelEditorField) => {
      switch (field) {
        case "id": {
          if (modelEditorMode === "edit") {
            return;
          }
          const input = window.prompt(
            "Model ID",
            `${modelForm.id ?? "provider/model"}`.trim(),
          );
          if (input === null) return;
          const trimmed = input.trim();
          setModelForm((prev) => ({
            ...prev,
            id: (trimmed as ModelId | "") ?? ("" as ModelId | ""),
          }));
          setModelFormError(null);
          break;
        }
        case "name": {
          const input = window.prompt("Display Name", modelForm.name.trim());
          if (input === null) return;
          const trimmed = input.trim();
          setModelForm((prev) => ({
            ...prev,
            name: trimmed,
          }));
          setModelFormError(null);
          break;
        }
        case "maxTokens": {
          const input = window.prompt("Max Tokens", `${modelForm.maxTokens}`);
          if (input === null) return;
          const parsed = Number.parseInt(input, 10);
          if (!Number.isNaN(parsed) && parsed > 0) {
            setModelForm((prev) => ({
              ...prev,
              maxTokens: parsed,
            }));
            setModelFormError(null);
          } else {
            setModelFormError("Max tokens must be a positive number.");
          }
          break;
        }
        case "defaultTemp": {
          const input = window.prompt(
            "Default Temperature",
            modelForm.defaultTemp.toFixed(1),
          );
          if (input === null) return;
          const parsed = Number.parseFloat(input);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 2) {
            const rounded = Number(parsed.toFixed(1));
            setModelForm((prev) => ({
              ...prev,
              defaultTemp: rounded,
            }));
            setModelFormError(null);
          } else {
            setModelFormError("Temperature must be between 0 and 2.");
          }
          break;
        }
        case "save": {
          void handleSubmitModel();
          break;
        }
        case "cancel": {
          handleCancelModelEdit();
          break;
        }
        case "delete": {
          if (editingModelId) {
            void handleDeleteModel(editingModelId);
          }
          break;
        }
        default:
          break;
      }
    },
    [
      editingModelId,
      handleCancelModelEdit,
      handleDeleteModel,
      handleSubmitModel,
      modelEditorMode,
      modelForm.defaultTemp,
      modelForm.id,
      modelForm.maxTokens,
      modelForm.name,
      setModelForm,
    ],
  );

  useEffect(() => {
    const total = modelOrder.length + 2;
    setSelectedModelIndex((prev) => {
      const maxIndex = Math.max(0, total - 1);
      return prev > maxIndex ? maxIndex : prev;
    });
  }, [modelOrder, setSelectedModelIndex]);

  useEffect(() => {
    if (selectedModelField >= modelEditorFields.length) {
      setSelectedModelField(0);
    }
  }, [
    modelEditorFields,
    selectedModelField,
    setSelectedModelField,
  ]);

  useEffect(() => {
    if (!pendingModelSelection) return;
    const index = modelOrder.indexOf(pendingModelSelection);
    if (index >= 0) {
      setSelectedModelIndex(index + 2);
    }
    setPendingModelSelection(null);
  }, [modelOrder, pendingModelSelection, setSelectedModelIndex]);

  useEffect(() => {
    if (!editingModelId) return;
    const index = modelOrder.indexOf(editingModelId);
    if (index >= 0) {
      setSelectedModelIndex((prev) =>
        prev === index + 2 ? prev : index + 2,
      );
    }
  }, [editingModelId, modelOrder, setSelectedModelIndex]);

  useEffect(() => {
    if (!models) return;
    if (editingModelId && !models[editingModelId]) {
      const fallbackId = modelOrder[0];
      if (fallbackId) {
        handleEditModel(fallbackId);
        const index = modelOrder.indexOf(fallbackId);
        if (index >= 0) {
          setSelectedModelIndex(index + 2);
        }
      } else {
        handleStartNewModel();
      }
    }
  }, [
    editingModelId,
    handleEditModel,
    handleStartNewModel,
    modelOrder,
    models,
    setSelectedModelIndex,
  ]);

  useEffect(() => {
    if (!models) return;
    if (!models[menuParams.model]) {
      const fallbackId = modelOrder[0];
      if (fallbackId) {
        setMenuParams((prev) => ({ ...prev, model: fallbackId }));
      }
    }
  }, [models, menuParams.model, modelOrder, setMenuParams]);

  const handleControlAction = useCallback(
    async (key: string) => {
      if (activeMenu === "edit") {
        // Let EditMenu handle keyboard events, but also handle button clicks
        if (key === "Escape" || key === "`") {
          // Simulate keyboard event for the EditMenu
          window.dispatchEvent(new KeyboardEvent("keydown", { key }));
        }
        return;
      }

      if (activeMenu === "map") {
        // In map mode, navigation and generation work normally
        if (key === "Backspace") {
          // B button exits map and goes to edit mode
          setLastMapNodeId(highlightedNode.id);
          setActiveMenu("edit");
          return;
        } else if (key === "`") {
          // SELECT from map opens story list
          // Set selection to current story on open (reverse-chronological order)
          const currentIndex = Math.max(0, orderedKeys.indexOf(currentTreeKey));
          setSelectedTreeIndex(currentIndex + 1); // +1 for "+ New Story"
          setSelectedTreeColumn(0);
          setLastMapNodeId(highlightedNode.id);
          setActiveMenu("start");
          return;
        } else if (key === "Escape") {
          // START toggles map off back to reading
          setLastMapNodeId(highlightedNode.id);
          setActiveMenu(null);
          // Align LOOM on reveal
          requestAnimationFrame(() => {
            queueScroll({
              nodeId: highlightedNode.id,
              reason: "mode-exit-map",
              priority: 90,
            });
          });
          return;
        }
        // Let arrow keys and Enter fall through to story navigation
      }

      if (activeMenu === "model-editor") {
        handleMenuNavigation(key, trees, {
          modelEditorFields,
          onModelEditorEnter: handleModelEditorActivate,
          onModelEditorAdjust: handleModelEditorAdjust,
          onModelEditorBack: handleCancelModelEdit,
          onModelEditorHighlight: handleModelEditorHighlight,
        });

        if (key === "Escape") {
          showModelsMenu(editingModelId);
        }
        return;
      }

      if (activeMenu === "select") {
        handleMenuNavigation(key, trees, {
          onNewTree: () => {
            handleNewTree();
            setSelectedTreeColumn(0);
          },
          onSelectTree: (key) => {
            touchStoryActive(key);
            setCurrentTreeKey(key);
            setActiveMenu(null);
            setSelectedTreeColumn(0);
          },
          onDeleteTree: (key) => {
            handleDeleteTree(key);
            setSelectedTreeColumn(0);
          },
          onExportTreeJson: handleExportTree,
          onExportTreeThread: handleExportThread,
          currentTheme: theme,
          onThemeChange: setTheme,
          modelOrder,
          onManageModels: () => showModelsMenu(),
        });
      } else if (activeMenu === "models") {
        handleMenuNavigation(key, trees, {
          modelOrder,
          onNewModel: () => {
            handleStartNewModel();
          },
          onEditModel: (modelId) => {
            handleEditModel(modelId);
          },
          onDeleteModel: (modelId) => {
            handleDeleteModel(modelId);
          },
          onToggleModelSort: cycleModelSort,
        });

        if (key === "Escape") {
          setActiveMenu("select");
          return;
        }

        if (key === "`") {
          if (selectedModelIndex !== 0) {
            setActiveMenu("select");
          }
          return;
        }
      } else if (activeMenu && activeMenu !== "map") {
        handleMenuNavigation(key, trees, {
          onNewTree: () => {
            handleNewTree();
            setSelectedTreeColumn(0);
          },
          onSelectTree: (key) => {
            touchStoryActive(key);
            setCurrentTreeKey(key);
            setActiveMenu(null);
            setSelectedTreeColumn(0);
          },
          onDeleteTree: (key) => {
            handleDeleteTree(key);
            setSelectedTreeColumn(0);
          },
          onExportTreeJson: handleExportTree,
          onExportTreeThread: handleExportThread,
        });
        // Allow START to back out from Trees to Map
        if (activeMenu === "start" && key === "Escape") {
          setActiveMenu("map");
          return;
        }
      } else {
        await handleStoryNavigation(key);
      }

      // Handle menu activation/deactivation with zoom-out flow
      if (key === "`") {
        // On Stories screen, SELECT returns to map
        if (activeMenu === "start") {
          setActiveMenu("map");
        } else if (activeMenu !== "map") {
          // Elsewhere, SELECT toggles Settings; keep last focused row
          if (activeMenu === "select") {
            setActiveMenu(null);
          } else {
            setActiveMenu("select");
          }
        }
      } else if (key === "Escape" && !activeMenu) {
        // START toggles minimap on when reading
        setActiveMenu("map");
      } else if (key === "Escape" && activeMenu === "map") {
        // START toggles minimap off when in map
        setLastMapNodeId(highlightedNode.id);
        setActiveMenu(null);
        // Align LOOM on reveal
        requestAnimationFrame(() => {
          queueScroll({
            nodeId: highlightedNode.id,
            reason: "mode-exit-map",
            priority: 90,
          });
        });
      } else if (key === "Backspace" && !activeMenu) {
        setActiveMenu("edit");
      }
    },
    [
      activeMenu,
      trees,
      handleMenuNavigation,
      handleNewTree,
      handleDeleteTree,
      handleDeleteModel,
      handleEditModel,
      handleStartNewModel,
      handleCancelModelEdit,
      handleModelEditorActivate,
      handleModelEditorAdjust,
      handleModelEditorHighlight,
      handleStoryNavigation,
      setCurrentTreeKey,
      setActiveMenu,
      setSelectedTreeIndex,
      setSelectedTreeColumn,
      modelOrder,
      modelEditorFields,
      cycleModelSort,
      selectedModelIndex,
      editingModelId,
      highlightedNode,
      showModelsMenu,
      theme,
      setTheme,
      handleExportTree,
      handleExportThread,
    ],
  );

  const { activeControls, handleControlPress, handleControlRelease } =
    useKeyboardControls(handleControlAction);

  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    const checkLayout = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const aspectRatio = clientWidth / clientHeight;
        setLayout(aspectRatio >= 1.33 ? "landscape" : "portrait");
      }
    };

    // Use ResizeObserver for more efficient layout checks
    const resizeObserver = new ResizeObserver(checkLayout);
    const currentContainer = containerRef.current;

    if (currentContainer) {
      resizeObserver.observe(currentContainer);
      checkLayout(); // Initial check
    }

    return () => {
      if (currentContainer) {
        resizeObserver.unobserve(currentContainer);
      }
    };
  }, []);

  // Helper: scroll a specific rendered node into view within the story container
  const scrollNodeIntoView = useCallback(
    (nodeId: string | undefined | null) => {
      const container = storyTextRef.current;
      if (!container || !nodeId) return;
      const el = container.querySelector(
        `[data-node-id="${nodeId}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      // Use a small edge buffer, but only scroll when offscreen
      scrollElementIntoViewIfNeeded(container, el, 8, "smooth");
    },
    [],
  );

  // Scroll to current depth when navigation changes
  useEffect(() => {
    if (!activeMenu) {
      const path = getCurrentPath();
      const current = path[currentDepth];
      if (current) {
        queueScroll({
          nodeId: current.id,
          reason: "nav-up-down",
          priority: 100,
        });
      }
    }
  }, [currentDepth, getCurrentPath, activeMenu, scrollNodeIntoView]);

  // Scroll to selected sibling when left/right navigation changes
  useEffect(() => {
    if (!activeMenu) {
      const path = getCurrentPath();
      const next = path[currentDepth + 1];
      if (next) {
        queueScroll({
          nodeId: next.id,
          align: "top",
          reason: "nav-left-right",
          priority: 110,
        });
      }
    }
  }, [
    selectedOptions,
    getCurrentPath,
    activeMenu,
    currentDepth,
    scrollNodeIntoView,
  ]);

  // Scroll to end when new content is added (after text splitting or generation)
  useEffect(() => {
    if (storyTextRef.current && !isAnyGenerating && !activeMenu) {
      const container = storyTextRef.current;
      const path = getCurrentPath();
      const wasAtBottom = isAtBottom(container);

      // If user was at bottom or near end, scroll to show new content
      if (wasAtBottom) {
        const last = path[path.length - 1];
        if (last) {
          queueScroll({
            nodeId: last.id,
            reason: "generation",
            priority: 50,
          });
        }
      }
    }
  }, [storyTree, isAnyGenerating, getCurrentPath]);

  // Removed LOOM scroll preservation to keep behavior simple and reliable

  const renderStoryText = () => {
    const currentPath = getCurrentPath();

    return (
      <div ref={storyTextRef} className="story-text view-fade">
        {currentPath.map((segment, index) => {
          const isCurrentDepth = index === currentDepth;
          const isNextDepth = index === currentDepth + 1;
          const isLoading = isGeneratingAt(segment.id);

          return (
            <span
              key={segment.id}
              data-node-id={segment.id}
              style={{
                color: isCurrentDepth
                  ? "var(--font-color)"
                  : isNextDepth
                    ? "var(--primary-color)"
                    : "var(--secondary-color)",
              }}
              className={isLoading ? "opacity-50" : ""}
            >
              {segment.text}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <main className="terminal" aria-label="Story Interface">
      <InstallPrompt />
      <div ref={containerRef} className={`container ${layout}`}>
        {/* Screen area */}
        <section className="terminal-screen" aria-label="Story Display">
          {/* Unified top mode bar */}
          {(() => {
            const map: Record<MenuType, { title: string; hint: string }> & {
              null: { title: string; hint: string };
            } = {
              null: { title: "LOOM", hint: "START: MAP • SELECT: SETTINGS" },
              map: { title: "MAP", hint: "SELECT: STORIES • START: LOOM" },
              select: { title: "SETTINGS", hint: "START: CLOSE" },
              start: {
                title: "STORIES",
                hint: "↵: OPEN • ⌫: DELETE • START: MAP",
              },
              models: {
                title: "MODELS",
                hint: "↵: EDIT • ⌫: DELETE • SELECT: SETTINGS",
              },
              edit: { title: "EDIT", hint: "SELECT: CANCEL • START: SAVE" },
            } as const;
            const key = (activeMenu ?? "null") as keyof typeof map;
            const entry = map[key];
            return entry ? (
              <ModeBar title={entry.title} hint={entry.hint} />
            ) : null;
          })()}
          {activeMenu === "select" ? (
            <>
              <MenuScreen>
                <SettingsMenu
                  params={{ ...menuParams, theme }}
                  onParamChange={(param, value) => {
                    if (param === "theme") {
                      setTheme(value as "matrix" | "light" | "system");
                    } else {
                      setMenuParams((prev) => ({ ...prev, [param]: value }));
                    }
                  }}
                  selectedParam={selectedParam}
                  isLoading={isAnyGenerating}
                  models={models}
                  modelsLoading={modelsLoading}
                  modelsError={modelsError}
                  getModelName={getModelName}
                  onManageModels={() => showModelsMenu()}
                />
              </MenuScreen>
            </>
          ) : activeMenu === "map" ? (
            <StoryMinimap
              tree={storyTree}
              currentDepth={currentDepth}
              selectedOptions={selectedOptions}
              currentPath={getCurrentPath()}
              inFlight={inFlight}
              generatingInfo={generatingInfo}
              onSelectNode={(path) => {
                setSelectionByPath(path);
                setActiveMenu(null);
                requestAnimationFrame(() => {
                  const last = path[path.length - 1];
                  if (last) {
                    queueScroll({
                      nodeId: last.id,
                      reason: "map-select",
                      priority: 90,
                    });
                  }
                });
              }}
              isVisible={activeMenu === "map"}
              lastMapNodeId={lastMapNodeId}
              currentNodeId={highlightedNode.id}
            />
          ) : activeMenu === "start" ? (
            <>
              <MenuScreen>
                <TreeListMenu
                  trees={trees}
                  selectedIndex={selectedTreeIndex}
                  selectedColumn={selectedTreeColumn}
                  onSelect={(key) => {
                    touchStoryActive(key);
                    setCurrentTreeKey(key);
                    setActiveMenu(null);
                    setSelectedTreeColumn(0);
                  }}
                  onNew={() => {
                    handleNewTree();
                    setSelectedTreeColumn(0);
                  }}
                  onDelete={(key) => {
                    handleDeleteTree(key);
                    // Adjust selected index if needed
                    if (selectedTreeIndex > 0) {
                      setSelectedTreeIndex((prev) =>
                        Math.min(prev, Object.keys(trees).length - 1),
                      );
                      setSelectedTreeColumn(0);
                    }
                  }}
                  onExportJson={handleExportTree}
                  onExportThread={handleExportThread}
                  onHighlight={handleStoryHighlight}
                />
              </MenuScreen>
            </>
          ) : activeMenu === "models" ? (
            <MenuScreen>
              <ModelsMenu
                modelEntries={sortedModelEntries}
                selectedIndex={selectedModelIndex}
                sortOrder={modelSort}
                onToggleSort={cycleModelSort}
                onSelectIndex={setSelectedModelIndex}
                onNew={handleStartNewModel}
                onEditModel={handleEditModel}
                isLoading={modelsLoading || modelsSaving}
                error={modelsError ?? undefined}
              />
            </MenuScreen>
          ) : activeMenu === "model-editor" ? (
            <MenuScreen>
              <ModelEditor
                formState={modelForm}
                fields={modelEditorFields}
                selectedField={currentModelEditorField}
                onSelectField={handleModelEditorHighlight}
                onActivateField={handleModelEditorActivate}
                onChange={handleModelFormChange}
                onSubmit={handleSubmitModel}
                onCancel={handleCancelModelEdit}
                onDelete={
                  modelEditorMode === "edit" && editingModelId
                    ? () => {
                        void handleDeleteModel(editingModelId);
                      }
                    : undefined
                }
                mode={modelEditorMode}
                isSaving={modelsSaving}
                error={modelFormError}
              />
            </MenuScreen>
          ) : activeMenu === "edit" ? (
            <MenuScreen>
              <EditMenu
                node={getCurrentPath()[currentDepth]}
                onSave={(text) => {
                  const newTree = JSON.parse(JSON.stringify(storyTree)) as {
                    root: StoryNode;
                  };
                  let current = newTree.root;

                  for (let i = 1; i <= currentDepth; i++) {
                    if (!current.continuations) break;
                    current = current.continuations[selectedOptions[i - 1]];
                  }

                  // Conditionally split the edited text based on settings
                  if (menuParams.textSplitting) {
                    const nodeChain = splitTextToNodes(text);

                    if (nodeChain) {
                      // Replace current node with the head of the chain
                      current.text = nodeChain.text;

                      // Preserve existing continuations by attaching them to the end of the chain
                      const existingContinuations = current.continuations || [];

                      // Walk to the end of the new chain
                      let chainEnd = nodeChain;
                      while (
                        chainEnd.continuations &&
                        chainEnd.continuations.length > 0
                      ) {
                        chainEnd = chainEnd.continuations[0];
                      }

                      // Attach existing continuations to the end of the chain
                      chainEnd.continuations = existingContinuations;

                      // Replace the current node's continuations with the new chain
                      current.continuations = nodeChain.continuations;
                      if (nodeChain.lastSelectedIndex !== undefined) {
                        current.lastSelectedIndex = nodeChain.lastSelectedIndex;
                      }
                    } else {
                      // Fallback to simple text replacement if splitting fails
                      current.text = text;
                    }
                  } else {
                    // Simple text replacement when splitting is disabled
                    current.text = text;
                  }

                  setStoryTree(newTree);
                  // Mark story as updated for reverse-chronological order
                  touchStoryUpdated(currentTreeKey);
                  setActiveMenu(null);

                  // Align to end of updated content after text splitting
                  requestAnimationFrame(() => {
                    const path = getCurrentPath();
                    const last = path[path.length - 1];
                    if (last) {
                      queueScroll({
                        nodeId: last.id,
                        reason: "edit-save",
                        priority: 60,
                      });
                    }
                  });
                }}
                onCancel={() => setActiveMenu(null)}
              />
            </MenuScreen>
          ) : null}

          {/* Keep LOOM mounted; hide when a menu is active. Use display: contents to preserve flex context */}
          <div style={{ display: activeMenu ? "none" : ("contents" as const) }}>
            {renderStoryText()}
            <NavigationDots
              options={getOptionsAtDepth(currentDepth)}
              currentDepth={currentDepth}
              selectedOptions={selectedOptions}
              activeControls={activeControls}
              inFlight={inFlight}
              generatingInfo={generatingInfo}
            />
            {isOffline && (
              <output className="offline-message">
                ⚡ Offline - Stories saved locally, generation unavailable
              </output>
            )}
            {error && (
              <output className="error-message">
                Generation error: {error.message}
              </output>
            )}
          </div>
        </section>

        {/* Controls */}
        <div className="terminal-controls" aria-label="Game Controls">
          <div className="controls-top">
            <DPad
              activeDirection={activeControls.direction}
              onControlPress={handleControlPress}
              onControlRelease={handleControlRelease}
            />
            <div className="terminal-buttons">
              <GamepadButton
                label="⌫"
                active={activeControls.b}
                onMouseDown={() => handleControlPress("Backspace")}
                onMouseUp={() => handleControlRelease("Backspace")}
              />
              <GamepadButton
                label="↵"
                active={activeControls.a}
                onMouseDown={() => handleControlPress("Enter")}
                onMouseUp={() => handleControlRelease("Enter")}
                disabled={
                  isOffline ||
                  isGeneratingAt(getCurrentPath()[currentDepth]?.id)
                }
              />
            </div>
          </div>

          <div className="terminal-menu">
            <MenuButton
              label="SELECT"
              active={activeControls.select}
              onMouseDown={() => handleControlPress("`")}
              onMouseUp={() => handleControlRelease("`")}
            />
            <MenuButton
              label="START"
              active={activeControls.start}
              onMouseDown={() => handleControlPress("Escape")}
              onMouseUp={() => handleControlRelease("Escape")}
            />
          </div>
        </div>
      </div>
    </main>
  );
};

export default GamepadInterface;
