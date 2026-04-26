import { describe, expect, it } from "vitest";
import {
  TEXT_STORY_PROFILE,
  assertTextStoryThread,
  isTextStoryLoomMeta,
  isTextStoryTurn,
  textStoryLoomMeta,
} from "../src/profiles/text-story.js";
import type { Turn } from "../src/types.js";

describe("text-story profile", () => {
  it("creates and validates profile loom metadata", () => {
    expect(textStoryLoomMeta({ title: "A story" })).toEqual({
      profile: TEXT_STORY_PROFILE,
      title: "A story",
    });
    expect(isTextStoryLoomMeta(textStoryLoomMeta())).toBe(true);
    expect(isTextStoryLoomMeta({ title: "No profile" })).toBe(false);
    expect(isTextStoryLoomMeta({ profile: TEXT_STORY_PROFILE, title: 12 })).toBe(false);
  });

  it("validates text-story turns without knowing the writer app", () => {
    const turn: Turn<unknown, unknown> = {
      id: "turn-1",
      loomId: "loom-1",
      parentId: null,
      payload: { text: "Once" },
      meta: { role: "prose" },
      createdAt: 1,
    };

    expect(isTextStoryTurn(turn)).toBe(true);
    expect(isTextStoryTurn({ ...turn, payload: { value: "Once" } })).toBe(false);
    expect(isTextStoryTurn({ ...turn, meta: { revises: 1 } })).toBe(false);
  });

  it("asserts text-story threads for readers", () => {
    const turns: Turn<unknown, unknown>[] = [
      {
        id: "turn-1",
        loomId: "loom-1",
        parentId: null,
        payload: { text: "Once" },
        createdAt: 1,
      },
      {
        id: "turn-2",
        loomId: "loom-1",
        parentId: "turn-1",
        payload: { text: " later" },
        meta: { role: "prose" },
        createdAt: 2,
      },
    ];

    expect(() => assertTextStoryThread(turns)).not.toThrow();
    expect(() =>
      assertTextStoryThread([{ ...turns[0]!, payload: { text: 42 } }]),
    ).toThrow("Expected text-story turn payload");
  });
});
