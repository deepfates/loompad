import type {
  Loom,
  TurnId,
} from "../../../vendor/lync/packages/core/src/types";
import type {
  TextStoryLoomMeta,
  TextStoryTurnMeta,
  TextStoryTurnPayload,
} from "../../../vendor/lync/packages/core/src/profiles/text-story";

export type StoryTurnPayload = TextStoryTurnPayload;
export type StoryLoomMeta = TextStoryLoomMeta;
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

export interface StoryTurnMeta extends TextStoryTurnMeta {
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
