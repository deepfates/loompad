import { createMemoryLooms, type MemoryLoomsOptions } from "../../core/src/memory";
import { createMemoryLoomIndexes, type MemoryLoomIndexesOptions } from "../../index/src/memory";
import { createLoomClient } from "./create.js";
import type { LoomClient } from "./types.js";

export interface TestLoomClientOptions {
  createId?: () => string;
  now?: () => number;
  looms?: MemoryLoomsOptions;
  indexes?: MemoryLoomIndexesOptions;
}

export function createTestLoomClient<
  TPayload = unknown,
  TLoomMeta = unknown,
  TTurnMeta = unknown,
  TEntryMeta = unknown,
  TIndexMeta = unknown,
>(
  options: TestLoomClientOptions = {},
): LoomClient<TPayload, TLoomMeta, TTurnMeta, TEntryMeta, TIndexMeta> {
  const defaultOptions = {
    createId: options.createId,
    now: options.now,
  };
  const looms = createMemoryLooms<TPayload, TLoomMeta, TTurnMeta>({
    ...defaultOptions,
    ...options.looms,
  });
  const indexes = createMemoryLoomIndexes<TEntryMeta, TIndexMeta>({
    ...defaultOptions,
    ...options.indexes,
  });

  return createLoomClient({ looms, indexes });
}
