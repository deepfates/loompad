import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";

const root = join(import.meta.dir, "..", "examples", "twitter-archive");
const names = ["manifest.js", "account.js", "tweets.js", "like.js"];
const entries: Record<string, Uint8Array> = {};
for (const name of names) {
  entries[`textile-twitter-demo/data/${name}`] = strToU8(
    await readFile(join(root, "data", name), "utf8"),
  );
}
const output = join(root, "textile-twitter-demo.zip");
await writeFile(output, zipSync(entries, {
  level: 9,
  // Stable fixture bytes make review and privacy inspection repeatable.
  mtime: new Date("2026-07-26T00:00:00.000Z"),
}));
console.log(output);
