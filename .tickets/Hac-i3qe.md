---
id: Hac-i3qe
status: closed
deps: []
links: []
created: 2026-07-25T18:19:28Z
type: bug
priority: 0
assignee: deepfates
tags: [corpus, textile, ux, curation, identity, lync]
---
# Textile: align MAP text, source badge, and K/N target

An ordinary two-client audit of an 18-source-event Splice Twitter corpus found that MAP renders one source event while its curation/source focus is still on another. At depth 1 the screen showed source 42a289ef text (Preserve the source event ids) while K/N exported selection and note parents for root 3f91fb15. At depth 2 the screen showed source 04f6bbd0 text (Keep provenance beside the content) while K/N exported against 42a289ef. A second actor saw the durable note on 42a289ef after reconnect, proving that the mismatch is persisted, not only visual. The existing focused e2e navigates with known source ids and an extra Down, so it does not assert that the visible prose, source badge, and actual annotation parent are the same turn.

## Acceptance Criteria

For raw-Lync stories, every MAP state has one unambiguous focused turn: rendered prose, source badge/tags, kept/note indicator, edit target, and K/N export parent all resolve to that exact source id. Left/Right and Up/Down preserve this invariant at roots, branch points, and leaves; two-client reconnect proves the same target receives the durable annotation; a browser regression discovers targets by visible prose and fails if exported source ids differ.


## Notes

**2026-07-25T18:26:24Z**

The exported 6-event curation patch made the mismatch auditable: actor anon-ce3c6bb6 selected/noted 3f91fb15 after reading the 42a289ef prose preview, then selected/noted 42a289ef after reading the 04f6bbd0 preview. The 18-source-node full-tree JSON confirms those notes are durably attached to the earlier nodes. Two-origin reconnect and live convergence otherwise succeeded.

**2026-07-25T23:00:00Z**

Reproduced again in the real browser on the synthetic Twitter corpus. Commit d9fe3ce makes MAP prose describe the highlighted event and adds unit plus browser regressions. The real browser then showed root prose, source id 3f91fb15-efa8-883a-bc73-7288e4712854, keep state, and note on the same event. The two-context corpus test covers synchronization, reconnect, exact-source curation, and export.
