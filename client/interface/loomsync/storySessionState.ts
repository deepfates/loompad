export interface StorySessionState {
  preferredChildByNode: Record<string, number>;
}

const memoryState = new Map<string, StorySessionState>();

const storageKey = (storyKey: string) => `loompad-story-session:${storyKey}`;

const canUseSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

export function getStorySessionState(storyKey: string): StorySessionState {
  if (!canUseSessionStorage()) {
    return memoryState.get(storyKey) ?? { preferredChildByNode: {} };
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(storyKey));
    if (!raw) return { preferredChildByNode: {} };
    const parsed = JSON.parse(raw) as Partial<StorySessionState>;
    return { preferredChildByNode: parsed.preferredChildByNode ?? {} };
  } catch {
    return { preferredChildByNode: {} };
  }
}

export function setStorySessionState(
  storyKey: string,
  state: StorySessionState,
): void {
  memoryState.set(storyKey, state);

  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(storageKey(storyKey), JSON.stringify(state));
  } catch {
    // Session state is best-effort and must not affect shared world correctness.
  }
}

export function getPreferredChildIndex(
  storyKey: string,
  nodeId: string,
  childCount: number,
  fallback = 0,
): number {
  const preferred = getStorySessionState(storyKey).preferredChildByNode[nodeId];
  return typeof preferred === "number" &&
    preferred >= 0 &&
    preferred < childCount
    ? preferred
    : fallback;
}

export function setPreferredChildIndex(
  storyKey: string,
  nodeId: string,
  index: number,
): void {
  const state = getStorySessionState(storyKey);
  setStorySessionState(storyKey, {
    ...state,
    preferredChildByNode: {
      ...state.preferredChildByNode,
      [nodeId]: index,
    },
  });
}
