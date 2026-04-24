import { describe, expect, it } from "bun:test";
import { createMemoryLooms } from "../../../../vendor/loomsync/packages/core/src/memory";
import type { TextPayload } from "../../../../vendor/loomsync/packages/text/src/types";
import {
  appendStoryDrafts,
  appendStoryRevision,
  projectStoryTree,
} from "../storyLoom";
import type { StoryDraft, StoryLoomMeta, StoryTurnMeta } from "../storyTypes";

function createLooms() {
  let nextId = 0;
  return createMemoryLooms<TextPayload, StoryLoomMeta, StoryTurnMeta>({
    createId: () => `turn-${++nextId}`,
    now: () => 1000 + nextId,
  });
}

describe("Loompad story loom", () => {
  it("appends story drafts as LoomSync turns with durable generated IDs", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story" });
    const loom = await looms.open(info.id);
    const seed = await loom.appendTurn(null, { text: "Start" }, { role: "prose" });

    await appendStoryDrafts(loom, seed.id, [
      { text: "A" },
      { text: "B" },
    ]);

    const children = await loom.childrenOf(seed.id);
    expect(children.map((turn) => ({
      id: turn.id,
      parentId: turn.parentId,
      payload: turn.payload,
      meta: turn.meta,
    }))).toEqual([
      {
        id: "turn-3",
        parentId: seed.id,
        payload: { text: "A" },
        meta: { role: "prose" },
      },
      {
        id: "turn-4",
        parentId: seed.id,
        payload: { text: "B" },
        meta: { role: "prose" },
      },
    ]);
  });

  it("projects a branching loom in canonical child order", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story" });
    const loom = await looms.open(info.id);
    const seed = await loom.appendTurn(null, { text: "Start" }, { role: "prose" });

    await appendStoryDrafts(loom, seed.id, [
      { text: "A" },
      { text: "B" },
    ]);

    const [first] = await loom.childrenOf(seed.id);
    await appendStoryDrafts(loom, first.id, [{ text: "C" }]);

    expect(await projectStoryTree(loom, "Start")).toEqual({
      root: {
        id: seed.id,
        text: "Start",
        continuations: [
          {
            id: first.id,
            text: "A",
            continuations: [
              {
                id: "turn-5",
                text: "C",
                continuations: [],
              },
            ],
          },
          {
            id: "turn-4",
            text: "B",
            continuations: [],
          },
        ],
      },
    });
  });

  it("saves edits as a new sibling revision without copying descendants", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story" });
    const loom = await looms.open(info.id);

    const seed = await loom.appendTurn(null, { text: "Start" }, { role: "prose" });
    const original = await loom.appendTurn(seed.id, { text: "Original" });
    await loom.appendTurn(original.id, { text: "Original child" });

    const revision: StoryDraft = {
      text: "Edited",
      continuations: [
        {
          text: "Split tail",
          continuations: [],
        },
      ],
    };
    const appended = await appendStoryRevision(
      loom,
      seed.id,
      revision,
      original.id,
    );
    const tree = await projectStoryTree(loom, "Start");

    expect(tree.root.text).toBe("Start");
    expect(tree.root.continuations?.map((node) => node.text)).toEqual([
      "Original",
      "Edited",
    ]);
    expect(tree.root.continuations?.[0].continuations?.map((node) => node.text))
      .toEqual(["Original child"]);
    expect(tree.root.continuations?.[1]).toEqual({
      id: appended.id,
      text: "Edited",
      continuations: [
        {
          id: "turn-6",
          text: "Split tail",
          continuations: [],
        },
      ],
    });
  });

  it("saves root edits as top-level turn revisions without overwriting meta", async () => {
    const looms = createLooms();
    const info = await looms.create({ title: "Story" });
    const loom = await looms.open(info.id);

    const original = await loom.appendTurn(null, { text: "Start" }, { role: "prose" });
    await loom.appendTurn(original.id, { text: "Original child" }, { role: "prose" });

    const appended = await appendStoryRevision(
      loom,
      null,
      { text: "Edited root", continuations: [] },
      original.id,
    );

    expect((await loom.info()).meta).toEqual({ title: "Story" });
    expect((await loom.childrenOf(null)).map((turn) => turn.payload.text)).toEqual([
      "Start",
      "Edited root",
    ]);
    expect(appended.meta).toEqual({ role: "revision", revises: original.id });
    expect(await projectStoryTree(loom, "Start")).toEqual({
      root: {
        id: appended.id,
        text: "Edited root",
        continuations: [],
      },
    });
  });
});
