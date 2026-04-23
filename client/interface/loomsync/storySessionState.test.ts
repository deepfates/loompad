import { describe, expect, it } from "bun:test";
import {
  getPreferredChildIndex,
  setPreferredChildIndex,
} from "./storySessionState";

describe("story session state", () => {
  it("keeps preferred child selection outside story world data", () => {
    setPreferredChildIndex("story", "node", 2);
    expect(getPreferredChildIndex("story", "node", 3, 0)).toBe(2);
    expect(getPreferredChildIndex("story", "node", 2, 0)).toBe(0);
  });
});
