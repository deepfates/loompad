import type { TurnId } from "../../core/src/index";

export type TextPayload = { text: string };

export interface StoryNode {
  id: string;
  text: string;
  continuations?: StoryNode[];
  lastSelectedIndex?: number;
}

export interface StoryThreadTurn {
  id: TurnId;
  text: string;
}
