import { describe, expect, it } from "vitest";
import {
  createRootShareUrl,
  getRootIdFromUrl,
  openRootWithRetry,
  tryOpenRootFromUrl,
  tryOpenRootWithRetry,
} from "../src/links.js";
import { unknownRoot } from "../src/errors.js";
import type { LoomWorlds } from "../src/types.js";

describe("root link helpers", () => {
  it("reads root ids from query params and hashes", () => {
    expect(getRootIdFromUrl(new URL("https://loom.test/?story=abc"))).toBe("abc");
    expect(getRootIdFromUrl(new URL("https://loom.test/?root=def"))).toBe("def");
    expect(getRootIdFromUrl(new URL("https://loom.test/#ghi"))).toBe("ghi");
    expect(getRootIdFromUrl(new URL("https://loom.test/#root=jkl"))).toBe("jkl");
  });

  it("creates stable root share urls", () => {
    expect(
      createRootShareUrl(
        "automerge:root",
        new URL("https://loom.test/path?x=1&root=old#old"),
      ),
    ).toBe("https://loom.test/path?x=1&story=automerge%3Aroot");
  });
});

describe("openRootWithRetry", () => {
  it("retries opening roots that may still be arriving over sync", async () => {
    let attempts = 0;
    const worlds = {
      async openRoot() {
        attempts += 1;
        if (attempts < 3) throw unknownRoot("root");
        return { id: "root" };
      },
    } as unknown as LoomWorlds;

    await expect(
      openRootWithRetry(worlds, "root", { attempts: 3, delayMs: 1 }),
    ).resolves.toMatchObject({ id: "root" });
    expect(attempts).toBe(3);
  });

  it("can return null instead of aborting for missing shared roots", async () => {
    const worlds = {
      async openRoot() {
        throw unknownRoot("missing");
      },
    } as unknown as LoomWorlds;

    await expect(
      tryOpenRootWithRetry(worlds, "missing", { attempts: 1, delayMs: 1 }),
    ).resolves.toBeNull();
    await expect(
      tryOpenRootFromUrl(worlds, new URL("https://loom.test/?story=missing"), {
        attempts: 1,
        delayMs: 1,
      }),
    ).resolves.toBeNull();
  });

  it("opens roots from share urls when available", async () => {
    const worlds = {
      async openRoot(rootId: string) {
        return { id: rootId };
      },
    } as unknown as LoomWorlds;

    await expect(
      tryOpenRootFromUrl(worlds, new URL("https://loom.test/?story=root"), {
        attempts: 1,
        delayMs: 1,
      }),
    ).resolves.toMatchObject({ rootId: "root", world: { id: "root" } });
  });
});
