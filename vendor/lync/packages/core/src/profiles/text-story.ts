import type {
  Loom,
  LoomInfo,
  Turn,
  TurnId,
} from "../types.js";

export const TEXT_STORY_PROFILE = "org.lync.profile.textStory.v1" as const;

export type TextStoryProfile = typeof TEXT_STORY_PROFILE;

export interface TextStoryLoomMeta {
  profile: TextStoryProfile;
  title?: string;
}

export interface TextStoryTurnPayload {
  text: string;
}

export interface TextStoryTurnMeta {
  role?: string;
  revises?: TurnId;
  generatedBy?: unknown;
}

export type TextStoryLoom = Loom<
  TextStoryTurnPayload,
  TextStoryLoomMeta,
  TextStoryTurnMeta
>;

export type TextStoryTurn = Turn<TextStoryTurnPayload, TextStoryTurnMeta>;

export function textStoryLoomMeta(
  meta: Omit<TextStoryLoomMeta, "profile"> = {},
): TextStoryLoomMeta {
  return {
    ...meta,
    profile: TEXT_STORY_PROFILE,
  };
}

export function isTextStoryLoomMeta(
  meta: unknown,
): meta is TextStoryLoomMeta {
  if (!isRecord(meta)) return false;
  if (meta.profile !== TEXT_STORY_PROFILE) return false;
  return meta.title === undefined || typeof meta.title === "string";
}

export function assertTextStoryLoomInfo(
  info: LoomInfo<unknown>,
): asserts info is LoomInfo<TextStoryLoomMeta> {
  if (!isTextStoryLoomMeta(info.meta)) {
    throw new TypeError(
      `Expected loom meta profile ${TEXT_STORY_PROFILE}`,
    );
  }
}

export function isTextStoryTurnPayload(
  payload: unknown,
): payload is TextStoryTurnPayload {
  return isRecord(payload) && typeof payload.text === "string";
}

export function isTextStoryTurnMeta(
  meta: unknown,
): meta is TextStoryTurnMeta {
  if (meta === undefined) return true;
  if (!isRecord(meta)) return false;
  if (meta.role !== undefined && typeof meta.role !== "string") return false;
  if (meta.revises !== undefined && typeof meta.revises !== "string") {
    return false;
  }
  return true;
}

export function isTextStoryTurn(
  turn: Turn<unknown, unknown>,
): turn is TextStoryTurn {
  return (
    isTextStoryTurnPayload(turn.payload) &&
    isTextStoryTurnMeta(turn.meta)
  );
}

export function assertTextStoryTurn(
  turn: Turn<unknown, unknown>,
): asserts turn is TextStoryTurn {
  if (!isTextStoryTurnPayload(turn.payload)) {
    throw new TypeError("Expected text-story turn payload with string text");
  }
  if (!isTextStoryTurnMeta(turn.meta)) {
    throw new TypeError("Expected text-story turn metadata");
  }
}

export function assertTextStoryThread(
  turns: Turn<unknown, unknown>[],
): asserts turns is TextStoryTurn[] {
  for (const turn of turns) {
    assertTextStoryTurn(turn);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
