import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { fetchStories } from "../api/storyApi";
import type { StorySummary } from "../../../shared/storyTypes";

function pickPrimaryStory(stories: StorySummary[]): StorySummary | null {
  if (stories.length === 0) return null;
  const sorted = [...stories].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
  return sorted[0] ?? null;
}

export default function PersistentHome() {
  const [, setLocation] = useLocation();
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const primaryStory = useMemo(() => pickPrimaryStory(stories), [stories]);

  useEffect(() => {
    fetchStories()
      .then((records) => {
        setStories(records);
        const next = pickPrimaryStory(records);
        if (next) {
          setLocation(`/stories/${next.slug}/${next.rootId}`, { replace: true });
        } else {
          setError("No stories available. Create one via the API to get started.");
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unable to load stories";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [setLocation]);

  if (loading && !primaryStory && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f2eb] p-6 text-center text-[#1e1b16]">
        <div className="space-y-3">
          <p className="text-lg font-semibold">Loading loom…</p>
          <p className="text-sm text-[#5a4f42]">Fetching the latest story.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fef3f2] p-6 text-center text-[#1e1b16]">
      <div className="space-y-3">
        <p className="text-lg font-semibold">Unable to load a story</p>
        <p className="text-sm text-[#5a4f42]">{error ?? "No stories are available yet."}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded bg-[#1e1b16] px-4 py-2 text-sm font-semibold text-white shadow"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
