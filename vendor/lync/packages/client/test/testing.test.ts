import { describe, expect, it } from "vitest";
import {
  assertTextStoryThread,
  textStoryLoomMeta,
  type TextStoryLoomMeta,
  type TextStoryTurnMeta,
  type TextStoryTurnPayload,
} from "../../core/src/profiles/text-story";
import { createTestLoomClient } from "../src/testing.js";

describe("test loom client", () => {
  it("provides deterministic in-memory looms, indexes, and references", async () => {
    let nextId = 1;
    const client = createTestLoomClient<{ text: string }, { title: string }>({
      createId: () => `id-${nextId++}`,
      now: () => 123,
    });

    const info = await client.looms.create({ title: "Test story" });
    const loom = await client.looms.open(info.id);
    const first = await loom.appendTurn(null, { text: "A" });
    const second = await loom.appendTurn(first.id, { text: "B" });
    const index = await client.indexes.create();
    await index.addLoom(client.references.loom(info.id), { title: "Test story" });

    await expect(client.openReference(client.references.thread(info.id, second.id))).resolves.toMatchObject({
      kind: "thread",
      thread: [first, second],
    });
    await expect(index.entries()).resolves.toEqual([
      expect.objectContaining({
        ref: client.references.loom(info.id),
        title: "Test story",
      }),
    ]);

    await client.close();
  });

  it("lets independent writers create text-story looms that readers open by reference", async () => {
    let nextId = 1;
    const writer = createTestLoomClient<
      TextStoryTurnPayload,
      TextStoryLoomMeta,
      TextStoryTurnMeta
    >({
      createId: () => `id-${nextId++}`,
      now: () => 456,
    });

    const info = await writer.looms.create(
      textStoryLoomMeta({ title: "External story" }),
    );
    const loom = await writer.looms.open(info.id);
    const opening = await loom.appendTurn(
      null,
      { text: "Once" },
      { role: "prose" },
    );
    const next = await loom.appendTurn(
      opening.id,
      { text: " later" },
      { role: "prose" },
    );

    const opened = await writer.openReference(
      writer.references.thread(info.id, next.id),
    );
    expect(opened.kind).toBe("thread");
    if (opened.kind !== "thread") throw new Error("Expected thread reference");
    assertTextStoryThread(opened.thread);
    expect(opened.thread.map((turn) => turn.payload.text).join("")).toBe(
      "Once later",
    );

    await writer.close();
  });
});
