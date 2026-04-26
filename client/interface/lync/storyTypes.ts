import type {
  Loom,
  TurnId,
} from "../../../vendor/lync/packages/core/src/types";

export type StoryTurnPayload = { text: string };
export type StoryLoomMeta = { title: string };
export type StoryEntryMeta = { title: string };

export interface StoryDraft {
  text: string;
  continuations?: StoryDraft[];
}

export type StoryTurnRole =
  | "prose"
  | "revision"
  | "critique"
  | "judge"
  | "summary"
  | "annotation";

export interface StoryTurnMeta {
  role: StoryTurnRole;
  author?: string;
  generatedBy?: {
    model?: string;
    temperature?: number;
    lengthMode?: string;
    textSplitting?: boolean;
  };
  revises?: TurnId;
  references?: TurnId[];
  respondsTo?: TurnId;
}

export type StoryLoom = Loom<StoryTurnPayload, StoryLoomMeta, StoryTurnMeta>;
