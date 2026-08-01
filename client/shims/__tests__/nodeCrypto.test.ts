import { describe, expect, it } from "bun:test";

import { createHash } from "../nodeCrypto";

describe("browser node:crypto SHA-256 shim", () => {
  it("matches standard SHA-256 vectors", () => {
    expect(createHash("sha256").update("").digest("hex")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(createHash("sha256").update("abc").digest("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(createHash("sha256").update("a").update("b").update("c").digest("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches fixed vectors across padding and compression boundaries", () => {
    const vectors = new Map([
      [55, "463eb28e72f82e0a96c0a4cc53690c571281131f672aa229e0d45ae59b598b59"],
      [56, "da2ae4d6b36748f2a318f23e7ab1dfdf45acdc9d049bd80e59de82a60895f562"],
      [63, "29af2686fd53374a36b0846694cc342177e428d1647515f078784d69cdb9e488"],
      [64, "fdeab9acf3710362bd2658cdc9a29e8f9c757fcf9811603a8c447cd1d9151108"],
      [65, "4bfd2c8b6f1eec7a2afeb48b934ee4b2694182027e6d0fc075074f2fabb31781"],
    ]);
    for (const [size, expected] of vectors) {
      const bytes = new Uint8Array(size);
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    }
  });

  it("is independent of update boundaries across many blocks", () => {
    const bytes = new Uint8Array(4099);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
    const expected = "5bfe486adf0afd901e2fb5cc72f10fa382239697a82f04e2e8de9b3d789b5771";
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);

    const chunked = createHash("sha256");
    for (const [start, end] of [[0, 1], [1, 63], [63, 64], [64, 129], [129, 4096], [4096, 4099]]) {
      chunked.update(bytes.subarray(start, end));
    }
    expect(chunked.digest("hex")).toBe(expected);
  });
});
