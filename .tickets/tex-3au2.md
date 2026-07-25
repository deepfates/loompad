---
id: tex-3au2
status: open
deps: []
links: [Hac-1i65, tex-qit3]
created: 2026-07-25T23:19:40Z
type: feature
priority: 2
assignee: deepfates
tags: [corpus, textile, export, lync, context, provenance, candidate]
---
# Textile: export kept material with self-contained causal context

Export KEPT for a raw Lync import is intentionally only a portable annotation patch whose parents live in the original archive. The full-tree JSON is a lossy Textile StoryNode projection, and Splice Markdown renders a whole held event set rather than a selected contextual subset. A person or model therefore cannot currently take selected material away with the context and provenance needed to understand it without retaining the original .lync file.

Grounded import limitation: projectRawLyncFile parses the canonical source only in memory, builds a reminted conversation Loom, and looms.import remints its root and turns. The synced projection retains presented text, source id/kind/parents, raw payload under the turn message, actor/via, and some folded tags/selections. It does not retain canonical carried bytes, unsupported source events, most source annotations, full author axes, critical state, or the original at spelling. StoryNode drops still more of the turn payload. A self-contained provenance artifact must be built from a lossless persisted source-event representation, not reverse-engineered from StoryNode.

## Design

Candidate artifact boundary, pending owner ratification of Keep versus Prefer meaning: preserve the current positive kept set without treating visible siblings as rejected examples. Emit one portable bundle with a machine-readable event/curation manifest plus Markdown. For each kept target, the Markdown presents the explicit first-parent reading path that matches Textile navigation and separately names every additional causal parent. The manifest carries the deduplicated all-parent downset, exact source ids, ordered parents, kind, source time, full author axes, raw payload or canonical carried line, keep/note provenance, presentation contract, suppression/drop report, and partial obstacles. Order by causal topology; use stable id only to order concurrent incomparable events, never as chronology. Preserve attributed actors and do not infer ChatML roles or a training perspective.

The generic bundle builder should consume original view-eligible Lync events and a domain-owned presenter registry. Lync owns downset/obstacle semantics, concrete source packages own readable payload projections, and Textile owns which durable keeps/notes the user selected and the download interaction. Behold EntityTurn readability remains a Behold-owned presenter decision, not a special importer or recursive payload guess.

## Acceptance Criteria

A real raw import is curated in one browser, observed in a second synced browser, and exported from either without access to the original input file. The artifact opens as useful Markdown and machine-readable data; each kept target has an explicit first-parent conversation path and a complete all-parent causal downset, with every source id resolvable inside the bundle or a loud partial/refusal report. Full provenance axes, ordered parent roles when known, source payload, timestamps, notes, and keep authorship survive. Critical suppression and no-train obligations are honored with a complete drop report. Unknown kinds remain present as honest structural records and use no recursive text guessing. No user/assistant role or model perspective is inferred for generic events. Tests cover multiple kept targets with shared context, a multi-parent target, a missing parent, a suppressed event, an unsupported kind, and deterministic output under shuffled input. Before implementation, the owner decides whether siblings shown when K was pressed belong in the default artifact; that decision must not be smuggled in through the existing selection patch.

