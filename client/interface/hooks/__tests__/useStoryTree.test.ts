import { describe, expect, it } from "bun:test";
import { loomRef } from "../../../../vendor/lync/packages/core/src/references";
import { createTestLoomClient } from "../../../../vendor/lync/packages/client/src/testing";
import { textStoryLoomMeta } from "../../../../vendor/lync/packages/core/src/profiles/text-story";
import {
  INITIAL_STORY,
  loadReachableStoryEntries,
} from "../useStoryTree";
import type {
  StoryEntryMeta,
  StoryLoomMeta,
  StoryTurnMeta,
  StoryTurnPayload,
} from "../../lync/storyTypes";

describe("loadReachableStoryEntries", () => {
  it("skips unreachable index entries while keeping reachable stories", async () => {
    let nextId = 0;
    const client = createTestLoomClient<
      StoryTurnPayload,
      StoryLoomMeta,
      StoryTurnMeta,
      StoryEntryMeta
    >({
      createId: () => `id-${++nextId}`,
      now: () => nextId,
    });
    const info = await client.looms.create(
      textStoryLoomMeta({ title: "Reachable story" }),
    );
    const loom = await client.looms.open(info.id);
    await loom.appendTurn(null, { text: "Reachable opening" }, { role: "prose" });
    const skipped: string[] = [];

    const loaded = await loadReachableStoryEntries(
      [
        {
          ref: loomRef("memory:missing"),
          title: "Broken story",
          addedAt: 1,
        },
        {
          ref: loomRef(info.id),
          title: "Reachable listing",
          addedAt: 2,
        },
      ],
      (loomId) => client.looms.open(loomId),
      INITIAL_STORY.root.text,
      (loomId) => skipped.push(loomId),
    );

    expect(skipped).toEqual(["memory:missing"]);
    expect(loaded.orderedIds).toEqual([info.id]);
    expect(Object.keys(loaded.loomsById)).toEqual([info.id]);
    expect(loaded.titles).toEqual({ [info.id]: "Reachable listing" });
    expect(loaded.trees[info.id].root.text).toBe("Reachable opening");

    await client.close();
  });
});
