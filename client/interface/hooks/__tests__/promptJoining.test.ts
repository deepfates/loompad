import { describe, it, expect } from "bun:test";
import type { StoryNode } from "../../types";

// Extract the createPrompt logic for testing
const createPrompt = (path: StoryNode[], depth: number) => {
  // Get the story context from the current path
  const context = path
    .slice(0, depth + 1)
    .map((node) => node.text)
    .reduce((acc, text, index) => {
      if (index === 0) return text;

      // Normalize whitespace at boundaries:
      // If both have whitespace at the boundary, collapse to single space
      const prevEndsWithSpace = /\s$/.test(acc);
      const currStartsWithSpace = /^\s/.test(text);

      if (prevEndsWithSpace && currStartsWithSpace) {
        // Trim the duplicate whitespace from the current text
        return acc + text.trimStart();
      } else {
        // Normal concatenation - preserve all whitespace
        return acc + text;
      }
    }, "");

  return context;
};

describe("prompt concatenation", () => {
  it("preserves single spaces between nodes", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Once upon a time", continuations: [] },
      { id: "2", text: " in a land far away", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Once upon a time in a land far away");
  });

  it("collapses double spaces at node boundaries", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Once upon a time ", continuations: [] },
      { id: "2", text: " in a land far away", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Once upon a time in a land far away");
  });

  it("handles nodes with no separating space", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Hello", continuations: [] },
      { id: "2", text: "world", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Helloworld");
  });

  it("preserves newlines between nodes", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Chapter 1\n", continuations: [] },
      { id: "2", text: "It was a dark night.", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Chapter 1\nIt was a dark night.");
  });

  it("collapses multiple newlines at boundaries", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Chapter 1\n\n", continuations: [] },
      { id: "2", text: "\nIt was a dark night.", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Chapter 1\n\nIt was a dark night.");
  });

  it("handles word mode tokens with leading spaces correctly", () => {
    // Simulating typical word mode output
    const path: StoryNode[] = [
      { id: "1", text: "Once", continuations: [] },
      { id: "2", text: " upon", continuations: [] },
      { id: "3", text: " a", continuations: [] },
      { id: "4", text: " time", continuations: [] },
    ];
    const prompt = createPrompt(path, 3);
    expect(prompt).toBe("Once upon a time");
  });

  it("handles mixed whitespace at boundaries", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Hello\t", continuations: [] },
      { id: "2", text: " world", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Hello\tworld");
  });

  it("handles empty nodes gracefully", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Hello", continuations: [] },
      { id: "2", text: "", continuations: [] },
      { id: "3", text: " world", continuations: [] },
    ];
    const prompt = createPrompt(path, 2);
    expect(prompt).toBe("Hello world");
  });

  it("respects depth parameter", () => {
    const path: StoryNode[] = [
      { id: "1", text: "Once", continuations: [] },
      { id: "2", text: " upon", continuations: [] },
      { id: "3", text: " a", continuations: [] },
      { id: "4", text: " time", continuations: [] },
    ];
    const prompt = createPrompt(path, 1);
    expect(prompt).toBe("Once upon");
  });
});
