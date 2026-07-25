---
id: Hac-n5jl
status: open
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

