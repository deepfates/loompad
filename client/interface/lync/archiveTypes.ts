/** Explicit source provenance carried by Splice's browser archive projection. */
export interface ArchiveSourceRef {
  profile: "splice/twitter-archive/v1";
  provider: "twitter";
  kind: "tweet" | "retweet" | "like";
  recordId: string;
  parentRecordId: string | null;
  parentHeld: boolean;
  accountId: string | null;
  ownerHandle: string;
  createdAt: string | null;
}
