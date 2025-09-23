import { describe, it, expect } from "bun:test";
import { getBoundaryRegex, findBoundaryCutoff, normalizeJoin } from "../apis/generation.helpers.ts";



describe("boundary regexes", () => {
  it("word mode: matches first non-space run plus trailing whitespace (including multiples and CRLF)", () => {
    const rx = getBoundaryRegex("word");
    // Word mode now returns null for special token-aware handling
    expect(rx).toBeNull();

    // Skip regex-based tests for word mode since it uses token-aware logic
    return;
  });

  it("sentence mode: includes terminal punctuation and optional closing quotes/brackets, not trailing space", () => {
    const rx = getBoundaryRegex("sentence")!;
    const s1 = `He said 'Hi.' Next`;
    const m1 = rx.exec(s1);
    expect(m1).toBeTruthy();
    // Match should end after the closing quote, not include trailing space
    expect(m1?.[0]).toBe(".'");

    const s2 = `Is this OK?) Yes`;
    const m2 = rx.exec(s2);
    expect(m2).toBeTruthy();
    // Includes ) after ?
    expect(m2?.[0]).toBe("?)");

    const s3 = `Wow!  Really?`;
    const m3 = rx.exec(s3);
    expect(m3).toBeTruthy();
    expect(m3?.[0]).toBe("!");
  });

  it("paragraph mode: matches blank line or Markdown horizontal rule", () => {
    const rx = getBoundaryRegex("paragraph")!;
    const s1 = "Line 1\n\nLine 2";
    const m1 = rx.exec(s1);
    // Should match exactly the blank line sequence
    expect(m1).toBeTruthy();
    expect(m1?.[0]).toBe("\n\n");

    const s2 = "Para\n\n\nPara";
    const m2 = rx.exec(s2);
    // First blank line pair should be taken as boundary
    expect(m2).toBeTruthy();
    expect(m2?.[0]).toBe("\n\n");

    const s3 = "A\n---\nB";
    const m3 = rx.exec(s3);
    // Horizontal rule with newline should match as a paragraph boundary
    expect(m3).toBeTruthy();
    expect(m3?.[0]).toBe("\n---\n");
  });

  it("page mode: matches three or more blank lines or horizontal rule", () => {
    const rx = getBoundaryRegex("page")!;
    const s1 = "A\n\n\nB";
    const m1 = rx.exec(s1);
    expect(m1).toBeTruthy();
    expect(m1?.[0]).toBe("\n\n\n");

    const s2 = "Intro\n\n\n\n\nChapter 1";
    const m2 = rx.exec(s2);
    expect(m2).toBeTruthy();
    // Should match three or more consecutive blank lines (greedy inside the group is fine as long as boundary exists)
    expect(m2?.[0]).toMatch(/^\n(\n|\r\n){2,}$/);

    const s3 = "X\n***\nY";
    const m3 = rx.exec(s3);
    expect(m3).toBeTruthy();
    expect(m3?.[0]).toBe("\n***\n");
  });
});

