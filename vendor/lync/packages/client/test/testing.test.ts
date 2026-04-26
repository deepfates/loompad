import { describe, expect, it } from "vitest";
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
});
