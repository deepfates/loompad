---
id: Hac-1i65
status: open
deps: []
links: [tex-qit3, tex-3au2]
created: 2026-07-25T18:35:56Z
type: feature
priority: 2
assignee: deepfates
tags: [corpus, textile, lync, dag, navigation, pointers]
---
# Textile: navigate non-first-parent Lync causal links

A separate corpus-navigation gap from Hac-i3qe. Lync preserves every ordered parent and its branch-tree/context views retain the DAG, but Textile raw import projects each readable source event into a Loom turn with navigationParent resolved only from event.parents[0]. Later source parents survive only as meta.sourceParents and meta.extraParentIds, so they remain auditable/exportable but are not reachable as causal edges through the reading interface. The real browser audit therefore exercised a first-parent tree projection, not arbitrary Lync-pointer or DAG navigation. This does not invalidate the working two-client synchronization and curation loop, and that narrow shared-curation ticket does not complete the broader corpus endpoint. The workshop direction explicitly names arbitrary Lync pointers and DAG views beyond first-parent trees; the exact focus and navigation idiom remains an owner-held UX decision.

## Design

Candidate boundary: keep the existing Loom tree as one useful projection while adding a source-DAG/pointer read model derived from immutable Lync ids and all ordered parents. Do not remint events or encode extra parents as prose. The presentation/readable projection ticket Hac-i4by determines what a node says; this ticket determines which causal edges a person can inspect and follow. MAP prose/source/curation alignment remains Hac-i3qe and must not be implemented implicitly here.

## Acceptance Criteria

A verifier-clean checked-in fixture contains a readable event with at least two meaningful parents plus a pointer/annotation edge. Through ordinary Textile import and discovery, a person can see that the focused source event has multiple causal inputs, traverse directly to every preserved parent and back to the child, and distinguish causal parents from annotations or other typed pointers. Navigation preserves exact source ids, ordered parent roles where the kind pact defines them, authorship, warnings, selection/tag/note targets, and export round trips. The UI names any unsupported edge semantics instead of silently displaying only parents[0]. Browser coverage discovers the graph through visible content rather than known ids. Owner ratifies the MAP/focus interaction before implementation; Hac-i3qe and Hac-i4by remain separate.

## Implemented ratchet (2026-07-26)

The focused source control and `L` now open a typed LINKS action sheet without
changing MAP focus. Ordered envelope parents appear as parent 1 / parent N
additional; every readable parent is directly reachable, and its causal-child
list provides an explicit return path with the input position named. Original
annotations remain non-navigating target relations, not fake causal nodes.

Textile now presents the exact standard `lync/pointer` `{name,target}` pact as
an honest structural event. Incoming named pointers and their outgoing targets
are traversable and labeled non-causal. No recursive payload guess or generic
relation ontology was added.

The checked-in `tests/e2e/fixtures/dag-links.lync` is accepted 7/7 by `lync
verify`. Chromium imported it through the pointer file chooser, discovered the
two-parent synthesis through prose, followed parent 2, kept/noted that exact
source, returned through the child edge, traversed the pointer out and back,
inspected the Curare annotation distinction, and verified the kept-context
manifest still targets the reached source.

This ticket remains open only at its broader owner-held visual boundary: MAP
still draws the first-parent tree and does not yet render or focus cross-tree
causal strings. The direct typed navigation above is intentionally not a
surrogate MAP focus decision.
