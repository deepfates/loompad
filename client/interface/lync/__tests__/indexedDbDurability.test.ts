import { describe, expect, it } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { createIndexedDbEventStore } from "@deepfates/lync/idb-log";
import type { LyncEventBody } from "@deepfates/lync/events";
import { serializeLyncEvent } from "@deepfates/lync/store";

const at = "2026-09-06T21:31:13.000Z";

function event(
  id: string,
  kind: string,
  parents: string[] = [],
  payload: Record<string, unknown> = {},
): LyncEventBody {
  return {
    v: 1,
    id,
    kind,
    at,
    author: { actor: "textile-durability-regression" },
    parents,
    payload,
  };
}

describe("installed Lync IndexedDB durability", () => {
  it("reopens every resolved curation mutation while an archive batch is suspended", async () => {
    const indexedDB = new IDBFactory();
    const dbName = "textile-import-curation-overlap";
    const store = createIndexedDbEventStore({ dbName, indexedDB });
    const importedRoot = event(
      "019fcb10-0000-7000-8000-000000000001",
      "twitter/tweet",
      [],
      { full_text: "Imported archive root" },
    );
    const importedReply = event(
      "019fcb10-0000-7000-8000-000000000002",
      "twitter/tweet",
      [importedRoot.id],
      { full_text: "Imported archive reply" },
    );
    const keep = event(
      "019fcb10-0000-7000-8000-000000000003",
      "lync/mark",
      [importedRoot.id],
      { label: "selection", target: importedRoot.id },
    );
    const note = event(
      "019fcb10-0000-7000-8000-000000000004",
      "curare/annotation",
      [importedRoot.id],
      { label: "note", text: "Keep this source context." },
    );
    const cluster = event(
      "019fcb10-0000-7000-8000-000000000005",
      "lync/mark",
      [importedRoot.id],
      { label: "cluster", target: importedRoot.id },
    );

    let announceSuspension!: () => void;
    let releaseImport!: () => void;
    const suspended = new Promise<void>((resolve) => {
      announceSuspension = resolve;
    });
    const released = new Promise<void>((resolve) => {
      releaseImport = resolve;
    });
    async function* archiveImport() {
      yield importedRoot;
      announceSuspension();
      await released;
      yield importedReply;
    }

    const importing = store.appendMany(archiveImport());
    await suspended;

    const expectDurableAfterReopen = async (id: string) => {
      const reopened = createIndexedDbEventStore({ dbName, indexedDB });
      await expect(reopened.byId(id)).resolves.toMatchObject({ body: { id } });
    };

    try {
      await expect(store.append(keep)).resolves.toMatchObject({ status: "added" });
      await expectDurableAfterReopen(keep.id);

      await expect(store.union(serializeLyncEvent(note))).resolves.toMatchObject({
        status: "added",
      });
      await expectDurableAfterReopen(note.id);

      await expect(store.appendMany([cluster])).resolves.toEqual([
        expect.objectContaining({ status: "added" }),
      ]);
      await expectDurableAfterReopen(cluster.id);
    } finally {
      releaseImport();
      await importing;
    }

    const reopened = createIndexedDbEventStore({ dbName, indexedDB });
    await expect(reopened.byRoot(importedRoot.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ body: expect.objectContaining({ id: importedRoot.id }) }),
        expect.objectContaining({ body: expect.objectContaining({ id: importedReply.id }) }),
        expect.objectContaining({ body: expect.objectContaining({ id: keep.id }) }),
        expect.objectContaining({ body: expect.objectContaining({ id: note.id }) }),
        expect.objectContaining({ body: expect.objectContaining({ id: cluster.id }) }),
      ]),
    );
  });
});
