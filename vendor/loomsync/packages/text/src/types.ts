import type { LoomNodeId } from "../../core/src/types";

export type TextPayload = { text: string };

export interface StoryNode {
  id: string;
  text: string;
  continuations?: StoryNode[];
  lastSelectedIndex?: number;
}

export interface StoryPathNode {
  id: LoomNodeId;
  text: string;
}
