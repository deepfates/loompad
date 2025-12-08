import type { Request, Response } from "express";
import {
  createChild,
  createStory,
  getNodeById,
  getStory,
  getWindow,
  listStories,
  updateNode,
} from "../storyStore";
import type {
  CreateChildPayload,
  CreateStoryPayload,
  StoryWindowRequestParams,
  UpdateNodePayload,
} from "../../shared/storyTypes";

function parseNumericParam(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function listStoriesHandler(_req: Request, res: Response) {
  const stories = listStories();
  return res.json(stories);
}

export function createStoryHandler(req: Request, res: Response) {
  const payload = req.body as CreateStoryPayload;
  try {
    const summary = createStory(payload);
    return res.status(201).json(summary);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create story";
    return res.status(400).json({ error: message });
  }
}

export function getStoryHandler(req: Request, res: Response) {
  const storyIdOrSlug = req.params.storyId;
  const story = getStory(storyIdOrSlug);
  if (!story) {
    return res.status(404).json({ error: "Story not found" });
  }
  return res.json(story);
}

export function getWindowHandler(req: Request, res: Response) {
  const storyIdOrSlug = req.params.storyId;
  const cursorId = req.params.nodeId;

  const params: StoryWindowRequestParams = {
    ancestorDepth: parseNumericParam(req.query.ancestors, 6),
    descendantDepth: parseNumericParam(req.query.descendants, 6),
    siblingSpan: parseNumericParam(req.query.siblings, 2),
  };

  try {
    const window = getWindow(storyIdOrSlug, cursorId, params);
    return res.json(window);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    const status = message.includes("not found") ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}

export function createChildHandler(req: Request, res: Response) {
  const storyIdOrSlug = req.params.storyId;
  const parentId = req.params.nodeId;
  const payload = req.body as CreateChildPayload;

  if (!payload?.text || typeof payload.text !== "string") {
    return res.status(400).json({ error: "Child text is required" });
  }

  try {
    const child = createChild(storyIdOrSlug, parentId, payload);
    const window = getWindow(storyIdOrSlug, child.id);
    return res.status(201).json({ child, window });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create";
    const status = message.includes("not found") ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}

export function updateNodeHandler(req: Request, res: Response) {
  const storyIdOrSlug = req.params.storyId;
  const nodeId = req.params.nodeId;
  const payload = req.body as UpdateNodePayload;

  try {
    const node = updateNode(storyIdOrSlug, nodeId, payload);
    return res.json(node);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update";
    const status = message.includes("not found") ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}

export function getNodeHandler(req: Request, res: Response) {
  const storyIdOrSlug = req.params.storyId;
  const nodeId = req.params.nodeId;
  const node = getNodeById(storyIdOrSlug, nodeId);
  if (!node) {
    return res.status(404).json({ error: "Node not found" });
  }
  return res.json(node);
}
