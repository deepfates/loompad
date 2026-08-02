import { describe, it, expect } from "bun:test";
import type { StoryNode } from "../../types";
import { joinSegments, storySeam, joinPair } from "../../utils/join";
import {
  EMPTY_GENERATION_NOTICE_MESSAGE,
  createPrompt,
  getEmptyGenerationNotice,
} from "../useStoryGeneration";

describe("prompt concatenation", () => {
  it("preserves single spaces between nodes", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Once upon a time", origin: "unknown", continuations: [] },
      { id: "2", text: " in a land far away", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Once upon a time in a land far away");
  });

  it("preserves authored spaces on both sides of a node boundary", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Once upon a time ", origin: "unknown", continuations: [] },
      { id: "2", text: " in a land far away", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Once upon a time  in a land far away");
  });

  it("represents a node boundary when neither node carries whitespace", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Hello", origin: "unknown", continuations: [] },
      { id: "2", text: "world", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Hello world");
  });

  it("preserves newlines between nodes", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Chapter 1\n", origin: "unknown", continuations: [] },
      { id: "2", text: "It was a dark night.", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Chapter 1\nIt was a dark night.");
  });

  it("preserves multiple authored newlines at boundaries", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Chapter 1\n\n", origin: "unknown", continuations: [] },
      { id: "2", text: "\nIt was a dark night.", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Chapter 1\n\n\nIt was a dark night.");
  });

  it("handles word mode tokens with leading spaces correctly", () => {
    // Simulating typical word mode output
    const path: StoryNode[] = [
      { id: "1", text: "Once", origin: "unknown", continuations: [] },
      { id: "2", text: " upon", origin: "unknown", continuations: [] },
      { id: "3", text: " a", origin: "unknown", continuations: [] },
      { id: "4", text: " time", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 3);
    expect(prompt).toBe("Once upon a time");
  });

  it("handles mixed whitespace at boundaries", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Hello\t", origin: "unknown", continuations: [] },
      { id: "2", text: " world", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Hello\t world");
  });

  it("handles empty nodes gracefully", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Hello", origin: "unknown", continuations: [] },
      { id: "2", text: "", origin: "unknown", continuations: [] },
      { id: "3", text: " world", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 2);
    expect(prompt).toBe("Hello world");
  });

  it("respects depth parameter", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Once", origin: "unknown", continuations: [] },
      { id: "2", text: " upon", origin: "unknown", continuations: [] },
      { id: "3", text: " a", origin: "unknown", continuations: [] },
      { id: "4", text: " time", origin: "unknown", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Once upon");
  });
});

describe("empty generation notices", () => {
  it("classifies a completed generation with no content as a visible notice", () => {
    expect(getEmptyGenerationNotice("")).toEqual({
      message: EMPTY_GENERATION_NOTICE_MESSAGE,
    });
  });

  it("does not classify normal generated text as empty", () => {
    expect(getEmptyGenerationNotice("A continuation appears.")).toBeNull();
  });
});

describe("explicit story-turn seams", () => {
  it("adds a seam only when neither exact turn string carries one", () => {
    expect(storySeam("Hello", "world")).toBe(" ");
    expect(storySeam("Hello ", "world")).toBe("");
    expect(storySeam("Hello", " world")).toBe("");
  });

  it("joinSegments preserves bytes and represents absent boundaries", () => {
    expect(joinSegments(["Hello", " world"])).toBe("Hello world");
    expect(joinSegments(["Hello ", " world"])).toBe("Hello  world");
    expect(joinSegments(["Hello", "world"])).toBe("Hello world");
    expect(joinSegments(["Line 1\n\n", "\nLine 2"])).toBe("Line 1\n\n\nLine 2");
  });

  it("joinPair equals the exact strings plus their structural seam", () => {
    const prev = "Hello ";
    const next = " world";
    expect(joinPair(prev, next)).toBe(prev + storySeam(prev, next) + next);
  });
});
