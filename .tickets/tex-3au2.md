---
id: tex-3au2
status: closed
deps: []
links: [Hac-1i65, tex-qit3]
created: 2026-07-25T23:19:40Z
type: feature
priority: 2
assignee: deepfates
tags: [corpus, textile, export, lync, context, provenance]
---
# Textile: export kept material with self-contained causal context

Export KEPT for a raw Lync import previously emitted only a portable annotation patch whose parents lived in the original archive. The full-tree JSON was a lossy Textile StoryNode projection, and Splice Markdown rendered a whole held event set rather than a selected contextual subset. A person or model therefore could not take selected material away with the context and provenance needed to understand it without retaining the original `.lync` file.

The implementation now carries a content-bound source archive as hidden Loom turns, separate from the visible presentation. Export is built from those exact records rather than reverse-engineering source bodies from StoryNode. Policy-withheld records carry only envelopes and reasons before sync.

## Design

The ratified boundary preserves the positive kept set without treating visible siblings as rejected examples. One Markdown download contains readable paths and an embedded machine manifest. For each kept target, the Markdown presents the explicit first-parent reading path that matches Textile navigation and separately names every additional causal parent. The manifest carries the deduplicated all-parent downset, exact source ids and lines, ordered parents, kind, source time, full author axes, keep/note provenance, presentation contract, suppression/drop report, and partial obstacles. Causal topology orders the events; stable id orders only ready incomparable events, never chronology. Attributed actors remain provenance and no ChatML role or training perspective is inferred.

A kept Textile-authored fork/revision inside a raw corpus remains a Textile
turn with immutable origin loom/turn identity and an explicit source/local
parent and revision link. Its source ancestors still use the same all-parent
downset. The menu binds the visible reader, current Stories row, download, and
manifest through one loom-id/root/source-set action target; titles are never
identity.

The bundle consumes each event's original, export-eligible source record and the domain-owned presentation already selected at import. Textile owns the durable keeps/notes and download/reopen interaction. No generic presentation package was introduced without a second concrete consumer. Behold EntityTurn readability remains governed by its ratified profile-aware presentation pact, not recursive payload guessing.

## Acceptance Criteria

A real raw import is curated in one browser, observed in a second synced browser, and exported from either without access to the original input file. The artifact opens as useful Markdown and machine-readable data; each kept target has an explicit first-parent conversation path and a complete all-parent causal downset, with every source id resolvable inside the bundle or a loud partial/refusal report. Full provenance axes, ordered parent roles, exact source lines, timestamps, notes, and keep authorship survive. Critical suppression and no-train obligations are honored with a complete drop report and no body leakage. Unknown kinds remain present as honest structural records and use no recursive text guessing. No user/assistant role or model perspective is inferred for generic events. Tests cover multiple kept targets with shared context, a multi-parent target, a missing parent, a suppressed event, an unsupported kind, deterministic output under shuffled input, two synced curators, a clean browser reopen/re-export, an 8 MiB OCR event, every Splice source kind, and adversarial policy sharing/refusal. Siblings shown during K remain in the curation patch only and are not promoted into kept content.

## Closure evidence

- Chromium: two authors disconnected/reconnected around shared curation; a third clean context imported the downloaded Markdown without the original archive, saw both keeps and notes, and re-exported the same three-event causal set.
- Chromium: one kept 8 MiB OCR document exported exact full text with its `ocr/set` ancestor while the readable page sibling remained comparison-only and its body was absent.
- Chromium: all 11 events across every actual Splice source kind imported/rendered/focused/curated/shared/exported; 9 explicit kind representatives were kept.
- Adversarial Chromium: critical, no-train, and suppressed bodies were absent from owner UI, shared second-browser state, Markdown, and manifest; fresh source reconstruction refused loudly.
- Persisted-profile Chromium: the exact previously failing kept human revision now exports 1 target with 2 raw ancestors and 1 Textile turn; a duplicate-title regression reopens that prose, keep, note, parent, and revision target in a clean context.
- Unit regressions cover all-parent downsets, multi-parent roles, missing ancestors, unsupported structures, deterministic permutation behavior, carried curation, fresh reopen, and policy reapplication to legacy records.

The persisted-browser defect found during the in-app audit is resolved in
`tex-7j4m`; it established that portable local turns are part of this artifact
contract, not a migration-only exception.
