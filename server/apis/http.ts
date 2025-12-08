import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import nocache from "nocache";
import express, { Application } from "express";
import { getMainProps } from "server/main_props";
import { generateText } from "./generation";
import { judgeContinuation } from "./judge";
import {
  getModels,
  createModel,
  updateModel,
  deleteModel,
} from "../modelsStore";
import type { ModelConfig } from "../../shared/models";
import {
  createChildHandler,
  createStoryHandler,
  getNodeHandler,
  getStoryHandler,
  getWindowHandler,
  listStoriesHandler,
  updateNodeHandler,
} from "./stories";

export function setup_routes(app: Application) {
  // Scope API middleware to /api to avoid affecting static/SSR caching
  app.use("/api", cors());
  app.use("/api", express.json());
  app.use("/api", cookieParser());
  app.use("/api", nocache());
  app.use("/api", compression());

  app.get("/api/props", async (req, res) => {
    const top_level_state = await getMainProps(req);
    res.json(top_level_state);
  });

  // Text generation endpoints
  app.post("/api/generate", generateText);
  app.post("/api/judge", judgeContinuation);

  // Get available models
  app.get("/api/models", (req, res) => {
    res.json(getModels());
  });

  app.post("/api/models", (req, res) => {
    const { id, name, maxTokens, defaultTemp } = req.body ?? {};
    if (typeof id !== "string" || !id.trim()) {
      return res.status(400).json({ error: "Model ID is required" });
    }
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Model name is required" });
    }
    if (
      typeof maxTokens !== "number" ||
      !Number.isFinite(maxTokens) ||
      maxTokens <= 0 ||
      !Number.isInteger(maxTokens)
    ) {
      return res
        .status(400)
        .json({ error: "maxTokens must be a positive integer" });
    }
    if (
      typeof defaultTemp !== "number" ||
      !Number.isFinite(defaultTemp) ||
      defaultTemp < 0 ||
      defaultTemp > 2
    ) {
      return res
        .status(400)
        .json({ error: "defaultTemp must be between 0 and 2" });
    }

    try {
      const updated = createModel(id.trim(), {
        name: name.trim(),
        maxTokens,
        defaultTemp,
      });
      return res.status(201).json(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create model";
      return res.status(400).json({ error: message });
    }
  });

  app.put("/api/models/:id", (req, res) => {
    const targetId = req.params.id;
    const { name, maxTokens, defaultTemp } = req.body ?? ({} as ModelConfig);
    if (!targetId) {
      return res.status(400).json({ error: "Model ID is required" });
    }
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Model name is required" });
    }
    if (
      typeof maxTokens !== "number" ||
      !Number.isFinite(maxTokens) ||
      maxTokens <= 0 ||
      !Number.isInteger(maxTokens)
    ) {
      return res
        .status(400)
        .json({ error: "maxTokens must be a positive integer" });
    }
    if (
      typeof defaultTemp !== "number" ||
      !Number.isFinite(defaultTemp) ||
      defaultTemp < 0 ||
      defaultTemp > 2
    ) {
      return res
        .status(400)
        .json({ error: "defaultTemp must be between 0 and 2" });
    }

    try {
      const updated = updateModel(targetId, {
        name: name.trim(),
        maxTokens,
        defaultTemp,
      });
      return res.json(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update model";
      return res.status(400).json({ error: message });
    }
  });

  app.delete("/api/models/:id", (req, res) => {
    const targetId = req.params.id;
    if (!targetId) {
      return res.status(400).json({ error: "Model ID is required" });
    }
    try {
      const updated = deleteModel(targetId);
      return res.json(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete model";
      return res.status(400).json({ error: message });
    }
  });

  // Persistent stories
  app.get("/api/stories", listStoriesHandler);
  app.post("/api/stories", createStoryHandler);
  app.get("/api/stories/:storyId", getStoryHandler);
  app.get("/api/stories/:storyId/nodes/:nodeId", getNodeHandler);
  app.get(
    "/api/stories/:storyId/nodes/:nodeId/window",
    getWindowHandler,
  );
  app.post(
    "/api/stories/:storyId/nodes/:nodeId/children",
    createChildHandler,
  );
  app.patch("/api/stories/:storyId/nodes/:nodeId", updateNodeHandler);
}
