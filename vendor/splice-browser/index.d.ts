export interface BrowserArchiveEntry {
  path: string;
  text: string;
}

export interface TwitterArchiveBrowserResult {
  snapshot: {
    loom: { id: string; meta: Record<string, unknown>; createdAt: number };
    turns: Array<{
      id: string;
      loomId: string;
      parentId: string | null;
      payload: { text: string; message: string };
      meta?: Record<string, unknown>;
      createdAt: number;
    }>;
  };
  stats: {
    sourceRecords: number;
    readableRecords: number;
    tweets: number;
    retweets: number;
    likes: number;
    malformedRecords: number;
    unresolvedReplies: number;
    ownerHandle: string;
    accountId: string | null;
  };
}

export function twitterArchiveEntriesToConversation(
  entries: readonly BrowserArchiveEntry[],
): Promise<TwitterArchiveBrowserResult>;
