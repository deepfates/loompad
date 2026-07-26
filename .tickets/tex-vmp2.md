---
id: tex-vmp2
status: closed
deps: []
links: []
created: 2026-07-25T16:23:37Z
type: bug
priority: 2
assignee: deepfates
tags: [e2e, editing, ux]
---
# Repair stale Textile edit browser contracts

Five legacy browser tests still press Backspace and wait for a textarea, while the current product contract maps Backspace on a turn to the action menu. Reconcile tests with the intended ordinary editing path and verify that editing remains reachable and durable; do not change the product merely to satisfy stale keystrokes.

## Acceptance Criteria

The intended turn-edit action is named and reachable through the current UI and keyboard contract; focused edit tests exercise it through the ordinary browser surface; the five previously timing-out cases pass without weakening assertions; and the complete lync-story browser file runs without cascading timeouts.


## Notes

**2026-07-26T10:57:00Z**

Ratified the existing menu-first turn contract already documented by the action-sheet tests and README. Removed the stale edit-first switch/comment. The five legacy edit cases now open TURN, traverse keep → note → edit with the keyboard, and preserve every durability/share/generation assertion. Focused result: 5/5 pass; complete suite rerun pending final gate.

**2026-07-26T11:07:29Z**

Final gate: the complete 34-test Chromium suite passes with all five edit durability/share/generation cases using the named TURN → edit path.