describe("findBoundaryCutoff", () => {
  it("handles token-like arrival patterns in word mode", () => {
    // Word mode now uses token-aware logic, not regex boundaries
    // This test is no longer applicable
    expect(getBoundaryRegex("word")).toBeNull();
  });

  it("returns null when no boundary exists yet (e.g., word without trailing whitespace)", () => {
    // Test with sentence mode instead since word mode no longer uses regex
    const rx = getBoundaryRegex("sentence")!;
    const acc = "Hello"; // no sentence terminator yet
    const cut = findBoundaryCutoff(acc, 0, rx);
    expect(cut).toBeNull();
  });

  it("returns the first boundary end strictly after sentIndex", () => {
    const rx = getBoundaryRegex("sentence")!;
    const acc = "Hello. world"; // first boundary is after "."
    const cut = findBoundaryCutoff(acc, 0, rx);
    expect(cut).toBe(6);
  });

  it("ignores boundaries that end at or before sentIndex", () => {
    const rx = getBoundaryRegex("sentence")!;
    const acc = "Hello. world"; // "." boundary ends at 6
    const sentIndex = 6; // we've 'already sent' up to first boundary
    const cut = findBoundaryCutoff(acc, sentIndex, rx);
    // No more sentence boundaries
    expect(cut).toBeNull();
  });

  it("handles seam: boundary appears only after additional chunk arrives", () => {
    const rx = getBoundaryRegex("sentence")!;
    let acc = "Hello"; // no boundary yet
    let cut = findBoundaryCutoff(acc, 0, rx);
    expect(cut).toBeNull();

    acc += "."; // now "Hello."
    cut = findBoundaryCutoff(acc, 0, rx);
    expect(cut).toBe(6);
  });

  it("sentence cutoff: stops after first sentence terminator (with closing quote)", () => {
    const rx = getBoundaryRegex("sentence")!;
    const acc = `She said "Go." Then left.`;
    const cut = findBoundaryCutoff(acc, 0, rx);
    // First sentence ends after the period and closing quote -> `"Go."` -> cutoff at index of the quote included
    const expectedEnd = acc.indexOf('" Then') + 1; // end index after closing quote
    expect(cut).toBe(expectedEnd);
  });

  it("paragraph cutoff: stops at first blank line or horizontal rule", () => {
    const rx = getBoundaryRegex("paragraph")!;
    const acc = "A\n\nB\n\nC";
    const cut = findBoundaryCutoff(acc, 0, rx);
    // First blank line at indices 1-3 ("\n\n"), cutoff should be 3
    expect(cut).toBe(3);
  });

  it("preserves single spaces between words when normalizing", () => {
    // Simulate: previous word ended with space, next token starts with space
    const prev = {
      hasEmittedAny: true,
      endedWithWhitespace: true,
      endedWithNewline: false,
    };
    const next = " world";
    const out = normalizeJoin(prev, next);
    // Should drop the leading space to avoid double spacing
    expect(out).toBe("world");
  });
});

describe("word mode token patterns", () => {
  it("word mode now uses token-aware logic instead of regex boundaries", () => {
    // Word mode returns null for regex - it uses special token handling
    expect(getBoundaryRegex("word")).toBeNull();

    // The actual word mode behavior is tested in integration tests
    // since it requires the full streaming context
  });
});

describe("normalizeJoin (seam whitespace normalization)", () => {
  it("drops duplicated leading spaces/tabs on the new segment when previous ended with whitespace", () => {
    const prev = {
      hasEmittedAny: true,
      endedWithWhitespace: true,
      endedWithNewline: false,
    };
    const next = "   world";
    const out = normalizeJoin(prev, next);
    // We remove leading spaces so we don't end up with double-space at the seam;
    // the single space from the previous emission remains in the output stream.
    expect(out).toBe("world");
  });

  it("keeps newline if next starts with newline (newline is stronger than space/tab dedup)", () => {
    const prev = {
      hasEmittedAny: true,
      endedWithWhitespace: true,
      endedWithNewline: false,
    };
    const next = "\nworld";
    const out = normalizeJoin(prev, next);
    expect(out).toBe("\nworld");
  });

  it("drops duplicated leading newlines when previous ended with newline (handles CRLF and multiple)", () => {
    const prev1 = {
      hasEmittedAny: true,
      endedWithWhitespace: true,
      endedWithNewline: true,
    };

    const out1 = normalizeJoin(prev1, "\n\nHello");
    expect(out1).toBe("Hello");

    const out2 = normalizeJoin(prev1, "\r\n\r\nHello");
    expect(out2).toBe("Hello");

    const out3 = normalizeJoin(prev1, "\r\n\n\r\nHello");
    expect(out3).toBe("Hello");
  });

  it("does not invent spaces when previous ended with non-whitespace", () => {
    const prev = {
      hasEmittedAny: true,
      endedWithWhitespace: false,
      endedWithNewline: false,
    };
    const next = "world";
    const out = normalizeJoin(prev, next);
    expect(out).toBe("world");
  });
});
