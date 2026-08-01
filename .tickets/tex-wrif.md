---
id: tex-wrif
status: in_progress
deps: []
links: []
created: 2026-08-01T12:11:23Z
type: feature
priority: 1
assignee: deepfates
tags: [lync, behold, scale, reader]
---
# Read habitat-scale Lync source sets without whole-file browser materialization

Textile’s local raw-Lync path currently calls File.text(), encodes the complete string again, parses the whole union, and materializes all source and presentation maps. Behold’s active Oxford resident lives are growing about 78 MB/hour combined, so a six-hour union is projected near 0.47 GB before browser-side duplication. Actual failure threshold is unmeasured, but the current path cannot support the claimed multi-day reader horizon with a declared bound.

## Design

Keep Lync bytes canonical and Textile read-only. Accept an ordered set of exact resident Lync sources or an equivalent content-bound source manifest, and parse/project incrementally enough that peak browser memory is declared and bounded. Preserve existing single-file imports, diagnostics, exact source identities, first-parent navigation, and Behold presentation pacts.

## Acceptance Criteria

Through Textile’s ordinary local review path, open a representative habitat source set at least as large as a retained six-hour two-resident checkpoint without constructing a second complete text/byte copy in browser memory; report exact source/event/readable/structural/diagnostic counts; preserve navigation and source identities; fail closed on damaged or conflicting input; and keep existing single-file raw-Lync imports working.


## Notes

**2026-08-01T12:11:36Z**

Discovered from Behold active habitat episode 000002; Behold owning checkpoint-amplification work is beh-e3jy. Current measured combined canonical Lync growth is about 78 MB/hour; six-hour and browser-heap behavior remain to be exercised rather than assumed.

**2026-08-01T12:52:29Z**

An isolated reader candidate exists at commit 0bc65e9 in worktree textile-ordered-prefix-source-set. It validates and reads Behold v2 ordered canonical Lync prefixes and passes 205 tests plus lint/build/diff-check; principal composition with Behold's emitted manifest succeeded. It is not yet integrated or scale-accepted. Prefix hashing is bounded, but the current browser loader/projector still materializes the selected prefixes and projected event model, so actual multi-hour bounded operator use remains the open acceptance.

**2026-08-01T13:07:34Z**

Bounded-path audit against installed Lync 0.3.0 and current sibling 0.4.2 found that Textile cannot honestly satisfy this ticket inside its own repository yet: parseLyncFiles/LyncUnion retain every physical line's bytes and parsed event, then Textile retains source strings plus presentation/navigation state. Workers, chunk wrappers, or per-file eager projection would relocate the same materialization. Owning upstream seam is now tracked as Lync lyn-6lzi: a re-readable-source streaming union index preserving exact conflict/pending/graph/suppression semantics and lazy exact-line access. Textile's follow-on is a second-pass streaming presenter retaining compact navigation plus source locators. The isolated ordered-prefix authentication commit 0bc65e9 remains valid and clean, but this ticket stays open and is not claimed bounded.

**2026-08-01T12:44:11Z**

Implemented on isolated branch codex/textile-ordered-prefix-source-set: Textile can authenticate a Behold v2 ordered-prefix manifest, match operator-selected source basenames, stream/hash only exact bound prefixes with constant-memory SHA-256 verification, and feed ordered source bytes to the existing projector without constructing the old eager union string. Existing one-file import remains unchanged. This is a partial step only: loadOrderedLyncByteSources still materializes all bound prefix bytes and projectRawLyncSources still retains the complete parsed event/snapshot model, so habitat-scale bounded projection is not established and tex-wrif remains open.
