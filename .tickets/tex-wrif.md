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
