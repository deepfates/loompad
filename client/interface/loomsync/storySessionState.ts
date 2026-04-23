const STORAGE_KEY = "loompad-loomsync-story-session";

type StorySessionState = Record<string, Record<string, number>>;

const fallbackState: StorySessionState = {};

function readState(): StorySessionState {
  if (typeof window === "undefined") return fallbackState;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StorySessionState) : {};
  } catch {
    return fallbackState;
  }
}

function writeState(state: StorySessionState) {
  if (typeof window === "undefined") {
    Object.assign(fallbackState, state);
    return;
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    Object.assign(fallbackState, state);
  }
}

export function getPreferredChildIndex(
  rootId: string,
  nodeId: string,
  childCount: number,
  fallbackIndex = 0,
) {
  const value = readState()[rootId]?.[nodeId];
  return typeof value === "number" && value >= 0 && value < childCount
    ? value
    : fallbackIndex;
}

export function setPreferredChildIndex(
  rootId: string,
  nodeId: string,
  index: number,
) {
  const state = readState();
  state[rootId] ??= {};
  state[rootId][nodeId] = index;
  writeState(state);
}
