import { describe, expect, it } from "bun:test";
import { strToU8, zipSync } from "fflate";

import { importTwitterArchiveFile } from "../twitterArchiveImport";
import { openStoryLoom } from "../storyRuntime";
import { projectStoryTree } from "../storyLoom";

const manifest = `window.__THAR_CONFIG = {
  dataTypes: {
    tweets: { files: [{ fileName: "data/tweets.js" }] },
    like: { files: [{ fileName: "data/like.js" }] },
  },
};`;
const account = `window.YTD.account.part0 = [{ account: {
  accountId: "42", username: "archivist", email: "private@example.com",
} }];`;
const tweets = `window.YTD.tweets.part0 = [
  { tweet: { id: "100", full_text: "Archive root", private_metadata: "MUST NOT SYNC", createdAt: "2026-01-01T00:00:00Z" } },
  { tweet: { id: "101", full_text: "Archive reply", createdAt: "2026-01-01T00:01:00Z", in_reply_to_status_id: "100" } },
];`;
const likes = `window.YTD.like.part0 = [
  { like: { tweetId: "200", fullText: "A liked observation", createdAt: "2026-01-01T00:02:00Z" } },
];`;

describe("ordinary native archive file import", () => {
  it("opens a Twitter ZIP locally as one reviewable Loom", async () => {
    const bytes = zipSync({
      "portable/data/manifest.js": strToU8(manifest),
      "portable/data/account.js": strToU8(account),
      "portable/data/tweets.js": strToU8(tweets),
      "portable/data/like.js": strToU8(likes),
      "portable/data/tweets_media/100-secret.jpg": new Uint8Array([1, 2, 3]),
    });
    const file = new File([bytes], "twitter.zip", { type: "application/zip" });
    const imported = await importTwitterArchiveFile(file);
    expect(imported.kind).toBe("twitter-archive");
    expect(imported.archiveStats).toMatchObject({
      readableRecords: 3,
      tweets: 2,
      likes: 1,
      ownerHandle: "archivist",
    });
    const tree = await projectStoryTree(await openStoryLoom(imported.loomId));
    expect(tree.root.text).toContain("Twitter archive @archivist");
    expect(tree.root.continuations).toHaveLength(2);
    expect(tree.root.continuations?.[0].text).toBe("Archive root");
    expect(tree.root.continuations?.[0].continuations?.[0].text).toBe("Archive reply");
    expect(tree.root.continuations?.[1].archiveSource).toMatchObject({
      kind: "like",
      recordId: "200",
    });
    expect(JSON.stringify(tree)).not.toContain("private@example.com");
    expect(JSON.stringify(tree)).not.toContain("MUST NOT SYNC");
  });
});
