import { describe, expect, it } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  createBrowserLoomClient,
  type BrowserLoomClientOptions,
} from "../src/browser.js";

describe("browser loom client", () => {
  it("creates looms and indexes on one shared browser repo", async () => {
    const repo = new Repo();
    const client = createBrowserLoomClient<
      { text: string },
      { title: string },
      never,
      { title: string },
      { app: string }
    >({
      repo,
    });

    const info = await client.looms.create({ title: "Story" });
    const loom = await client.looms.open(info.id);
    const turn = await loom.appendTurn(null, { text: "Hello" });

    const index = await client.indexes.create({ app: "textile" });
    await index.addLoom(client.references.loom(info.id), { title: "Story" });

    expect(info.id.startsWith("automerge:")).toBe(true);
    expect(turn.loomId).toBe(info.id);
    await expect(index.entries()).resolves.toEqual([
      expect.objectContaining({
        ref: { v: 1, kind: "loom", loomId: info.id },
        title: "Story",
      }),
    ]);
    expect(client.repo).toBe(repo);

    await client.close();
  });

  it("opens loom, turn, thread, and index references", async () => {
    const client = createBrowserLoomClient<{ text: string }>({ repo: new Repo() });
    const info = await client.looms.create();
    const loom = await client.looms.open(info.id);
    const first = await loom.appendTurn(null, { text: "A" });
    const second = await loom.appendTurn(first.id, { text: "B" });
    const index = await client.indexes.create();

    await expect(client.openReference(client.references.loom(info.id))).resolves.toMatchObject({
      kind: "loom",
      loom: { id: info.id },
    });
    await expect(
      client.openReference(client.references.turn(info.id, second.id)),
    ).resolves.toMatchObject({ kind: "turn", turn: second });
    await expect(
      client.openReference(client.references.thread(info.id, second.id)),
    ).resolves.toMatchObject({ kind: "thread", thread: [first, second], target: second });
    await expect(client.openReference(client.references.index(index.id))).resolves.toMatchObject({
      kind: "index",
      index: { id: index.id },
    });

    await client.close();
  });

  it("assembles a browser client from runtime options", async () => {
    const options: BrowserLoomClientOptions = {
      repo: new Repo(),
      browser: {
        indexedDb: false,
        broadcastChannel: false,
        websocket: false,
      },
    };

    const client = createBrowserLoomClient(options);

    expect(client.looms).toBeDefined();
    expect(client.indexes).toBeDefined();

    await client.close();
  });
});
