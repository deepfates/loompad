import { describe, expect, it } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { createAutomergeLooms } from "../src/automerge.js";
import type { LoomSnapshot } from "../src/types.js";

type Payload = { text: string };
type LoomMeta = { title: string };

function deterministicAutomergeLooms() {
  let nextId = 0;
  let nextTime = 3000;
  return createAutomergeLooms<Payload, LoomMeta>({
    repo: new Repo(),
    createTurnId: () => `turn-${++nextId}`,
    now: () => nextTime++,
  });
}

describe("automerge looms", () => {
  it("uses the Automerge document URL as the loom id", async () => {
    const looms = deterministicAutomergeLooms();
    const info = await looms.create({ title: "Story 1" });

    expect(info.id.startsWith("automerge:")).toBe(true);
    await expect(looms.open(info.id)).resolves.toMatchObject({ id: info.id });
  });

  it("appends turns and preserves canonical child-list order", async () => {
    const looms = deterministicAutomergeLooms();
    const info = await looms.create({ title: "Story 1" });
    const loom = await looms.open(info.id);

    const first = await loom.appendTurn(null, { text: "Once" });
    const left = await loom.appendTurn(first.id, { text: " left" });
    const right = await loom.appendTurn(first.id, { text: " right" });

    expect(await loom.childrenOf(first.id)).toEqual([left, right]);
    expect(await loom.threadTo(right.id)).toEqual([first, right]);
    expect(await loom.leaves()).toEqual([left, right]);
  });

  it("imports a snapshot with preserved turn ids and a new loom id", async () => {
    const looms = deterministicAutomergeLooms();
    const snapshot: LoomSnapshot<Payload, LoomMeta> = {
      loom: { id: "snapshot:story", meta: { title: "Imported" }, createdAt: 10 },
      turns: [
        {
          id: "a",
          loomId: "snapshot:story",
          parentId: null,
          payload: { text: "A" },
          createdAt: 11,
        },
        {
          id: "b",
          loomId: "snapshot:story",
          parentId: "a",
          payload: { text: "B" },
          createdAt: 12,
        },
      ],
    };

    const info = await looms.import(snapshot);
    const loom = await looms.open(info.id);
    const exported = await loom.export();

    expect(info.id).not.toBe(snapshot.loom.id);
    expect(exported.turns.map((turn) => turn.id)).toEqual(["a", "b"]);
    expect(exported.turns.every((turn) => turn.loomId === info.id)).toBe(true);
  });

  it("emits turn-added when another handle observes the same document change", async () => {
    const looms = deterministicAutomergeLooms();
    const info = await looms.create({ title: "Story 1" });
    const observer = await looms.open(info.id);
    const writer = await looms.open(info.id);
    const events: string[] = [];
    observer.subscribe((event) => {
      if (event.type === "turn-added") events.push(event.turn.id);
    });

    const first = await writer.appendTurn(null, { text: "Remote-ish" });

    expect(events).toEqual([first.id]);
  });

  it("rejects invalid imported topologies", async () => {
    const looms = deterministicAutomergeLooms();
    await expect(
      looms.import({
        loom: { id: "snapshot:story", meta: { title: "Bad" }, createdAt: 10 },
        turns: [
          {
            id: "a",
            loomId: "snapshot:story",
            parentId: "missing",
            payload: { text: "A" },
            createdAt: 11,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "MISSING_PARENT" });

    await expect(
      looms.import({
        loom: { id: "snapshot:story", meta: { title: "Bad" }, createdAt: 10 },
        turns: [
          {
            id: "a",
            loomId: "snapshot:story",
            parentId: "b",
            payload: { text: "A" },
            createdAt: 11,
          },
          {
            id: "b",
            loomId: "snapshot:story",
            parentId: "a",
            payload: { text: "B" },
            createdAt: 12,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "CYCLE_DETECTED" });
  });
});
