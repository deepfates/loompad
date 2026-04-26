import { describe, expect, it } from "vitest";
import { createMemoryLooms } from "../../core/src/memory.js";
import {
  appendChain,
  flattenThread,
  threadToTextTurns,
  type TextPayload,
} from "../src/index.js";

describe("text helpers", () => {
  it("appends a text chain and flattens the resulting thread", async () => {
    const looms = createMemoryLooms<TextPayload>({
      createId: (() => {
        let id = 0;
        return () => `turn-${++id}`;
      })(),
      now: () => 1,
    });
    const info = await looms.create();
    const loom = await looms.open(info.id);

    const turns = await appendChain(loom, null, [
      { text: "Once" },
      { text: " upon" },
      { text: " a time" },
    ]);

    const thread = await loom.threadTo(turns.at(-1)!.id);
    expect(flattenThread(thread)).toBe("Once upon a time");
    expect(threadToTextTurns(thread)).toEqual([
      { id: "turn-2", text: "Once" },
      { id: "turn-3", text: " upon" },
      { id: "turn-4", text: " a time" },
    ]);
  });
});
