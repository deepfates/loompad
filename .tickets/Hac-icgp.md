---
id: Hac-icgp
status: closed
deps: []
links: []
created: 2026-07-25T18:19:28Z
type: bug
priority: 2
assignee: deepfates
tags: [corpus, textile, ux, export, sharing, nothing-silent]
---
# Textile: narrate share and download results in the interface

In the ordinary Stories drawer, clicking Story link, Thread link, and Index link changed only transient button focus; the interface gave no copied/success/failure notice. Export JSON, Export thread, and Export KEPT similarly downloaded files without naming the artifact or explaining that raw-Lync Export KEPT is a patch whose standalone graph verification reports dangling source parents. The README explains the patch contract, but a user working through the interface can reasonably read the silent download as a self-contained export.

## Acceptance Criteria

Every share action visibly confirms what link was copied or reports failure. Every export visibly confirms the filename and artifact kind. Raw-Lync Export KEPT says it is a curation patch and gives the source+patch merge/verify next step without implying standalone graph completeness. Pointer and keyboard browser tests assert the notices and failure paths.

## Notes

**2026-07-25T23:00:00Z**

Commit d9fe3ce adds success/failure notices for story, thread, and index links; names every downloaded artifact and kind; and describes raw-Lync Export KEPT as a curation patch that must be merged with its source before combined-graph verification. Pointer share/export and keyboard clipboard-failure regressions pass. The same repair preserves keyboard focus while preventing pointer focus from cancelling the click.
