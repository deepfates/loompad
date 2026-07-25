---
id: Hac-n5jl
status: closed
deps: []
links: []
created: 2026-07-25T17:55:32Z
type: bug
priority: 1
assignee: deepfates
tags: [corpus, textile, performance, import, ux, ocr]
---
# Textile: keep controls responsive when raw Lync contains a very large readable event

A real ordinary browser import of a verifier-clean 147-event heterogeneous union (Twitter, Glowfic, 100 OCR pages plus combined OCR document, tweet embeds, 8 Curare annotations) completed and displayed success. Raw projection then chose the combined 100-page ocr/document as the first readable child and rendered the entire document in LOOM. SELECT became focused but Settings/Stories never rendered within a 120s Playwright budget, blocking navigation, share, curation, and escape. The existing 3-turn corpus fixture does not exercise this scale or large-event shape.

## Acceptance Criteria

Importing a realistic verifier-clean corpus containing one very large readable event remains bounded and visibly responsive; the user can open MAP and Stories, navigate to other roots/turns, share, curate, and export without a multi-minute main-thread stall; a focused browser regression covers the large-event case and reports timing/size boundaries honestly.


## Notes

**2026-07-25T22:31:12Z**

2026-07-25 browser repair checkpoint.

The historical 120-second stall was not reproduced at the original local OCR document size (271,267 characters) or at the first synthetic high-end probe. Before the fix, a verifier-clean 10.16 MB Splice OCR file with one 9,195,435-character ocr/document opened LOOM in 2.28s and SELECT responded in 274ms, while the browser bridge failed separately when asked to serialize the full giant DOM (native pipe frame limit). A controlled clean-context 8 MiB regression isolated the meaningful interaction cliff: import notice 909ms, next-mode controls 1,445ms, React/DOM commit 1,334ms, forced large-node getBoundingClientRect 1,313ms, and one 1,333ms long task.

Responsiveness budget chosen before the implementation: a valid clean local import at this 8–10 MiB boundary reports within 2s, and navigation/mode controls respond within 500ms. Complete source text must remain exact in the data model and exports; presentation may be bounded only when it says so and every window is reversibly reachable.

The repair uses an explicit 1 MiB presentation boundary and a 65,536-character FIRST/PREV/NEXT/LAST reader window. It never inserts the whole large event into wrapped DOM or a giant form value, and the scroll synchronizer top-aligns the known bounded reader without full-height measurement. The exact multi-megabyte string remains in the imported StoryNode and full-tree JSON. Clean browser measurements after the repair: import 882–1,005ms, controls 30–39ms, commit 10–13ms, zero measured large-node rectangle cost, and no long task. The in-app browser opened the 10.16 MB Splice fixture in 370ms and Settings in 260ms; DOM inspection is bounded to the current window.

The focused browser flow also paged first-to-last, kept and noted the exact ocr/document, opened MAP, discovered and navigated to the sibling ocr/page, copied a story link, exported full-tree JSON containing both source sentinels, and exported a two-event Lync curation patch whose selection chose the document while preserving both shown siblings and whose note parent was the document id. 161 unit tests, lint, build, and 23 e2e tests outside the separately tracked Backspace/direct-edit semantic conflict pass.

Remaining uncertainty: after deliberately accumulating several repeated 10 MB imports in one persistent audit browser, later import notices sometimes appeared after the clean 2s budget. That cumulative-storage/relay behavior was not isolated well enough to claim as this clean-corpus defect or to mint another ticket yet.
