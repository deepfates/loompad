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
  loomId: string,
  nodeId: string,
  childCount: number,
  fallbackIndex = 0,
) {
  const value = readState()[loomId]?.[nodeId];
  return typeof value === "number" && value >= 0 && value < childCount
    ? value
    : fallbackIndex;
}

export function setPreferredChildIndex(
  loomId: string,
  nodeId: string,
  index: number,
) {
  const state = readState();
  state[loomId] ??= {};
  state[loomId][nodeId] = index;
  writeState(state);
}
