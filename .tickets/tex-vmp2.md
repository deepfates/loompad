---
id: tex-vmp2
status: open
deps: []
links: []
created: 2026-07-25T16:23:37Z
type: bug
priority: 2
assignee: deepfates
tags: [e2e, editing, ux]
---
# Repair stale Textile edit browser contracts

Four legacy browser tests still press Backspace and wait for a textarea, while the current product contract maps Backspace on a turn to the action menu. Reconcile tests with the intended ordinary editing path and verify that editing remains reachable and durable; do not change the product merely to satisfy stale keystrokes.

## Acceptance Criteria

The intended turn-edit action is named and reachable through the current UI and keyboard contract; focused edit tests exercise it through the ordinary browser surface; the four previously timing-out cases pass without weakening assertions; and the complete lync-story browser file runs without cascading timeouts.

