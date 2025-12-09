import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Database } from "bun:sqlite";
import type {
  CreateChildPayload,
  CreateStoryPayload,
  StoryNode,
  StoryRecord,
  StorySummary,
  StoryWindowRequestParams,
  StoryWindowResponse,
  UpdateNodePayload,
} from "../shared/storyTypes";

interface StoryRow {
  id: string;
  slug: string;
  title: string;
  rootId: string;
  createdAt: string;
  updatedAt: string;
}

interface NodeRow {
  id: string;
  storyId: string;
  parentId: string | null;
  depth: number;
  choiceIndex: number;
  text: string;
  createdAt: string;
  updatedAt: string;
  activeChildId?: string | null;
}

const DB_PATH = path.join(process.cwd(), "server", "data", "stories.db");
const DEFAULT_ROOT_TEXT = "Once upon a time, in Absalom,";

let db: Database | null = null;

function ensureDirectoryExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDb(): Database {
  if (db) return db;
  ensureDirectoryExists(DB_PATH);
  db = new Database(DB_PATH);
  initializeSchema(db);
  seedDefaultStory(db);
  return db;
}

function initializeSchema(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      rootId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      storyId TEXT NOT NULL,
      parentId TEXT,
      depth INTEGER NOT NULL,
      choiceIndex INTEGER NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      activeChildId TEXT,
      FOREIGN KEY(storyId) REFERENCES stories(id)
    );
  `);

  database.run(
    "CREATE INDEX IF NOT EXISTS idx_nodes_story_parent_choice ON nodes(storyId, parentId, choiceIndex);",
  );
  database.run(
    "CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories(slug);",
  );
}

function seedDefaultStory(database: Database) {
  const row = database.query<{ count: number }>("SELECT COUNT(*) AS count FROM stories").get();
  if (row && row.count > 0) return;

  const now = new Date().toISOString();
  const storyId = "loompad-default";
  const rootId = "root";

  const insertStory = database.prepare(
    "INSERT INTO stories (id, slug, title, rootId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertNode = database.prepare(
    "INSERT INTO nodes (id, storyId, parentId, depth, choiceIndex, text, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  database.transaction(() => {
    insertStory.run(storyId, "loompad", "Loompad", rootId, now, now);
    insertNode.run(rootId, storyId, null, 0, 0, DEFAULT_ROOT_TEXT, now, now);
  })();
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "story"
  );
}

function ensureSlugUnique(slug: string): string {
  const database = getDb();
  const existingSlugs = database
    .query<{ slug: string }>("SELECT slug FROM stories WHERE slug LIKE ?")
    .all(`${slug}%`) 
    .map((row) => row.slug);

  if (!existingSlugs.includes(slug)) return slug;

  let counter = 2;
  while (existingSlugs.includes(`${slug}-${counter}`)) {
    counter += 1;
  }
  return `${slug}-${counter}`;
}

function buildSummary(row: StoryRow): StorySummary {
  const { id, slug, title, rootId, createdAt, updatedAt } = row;
  return { id, slug, title, rootId, createdAt, updatedAt };
}

function hydrateStoryRecord(storyIdOrSlug: string): StoryRecord | null {
  const database = getDb();
  const storyRow = database
    .query<StoryRow>("SELECT * FROM stories WHERE id = ? OR slug = ?")
    .get(storyIdOrSlug, storyIdOrSlug);
  if (!storyRow) return null;

  const nodeRows = database
    .query<NodeRow>(
      "SELECT id, storyId, parentId, depth, choiceIndex, text, createdAt, updatedAt, activeChildId FROM nodes WHERE storyId = ? ORDER BY depth ASC, choiceIndex ASC, createdAt ASC",
    )
    .all(storyRow.id);

  const nodes: Record<string, StoryNode> = {};
  nodeRows.forEach((row) => {
    nodes[row.id] = {
      id: row.id,
      parentId: row.parentId,
      depth: row.depth,
      choiceIndex: row.choiceIndex,
      text: row.text,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      children: [],
      ...(row.activeChildId ? { activeChildId: row.activeChildId } : {}),
    };
  });

  nodeRows.forEach((row) => {
    if (row.parentId && nodes[row.parentId]) {
      nodes[row.parentId].children.push(row.id);
    }
  });

  return { ...buildSummary(storyRow), nodes };
}

function getAncestors(story: StoryRecord, nodeId: string): StoryNode[] {
  const nodes = story.nodes;
  const ancestors: StoryNode[] = [];
  let current = nodes[nodeId];

  while (current?.parentId) {
    const parent = nodes[current.parentId];
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

function sortChildren(nodes: Record<string, StoryNode>, ids: string[]) {
  return [...ids].sort((a, b) => {
    const nodeA = nodes[a];
    const nodeB = nodes[b];
    return (nodeA?.choiceIndex ?? 0) - (nodeB?.choiceIndex ?? 0);
  });
}

function getSiblingSlice(
  story: StoryRecord,
  nodeId: string,
  span: number,
): StoryNode[] {
  const node = story.nodes[nodeId];
  if (!node) return [];
  if (node.parentId === null) return [node];

  const parent = story.nodes[node.parentId];
  if (!parent) return [node];

  const ordered = sortChildren(story.nodes, parent.children);
  const idx = ordered.findIndex((id) => id === nodeId);
  if (idx === -1) return [node];

  const start = Math.max(0, idx - span);
  const end = Math.min(ordered.length, idx + span + 1);
  return ordered.slice(start, end).map((id) => story.nodes[id]);
}

function getFavoredPath(
  story: StoryRecord,
  cursorId: string,
  depth: number,
): StoryNode[] {
  const nodes = story.nodes;
  const path: StoryNode[] = [];
  let current = nodes[cursorId];
  if (!current) return path;

  let currentDepth = 0;
  while (currentDepth < depth) {
    const children = sortChildren(nodes, current.children ?? []);
    if (!children.length) break;

    const activeChildId = current.activeChildId ?? children[0];
    const activeChild = nodes[activeChildId];
    if (!activeChild) break;

    path.push(activeChild);
    current = activeChild;
    currentDepth += 1;
  }

  return path;
}

function touchStory(storyId: string) {
  const database = getDb();
  const now = new Date().toISOString();
  database
    .prepare("UPDATE stories SET updatedAt = ? WHERE id = ?")
    .run(now, storyId);
}

export function listStories(): StorySummary[] {
  const database = getDb();
  const rows = database
    .query<StoryRow>("SELECT * FROM stories ORDER BY createdAt ASC")
    .all();
  return rows.map(buildSummary);
}

export function getPrimaryStory(): StorySummary | null {
  const database = getDb();
  const row = database
    .query<StoryRow>("SELECT * FROM stories ORDER BY updatedAt DESC LIMIT 1")
    .get();
  return row ? buildSummary(row) : null;
}

export function getStory(storyIdOrSlug: string): StoryRecord | null {
  return hydrateStoryRecord(storyIdOrSlug);
}

export function createStory(payload: CreateStoryPayload): StorySummary {
  const database = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const rootId = crypto.randomUUID();
  const desiredSlug = slugify(payload.slug || payload.title || "story");
  const slug = ensureSlugUnique(desiredSlug);
  const title = payload.title?.trim() || "Untitled Story";
  const rootText = payload.rootText?.trim() || DEFAULT_ROOT_TEXT;

  const insertStory = database.prepare(
    "INSERT INTO stories (id, slug, title, rootId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertNode = database.prepare(
    "INSERT INTO nodes (id, storyId, parentId, depth, choiceIndex, text, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  database.transaction(() => {
    insertStory.run(id, slug, title, rootId, now, now);
    insertNode.run(rootId, id, null, 0, 0, rootText, now, now);
  })();

  return buildSummary({ id, slug, title, rootId, createdAt: now, updatedAt: now });
}

export function createChild(
  storyIdOrSlug: string,
  parentId: string,
  payload: CreateChildPayload,
): StoryNode {
  const database = getDb();
  const story = database
    .query<StoryRow>("SELECT * FROM stories WHERE id = ? OR slug = ?")
    .get(storyIdOrSlug, storyIdOrSlug);
  if (!story) throw new Error("Story not found");

  const parent = database
    .query<NodeRow>("SELECT * FROM nodes WHERE id = ? AND storyId = ?")
    .get(parentId, story.id);
  if (!parent) throw new Error("Parent node not found");

  const childId = crypto.randomUUID();
  const now = new Date().toISOString();

  const siblingRows = database
    .query<{ id: string; choiceIndex: number }>(
      "SELECT id, choiceIndex FROM nodes WHERE storyId = ? AND parentId = ? ORDER BY choiceIndex ASC",
    )
    .all(story.id, parent.id);

  const desiredIndex =
    payload.choiceIndex === undefined || payload.choiceIndex === null
      ? siblingRows.length
      : Math.max(0, Math.min(siblingRows.length, payload.choiceIndex));

  const shiftSiblings = database.prepare(
    "UPDATE nodes SET choiceIndex = choiceIndex + 1 WHERE storyId = ? AND parentId = ? AND choiceIndex >= ?",
  );
  const insertChild = database.prepare(
    "INSERT INTO nodes (id, storyId, parentId, depth, choiceIndex, text, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const updateParentActive = database.prepare(
    "UPDATE nodes SET activeChildId = ?, updatedAt = ? WHERE id = ? AND storyId = ?",
  );

  database.transaction(() => {
    shiftSiblings.run(story.id, parent.id, desiredIndex);
    insertChild.run(
      childId,
      story.id,
      parent.id,
      parent.depth + 1,
      desiredIndex,
      payload.text,
      now,
      now,
    );

    if (payload.makeActive) {
      updateParentActive.run(childId, now, parent.id, story.id);
    }

    touchStory(story.id);
  })();

  return {
    id: childId,
    parentId: parent.id,
    depth: parent.depth + 1,
    choiceIndex: desiredIndex,
    text: payload.text,
    createdAt: now,
    updatedAt: now,
    children: [],
  };
}

export function updateNode(
  storyIdOrSlug: string,
  nodeId: string,
  payload: UpdateNodePayload,
): StoryNode {
  const database = getDb();
  const story = database
    .query<StoryRow>("SELECT * FROM stories WHERE id = ? OR slug = ?")
    .get(storyIdOrSlug, storyIdOrSlug);
  if (!story) throw new Error("Story not found");

  const node = database
    .query<NodeRow>("SELECT * FROM nodes WHERE id = ? AND storyId = ?")
    .get(nodeId, story.id);
  if (!node) throw new Error("Node not found");

  if (payload.activeChildId !== undefined && payload.activeChildId !== null) {
    const isChild = database
      .query<{ count: number }>(
        "SELECT COUNT(*) AS count FROM nodes WHERE id = ? AND parentId = ? AND storyId = ?",
      )
      .get(payload.activeChildId, node.id, story.id);
    if (!isChild || isChild.count === 0) {
      throw new Error("activeChildId must be a child of the node");
    }
  }

  const now = new Date().toISOString();
  const update = database.prepare(
    "UPDATE nodes SET text = COALESCE(?, text), activeChildId = ?, updatedAt = ? WHERE id = ? AND storyId = ?",
  );

  const activeValue =
    payload.activeChildId === undefined ? node.activeChildId ?? null : payload.activeChildId;

  database.transaction(() => {
    update.run(payload.text ?? null, activeValue, now, node.id, story.id);
    touchStory(story.id);
  })();

  const refreshed = hydrateStoryRecord(story.id);
  if (!refreshed) throw new Error("Story not found after update");
  const updatedNode = refreshed.nodes[node.id];
  if (!updatedNode) throw new Error("Node not found after update");
  return updatedNode;
}

export function getWindow(
  storyIdOrSlug: string,
  cursorId: string,
  params: StoryWindowRequestParams = {},
): StoryWindowResponse {
  const story = hydrateStoryRecord(storyIdOrSlug);
  if (!story) {
    throw new Error("Story not found");
  }

  const cursor = story.nodes[cursorId];
  if (!cursor) {
    throw new Error("Cursor node not found");
  }

  const ancestorDepth = Math.max(0, params.ancestorDepth ?? 8);
  const descendantDepth = Math.max(0, params.descendantDepth ?? 8);
  const siblingSpan = Math.max(0, params.siblingSpan ?? 2);

  const ancestors = getAncestors(story, cursorId).slice(-ancestorDepth);
  const favoredPath = getFavoredPath(story, cursorId, descendantDepth);

  const siblingGroups: Record<string, StoryNode[]> = {};
  const relevantNodes = [cursor, ...ancestors, ...favoredPath];
  relevantNodes.forEach((node) => {
    siblingGroups[node.id] = getSiblingSlice(story, node.id, siblingSpan);
  });

  return {
    story: buildSummary(story),
    cursor,
    ancestors,
    favoredPath,
    siblingGroups,
  };
}

export function getNodeById(
  storyIdOrSlug: string,
  nodeId: string,
): StoryNode | null {
  const story = hydrateStoryRecord(storyIdOrSlug);
  if (!story) return null;
  return story.nodes[nodeId] ?? null;
}
