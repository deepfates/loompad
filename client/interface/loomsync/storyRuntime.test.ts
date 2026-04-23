import { describe, expect, it } from "bun:test";
import {
  createStoryShareUrl,
  getStoryRootIdFromLocation,
} from "./storyRuntime";

describe("story runtime URLs", () => {
  it("reads story root ids from query params and hashes", () => {
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/?story=abc") as unknown as Location),
    ).toBe("abc");
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/#root=def") as unknown as Location),
    ).toBe("def");
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/#ghi") as unknown as Location),
    ).toBe("ghi");
  });

  it("creates share urls containing the story root id", () => {
    expect(
      createStoryShareUrl(
        "automerge:story",
        new URL("https://loompad.test/path?x=1#old") as unknown as Location,
      ),
    ).toBe("https://loompad.test/path?x=1&story=automerge%3Astory");
  });
});
