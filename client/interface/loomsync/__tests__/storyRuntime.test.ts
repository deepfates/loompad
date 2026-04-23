import { describe, expect, it } from "bun:test";
import {
  createStoryIndexShareUrl,
  createStoryShareUrl,
  getStoryIndexIdFromLocation,
  getStoryRootIdFromLocation,
} from "../storyRuntime";

describe("story runtime links", () => {
  it("creates story share URLs without carrying index parameters", () => {
    const location = new URL("https://loompad.test/?index=index-1&theme=dark");

    const url = new URL(createStoryShareUrl("root-1", location));

    expect(url.searchParams.get("story")).toBe("root-1");
    expect(url.searchParams.get("index")).toBe("index-1");
    expect(url.searchParams.get("theme")).toBe("dark");
  });

  it("creates story index share URLs without carrying story parameters", () => {
    const location = new URL(
      "https://loompad.test/?story=root-1&root=legacy&theme=dark",
    );

    const url = new URL(createStoryIndexShareUrl("index-1", location));

    expect(url.searchParams.get("index")).toBe("index-1");
    expect(url.searchParams.get("story")).toBeNull();
    expect(url.searchParams.get("root")).toBeNull();
    expect(url.searchParams.get("theme")).toBe("dark");
  });

  it("reads modern and legacy share parameters", () => {
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/?story=root-1")),
    ).toBe("root-1");
    expect(
      getStoryRootIdFromLocation(new URL("https://loompad.test/?root=root-2")),
    ).toBe("root-2");
    expect(
      getStoryIndexIdFromLocation(new URL("https://loompad.test/?index=i-1")),
    ).toBe("i-1");
    expect(
      getStoryIndexIdFromLocation(new URL("https://loompad.test/?worlds=i-2")),
    ).toBe("i-2");
  });
});
