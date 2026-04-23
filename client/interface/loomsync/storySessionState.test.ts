import { describe, expect, it } from "bun:test";
import {
  getPreferredChildIndex,
  setPreferredChildIndex,
} from "./storySessionState";

describe("story session state", () => {
  it("keeps preferred child selection outside story world data", () => {
    setPreferredChildIndex("Story 1", "node-a", 2);

    expect(getPreferredChildIndex("Story 1", "node-a", 3)).toBe(2);
    expect(getPreferredChildIndex("Story 1", "node-a", 2)).toBe(0);
    expect(getPreferredChildIndex("Story 2", "node-a", 3)).toBe(0);
  });
});
