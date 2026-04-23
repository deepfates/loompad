import { describe, expect, it } from "vitest";
import {
  createIndexShareUrl,
  getIndexIdFromUrl,
  openIndexWithRetry,
  tryOpenIndexFromUrl,
  tryOpenIndexWithRetry,
} from "../src/links.js";
import { LoomError } from "../../core/src/errors.js";
import type { LoomIndexes } from "../src/types.js";

describe("index link helpers", () => {
  it("reads index ids from query params and hashes", () => {
    expect(getIndexIdFromUrl(new URL("https://loom.test/?index=abc"))).toBe("abc");
    expect(getIndexIdFromUrl(new URL("https://loom.test/?worlds=def"))).toBe("def");
    expect(getIndexIdFromUrl(new URL("https://loom.test/#index=ghi"))).toBe("ghi");
  });

  it("creates stable index share urls and clears root params", () => {
    expect(
      createIndexShareUrl(
        "automerge:index",
        new URL("https://loom.test/path?story=old&root=old#story=old"),
      ),
    ).toBe("https://loom.test/path?index=automerge%3Aindex");
  });
});

describe("openIndexWithRetry", () => {
  it("retries opening indexes that may still be arriving over sync", async () => {
    let attempts = 0;
    const indexes = {
      async openIndex() {
        attempts += 1;
        if (attempts < 2) throw new LoomError("UNKNOWN_ROOT", "missing");
        return { id: "idx" };
      },
    } as unknown as LoomIndexes;

    await expect(
      openIndexWithRetry(indexes, "idx", { attempts: 2, delayMs: 1 }),
    ).resolves.toMatchObject({ id: "idx" });
    expect(attempts).toBe(2);
  });

  it("can return null instead of aborting for missing shared indexes", async () => {
    const indexes = {
      async openIndex() {
        throw new LoomError("UNKNOWN_ROOT", "missing");
      },
    } as unknown as LoomIndexes;

    await expect(
      tryOpenIndexWithRetry(indexes, "missing", { attempts: 1, delayMs: 1 }),
    ).resolves.toBeNull();
    await expect(
      tryOpenIndexFromUrl(indexes, new URL("https://loom.test/?index=missing"), {
        attempts: 1,
        delayMs: 1,
      }),
    ).resolves.toBeNull();
  });

  it("opens indexes from share urls when available", async () => {
    const indexes = {
      async openIndex(indexId: string) {
        return { id: indexId };
      },
    } as unknown as LoomIndexes;

    await expect(
      tryOpenIndexFromUrl(indexes, new URL("https://loom.test/?index=idx"), {
        attempts: 1,
        delayMs: 1,
      }),
    ).resolves.toMatchObject({ indexId: "idx", index: { id: "idx" } });
  });
});
