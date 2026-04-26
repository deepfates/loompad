import { describe, expect, it } from "bun:test";
import {
  getPreferredChildIndex,
  setPreferredChildIndex,
} from "../storySessionState";

describe("story session state", () => {
  it("stores preferred child selection outside shared story content", () => {
    setPreferredChildIndex("root-a", "node-a", 2);

    expect(getPreferredChildIndex("root-a", "node-a", 3, 0)).toBe(2);
    expect(getPreferredChildIndex("root-a", "node-a", 2, 0)).toBe(0);
    expect(getPreferredChildIndex("root-b", "node-a", 3, 1)).toBe(1);
  });
});
