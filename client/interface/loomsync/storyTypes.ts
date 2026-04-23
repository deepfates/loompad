import type { Loom } from "../../../vendor/loomsync/packages/core/src/types";
import type { TextPayload } from "../../../vendor/loomsync/packages/text/src/types";

export type StoryLoomMeta = { title: string; rootText: string };
export type StoryEntryMeta = { title: string; rootText: string };
export type StoryLoom = Loom<TextPayload, StoryLoomMeta>;
