import { describe, expect, it } from "bun:test";

import { readOnlySnapshotLoom } from "../snapshotLoom";

describe("readOnlySnapshotLoom", () => {
  it("reads the supplied snapshot directly and rejects invented mutations", async () => {
    const snapshot = {
      loom: { id: "archive", meta: { title: "Archive" }, createdAt: 1 },
      turns: [
        { id: "root", loomId: "archive", parentId: null, payload: { text: "Root" }, createdAt: 1 },
        { id: "child", loomId: "archive", parentId: "root", payload: { text: "Child" }, createdAt: 2 },
      ],
    };
    const loom = readOnlySnapshotLoom(snapshot);

    expect(await loom.childrenOf(null)).toEqual([snapshot.turns[0]]);
    expect(await loom.threadTo("child")).toEqual(snapshot.turns);
    expect(await loom.export()).toBe(snapshot);
    await expect(loom.appendTurn("child", { text: "Mutation" })).rejects.toThrow(
      "read-only",
    );
  });
});
