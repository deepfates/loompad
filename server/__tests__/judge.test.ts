import { describe, expect, it } from "bun:test";

import { JudgeTimeoutError, withJudgeTimeout } from "../apis/judge";

describe("judge deadline", () => {
  it("aborts and fails visibly when a provider never settles", async () => {
    let aborted = false;
    const never = new Promise<never>(() => {});

    await expect(
      withJudgeTimeout(never, () => {
        aborted = true;
      }, 5),
    ).rejects.toBeInstanceOf(JudgeTimeoutError);
    expect(aborted).toBe(true);
  });

  it("returns a result without aborting when the judge settles", async () => {
    let aborted = false;
    const result = await withJudgeTimeout(
      Promise.resolve({ choice: 2 }),
      () => {
        aborted = true;
      },
      50,
    );

    expect(result).toEqual({ choice: 2 });
    expect(aborted).toBe(false);
  });
});
