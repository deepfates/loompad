import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";

import { fetchStory } from "../api/storyApi";
import { PersistentStoryView } from "./PersistentStoryView";

interface Props {
  storyId?: string;
  nodeId?: string;
}

export default function PersistentStoryRoutes({ storyId, nodeId }: Props) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!storyId || nodeId) return;

    // If only a story ID/slug is provided, fetch its root and redirect
    fetchStory(storyId)
      .then((story) => {
        setLocation(`/stories/${story.slug}/${story.rootId}`, { replace: true });
      })
      .catch(() => {
        setLocation("/", { replace: true });
      });
  }, [storyId, nodeId, setLocation]);

  return (
    <Switch>
      <Route path="/stories/:activeStoryId/:activeNodeId">
        {(params) => (
          <PersistentStoryView
            storyId={params.activeStoryId}
            nodeId={params.activeNodeId}
          />
        )}
      </Route>
      <Route>
        <div className="flex min-h-screen items-center justify-center bg-[#f6f2eb] p-6 text-center text-[#1e1b16]">
          <div className="space-y-3">
            <p className="text-lg font-semibold">Loading loom…</p>
            <p className="text-sm text-[#5a4f42]">
              Redirecting you to the story root.
            </p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

