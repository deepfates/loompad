import { describe, expect, it } from "bun:test";
import {
  createStoryIndexShareUrl,
  createStoryShareUrl,
  createStoryThreadShareUrl,
  getStoryReferenceFromLocation,
} from "../storyRuntime";

describe("story runtime references", () => {
  it("creates loom reference URLs without carrying stale parameters", () => {
    const location = new URL("https://loompad.test/?old=1#stale");

    const url = new URL(createStoryShareUrl("loom-1", location));

    expect([...url.searchParams.keys()]).toEqual(["ref"]);
    expect(url.hash).toBe("");
    expect(getStoryReferenceFromLocation(url)).toEqual({
      v: 1,
      kind: "loom",
      loomId: "loom-1",
    });
  });

  it("creates index reference URLs", () => {
    const location = new URL("https://loompad.test/?draft=old");

    const url = new URL(createStoryIndexShareUrl("index-1", location));

    expect([...url.searchParams.keys()]).toEqual(["ref"]);
    expect(getStoryReferenceFromLocation(url)).toEqual({
      v: 1,
      kind: "index",
      indexId: "index-1",
    });
  });

  it("creates thread reference URLs", () => {
    const location = new URL("https://loompad.test/");

    const url = new URL(createStoryThreadShareUrl("loom-1", "turn-1", location));

    expect(getStoryReferenceFromLocation(url)).toEqual({
      v: 1,
      kind: "thread",
      loomId: "loom-1",
      turnId: "turn-1",
    });
  });
});
