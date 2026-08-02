import type {
  Loom,
  TurnId,
} from "@deepfates/lync";
import type {
  TextStoryLoomMeta,
  TextStoryTurnMeta,
  TextStoryTurnPayload,
} from "@deepfates/lync/profiles/text-story";

export type StoryTurnPayload = TextStoryTurnPayload;
export type StoryLoomMeta = TextStoryLoomMeta;
export type StoryEntryMeta = { title: string };

export type StoryTurnRole =
  | "prose"
  | "revision"
  | "critique"
  | "generation"
  | "judge"
  | "summary"
  | "annotation"
  /** A keep/discard swipe on the parent turn; latest wins. See `kept`. */
  | "mark";

/** Fingerprint of the generation that produced a model turn. */
export interface StoryGeneratedBy {
  model?: string;
  temperature?: number;
  lengthMode?: string;
  textSplitting?: boolean;
  /** Hidden Loom event containing the full receipt for this provider call. */
  generationTurnId?: TurnId;
  // Legacy Looms stored the full receipt directly on every prose turn.
  generationMode?: import("../../../shared/generation").GenerationMode;
  program?: string;
  reasoningPolicy?: import("../../../shared/generation").ReasoningPolicy;
  reasoning?: import("../../../shared/generation").GenerationReasoning;
  usage?: import("../../../shared/generation").GenerationUsage;
}

/** One durable provider call. Stored once on a hidden `generation` turn. */
export interface StoryGenerationRecord extends StoryGeneratedBy {
  generationMode: import("../../../shared/generation").GenerationMode;
  program: string;
  reasoningPolicy: import("../../../shared/generation").ReasoningPolicy;
  providerGenerationId?: string;
}

export interface StoryJudgment {
  model: string;
  temperature: number;
  choiceIndex: number;
  program: string;
  reasoningPolicy: import("../../../shared/generation").ReasoningPolicy;
  providerGenerationId?: string;
  reasoning?: import("../../../shared/generation").GenerationReasoning;
  usage?: import("../../../shared/generation").GenerationUsage;
}

export interface StoryDraft {
  text: string;
  continuations?: StoryDraft[];
  generation?: Pick<
    StoryGenerationRecord,
    | "generationMode"
    | "program"
    | "reasoningPolicy"
    | "providerGenerationId"
    | "reasoning"
    | "usage"
  >;
}

export interface StoryTurnMeta extends TextStoryTurnMeta {
  role: StoryTurnRole;
  /**
   * Present ONLY on a `role: "mark"` turn: the kept/discarded state this swipe
   * records for its parent turn. Append-only — a keep then an un-keep are two
   * mark turns, and the latest one wins (NOTHING-SILENT: nothing is deleted).
   */
  kept?: boolean;
  /**
   * The person's identity (actor). Stamped into `meta` at every append site so
   * it survives lync's buildFold, which drops `event.body.author` but keeps
   * `meta`. Kept SEPARATE from `via` (the controller).
   */
  author?: string;
  /** The controlling software that wrote the turn, e.g. `"textile-browser"`. */
  via?: string;
  /**
   * Present ONLY on model-generated turns. Its presence is what marks a turn as
   * model origin — a human turn never carries it.
   */
  generatedBy?: StoryGeneratedBy;
  /** Full receipt, present only on a hidden `role: "generation"` turn. */
  generation?: StoryGenerationRecord;
  /** Reference from generated prose to its one generation event. */
  generationRef?: TurnId;
  /** True only on the first prose turn emitted by the provider call. */
  generationRoot?: boolean;
  revises?: TurnId;
  references?: TurnId[];
  respondsTo?: TurnId;
  /** Present only on a judge turn; references preserve candidate order. */
  judgment?: StoryJudgment;
}

export type StoryLoom = Loom<StoryTurnPayload, StoryLoomMeta, StoryTurnMeta>;
