---
id: tex-wrif
status: open
deps: []
links: [tex-nak8]
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

**2026-08-01T14:20:00Z**

Acceptance is now exercised on branch `agent/tex-wrif-indexed-union`. The ordinary multi-file `importTextileFiles` path authenticates the manifest and exact prefixes, delegates all union/conflict/topology/profile semantics to Lync 0.4.3's indexed union, presents one event per lazy reread, and opens an always-read-only session Loom containing only public presentation state plus compact authenticated locators. Single-file eager import is unchanged. Changed, truncated, conflicting, dangling, cyclic, unsafe, or resident-binding-mismatched input fails closed.

The opt-in scale gate (`TEXTILE_SCALE_TEST=1 bun test client/interface/lync/__tests__/indexedRawLync.scale.test.ts`) passed a synthetic representative two-resident source set of 490,734,206 bytes: 2 sources, 7,490 source events, 7,488 readable events, 2 structural events, and 67,392 named presentation diagnostics in 33.5 seconds. Lync ownership instrumentation measured 0 retained raw bytes and 0 retained payload objects; Textile's retained-view inspection measured 0 source-line characters, 0 private payload objects, and 0 raw bytes, with 8,279,772 public presentation characters. The compact index retained 7,490 locators/envelopes and 3,378,124 string characters. This proves the bounded ownership contract, not a browser-vendor heap profile or multi-day usability; those remain broader operational/product questions rather than this ticket's six-hour materialization milestone.

**2026-08-01T13:58:50Z**

Principal independent review on 2026-08-01: code and ownership design are accepted for integration; 208 ordinary tests, lint, production build, and the 490.7 MB opt-in scale projector gate pass. Ticket reopened because its exact acceptance says representative scale through the ordinary local review path, while the scale test calls projectIndexedOrderedLyncSources with synthetic re-readable sources rather than importTextileFiles with browser File objects. Close only after a retained six-hour v2 manifest and canonical files open through the ordinary front door with usable navigation and measured behavior.
