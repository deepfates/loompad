---
id: Hac-ng2u
status: closed
deps: []
links: []
created: 2026-07-25T18:19:28Z
type: bug
priority: 1
assignee: deepfates
tags: [corpus, textile, import, ux, browser, accessibility]
---
# Textile: make the pointer Import Lync control open the file chooser

The visible Stories drawer Import Lync button failed to produce a file chooser in both the in-app browser and the repository Playwright Chromium project; waiting for filechooser timed out. The hidden input and direct DOM activation also failed in the in-app browser. The keyboard route through the Stories grid and Enter opens the chooser and imports successfully. The DOM currently nests the Import Lync button inside the New Story button, which is invalid interactive markup and makes the pointer success claimed by the visible control unreliable.

## Acceptance Criteria

Import Lync is a standalone valid interactive control, not nested inside another button; a pointer click opens exactly one chooser and imports a selected raw Lync file in supported browsers; the d-pad/Enter path continues to work; browser regressions cover both pointer and keyboard entry without setting the hidden input directly.


## Notes

**2026-07-25T18:26:24Z**

Falsified locator ambiguity after ticket creation: a disposable repository Playwright test resolved exactly one visible button.story-action[aria-label=Import Lync], clicked it, and still timed out for 30 seconds waiting for filechooser. The temporary test and server were removed; Textile worktree was restored clean.

**2026-07-25T23:00:00Z**

Reproduced twice in the real browser: the visible Import Lync control focused but no chooser appeared, while the d-pad/Enter path worked. The deeper cause was focus-driven React cursor state changing during the native click sequence. Commit d9fe3ce makes New Story and Import sibling controls and uses the native file input as the pointer target without pre-click state mutation. Pointer, keyboard, synthetic conversation, and raw Twitter-corpus imports pass.
