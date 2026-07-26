---
id: Hac-1i65
status: closed
deps: []
links: [tex-qit3, tex-3au2]
created: 2026-07-25T18:35:56Z
type: feature
priority: 2
assignee: deepfates
tags: [corpus, textile, lync, dag, navigation, pointers]
---
# Textile: navigate non-first-parent Lync causal links

This was a separate corpus-navigation gap from Hac-i3qe. Lync preserves every ordered parent and its branch-tree/context views retain the DAG, but Textile raw import projected each readable source event into a Loom turn with navigationParent resolved only from event.parents[0]. Later source parents survived only as meta.sourceParents and meta.extraParentIds, so they were auditable/exportable but not reachable as causal edges through the reading interface. The original real browser audit therefore exercised a first-parent tree projection, not arbitrary Lync-pointer or DAG navigation. This did not invalidate the working two-client synchronization and curation loop, and that narrow shared-curation ticket did not complete the broader corpus endpoint.

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

## Closure evidence

MAP now preserves the deliberate first-parent node geometry while drawing a
passive typed relation layer. A solid sagging string connects every readable
non-first causal parent to its child; a dashed string and target ring connect
the exact `lync/pointer` event to `payload.target`; annotation targets receive
a dotted halo instead of an invented annotation node. A same-size legend names
all three treatments. Incident relations strengthen when their node is focused,
but paths have `pointer-events: none` and acquire no keyboard or pointer focus.
LINKS remains the explicit navigation door.

The real in-app browser established the before/after product result on
`dag-links.lync`: the baseline tree hid the synthesis fan-in; the new view made
the additional parent and pointer visibly converge on the focused synthesis,
with its annotation halo distinguishable at the map's actual scale. The exact
source focus remained unchanged until LINKS followed parent 2, then returned
through the causal child. DOM inspection found one additional-parent string,
one pointer string, three annotation targets, and no interactive relation
element. The Chromium regression repeats MAP inspection plus the full
navigation/curation/export path. Unit tests reject first-parent duplication and
derive relations only from envelope parents and exact `lync/annotation` and
`lync/pointer` pacts—never recursive payload shape.

Focusable edges remain a possible evidence-driven interaction improvement, not
part of this ticket. The reading column and ordinary arrow navigation continue
to use the first-parent projection; this closure does not claim one universal
graph projection for every future domain pact.
