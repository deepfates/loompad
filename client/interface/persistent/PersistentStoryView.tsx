import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import {
  createChildApi,
  fetchStory,
  fetchWindow,
  updateNodeApi,
} from "../api/storyApi";
import type { StoryNode, StoryWindowResponse } from "../../../shared/storyTypes";

function NodeCard({
  node,
  label,
  onSelect,
  isActive,
}: {
  node: StoryNode;
  label?: string;
  onSelect?: (node: StoryNode) => void;
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(node)}
      className={`w-full rounded-lg border border-[#d4c7ba] bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isActive ? "ring-2 ring-[#6d4aff]" : ""
      }`}
    >
      {label ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#7a7166]">
          {label}
        </p>
      ) : null}
      <p className="text-sm leading-snug text-[#1e1b16] whitespace-pre-wrap">
        {node.text}
      </p>
    </button>
  );
}

export function PersistentStoryView({
  storyId,
  nodeId,
}: {
  storyId?: string;
  nodeId?: string;
}) {
  const [, setLocation] = useLocation();
  const [cursorId, setCursorId] = useState<string | undefined>(nodeId);
  const [windowData, setWindowData] = useState<StoryWindowResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingChild, setCreatingChild] = useState(false);

  useEffect(() => {
    setCursorId(nodeId);
  }, [nodeId]);

  useEffect(() => {
    if (!storyId || cursorId === undefined || cursorId === null) return;

    setLoading(true);
    setError(null);

    fetchWindow(storyId, cursorId)
      .then((data) => {
        setWindowData(data);
        if (storyId !== data.story.slug && storyId !== data.story.id) {
          setLocation(`/stories/${data.story.slug}/${cursorId}`, { replace: true });
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load story";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [storyId, cursorId, setLocation]);

  useEffect(() => {
    if (cursorId || !storyId) return;
    fetchStory(storyId)
      .then((story) => {
        setCursorId(story.rootId);
        setLocation(`/stories/${story.slug}/${story.rootId}`, { replace: true });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Story not found";
        setError(message);
      });
  }, [storyId, cursorId, setLocation]);

  const handleSelectNode = useCallback(
    (node: StoryNode) => {
      if (!windowData) return;
      const targetStoryId = windowData.story.slug || windowData.story.id;
      setCursorId(node.id);
      setLocation(`/stories/${targetStoryId}/${node.id}`);
    },
    [windowData, setLocation],
  );

  const handleMakeActiveChild = useCallback(
    async (node: StoryNode) => {
      if (!windowData?.cursor?.id) return;
      try {
        await updateNodeApi(storyId ?? windowData.story.slug, windowData.cursor.id, {
          activeChildId: node.id,
        });
        setCursorId(node.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update node";
        setError(message);
      }
    },
    [storyId, windowData],
  );

  const handleCreateChild = useCallback(async () => {
    if (!windowData || creatingChild) return;
    const text = window.prompt("Add a continuation below this node:");
    if (!text) return;
    setCreatingChild(true);
    setError(null);
    try {
      const result = await createChildApi(
        storyId ?? windowData.story.slug,
        cursorId ?? windowData.cursor.id,
        {
          text,
          makeActive: true,
        },
      );
      setWindowData(result.window);
      handleSelectNode(result.child);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create child";
      setError(message);
    } finally {
      setCreatingChild(false);
    }
  }, [windowData, storyId, cursorId, handleSelectNode, creatingChild]);

  const siblingGroup = useMemo(() => {
    if (!windowData?.cursor?.id || !windowData.siblingGroups) return [];
    return windowData.siblingGroups[windowData.cursor.id] ?? [];
  }, [windowData]);

  if (loading && !windowData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f2eb] text-[#1e1b16]">
        <p className="text-lg font-semibold">Loading story…</p>
      </div>
    );
  }

  if (error && !windowData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fef3f2] text-[#7f1d1d]">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="text-sm">{error}</p>
          <button
            type="button"
            className="rounded bg-[#1e1b16] px-4 py-2 text-white shadow"
            onClick={() => setLocation("/")}
          >
            Return home
          </button>
        </div>
      </div>
    );
  }

  if (!windowData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f2eb] via-[#f1ece4] to-[#e9e2d7] text-[#1e1b16]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#7a7166]">
              Loompad persistent
            </p>
            <h1 className="text-2xl font-bold leading-tight">
              {windowData.story.title}
            </h1>
            <p className="text-sm text-[#5a4f42]">/stories/{windowData.story.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="rounded border border-[#d4c7ba] bg-white px-3 py-2 text-sm font-semibold text-[#1e1b16] shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              Open local loom
            </button>
            <button
              type="button"
              onClick={handleCreateChild}
              disabled={creatingChild}
              className="rounded bg-[#6d4aff] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingChild ? "Adding…" : "Add continuation"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-lg border border-[#f4c7c3] bg-[#fef3f2] px-4 py-3 text-sm text-[#7f1d1d]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_1fr]">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7a7166]">
              Ancestors
            </p>
            <div className="space-y-2">
              {windowData.ancestors.length === 0 ? (
                <p className="text-sm text-[#5a4f42]">Root of the story.</p>
              ) : (
                windowData.ancestors.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    onSelect={handleSelectNode}
                    isActive={node.id === windowData.cursor.parentId}
                  />
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7a7166]">
              Cursor & siblings
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {siblingGroup.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  label={node.id === windowData.cursor.id ? "Current" : "Sibling"}
                  onSelect={handleSelectNode}
                  isActive={node.id === windowData.cursor.id}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7a7166]">
              Favored path
            </p>
            <div className="space-y-2">
              {windowData.favoredPath.length === 0 ? (
                <p className="text-sm text-[#5a4f42]">No descendants yet.</p>
              ) : (
                windowData.favoredPath.map((node, index) => {
                  const label = index === 0 ? "Next" : `Depth +${index + 1}`;
                  return (
                    <NodeCard
                      key={node.id}
                      node={node}
                      label={label}
                      onSelect={() => handleMakeActiveChild(node)}
                      isActive={windowData.cursor.activeChildId === node.id}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#d4c7ba] bg-white px-4 py-3 text-sm text-[#5a4f42] shadow-sm">
          <p>
            Use the buttons above to move the cursor. The URL always mirrors your
            current node, and new continuations are stored in SQLite on the
            server.
          </p>
        </div>
      </div>
    </div>
  );
}

