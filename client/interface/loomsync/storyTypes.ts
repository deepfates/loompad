import type {
  Loom,
  TurnId,
} from "../../../vendor/loomsync/packages/core/src/types";
import type { TextPayload } from "../../../vendor/loomsync/packages/text/src/types";

export type StoryLoomMeta = { title: string };
export type StoryEntryMeta = { title: string };

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

export type StoryLoom = Loom<TextPayload, StoryLoomMeta, StoryTurnMeta>;
