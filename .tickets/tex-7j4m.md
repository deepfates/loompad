---
id: tex-7j4m
status: closed
deps: []
links: [tex-3au2, Hac-i3qe]
created: 2026-07-26T08:30:00Z
type: bug
priority: 2
assignee: deepfates
tags: [corpus, export, migration, identity, browser]
---
# Textile: legacy mixed-schema corpus can visibly curate but export zero kept targets

## Observed

In the long-lived `localhost:5173` browser profile used for the corpus audit,
which contained pre-source-archive imports and repeated same-filename imports,
a newly imported `twitter-corpus.lync` was discovered through MAP, visibly
marked `✓kept`, and given a visible saved note. The current Stories row then
reported a successful kept-context download with **0 kept targets and 0 causal
source events**. After a hot reload the visible branch still carried the keep
and note but temporarily lost its source badge; after a full reload the Stories
row named the Twitter loom as current while LOOM showed the default Story 1.
This is misleading success and a visible-prose/current-loom/source-identity
divergence, not an export-semantics choice.

The same import → MAP discovery → K → note → Export KEPT flow passed on a fresh
`localhost:5174` origin: 1 kept target and 2 causal source events. Repeating the
same import on that clean origin also passed. This bounds the defect to legacy
or mixed-schema persisted state rather than ordinary repeated import.

## Root cause and resolution

The long-lived profile falsified the initial mixed-schema hypothesis. The
current Stories row and visible tree were aligned after the derived-state fix,
but the kept target was a human `revision` sibling of an imported tweet. That
turn correctly had its own Textile identity and no raw `sourceId`; the old raw
exporter silently searched only source-backed kept nodes and therefore emitted
zero. The temporary loss of the badge was accurate for that Textile turn, not
proof that the current loom had changed.

Export now treats this as a hybrid conversation: the revision remains a
Textile turn, its explicit `revises` link resolves to the original source, and
the artifact carries the raw causal downset plus local turn/keep/note identity.
The visible tree is derived from `trees[currentLoomId]`, and Stories actions
bind one exact row key/tree/root/source-set tuple. Duplicate titles are display
text only.

## Acceptance evidence

- The original persisted `localhost:5173` profile was exercised without
  deleting or rewriting its IndexedDB. Its same visible keep/note now reports
  1 kept target, 2 causal source events, and 1 Textile turn instead of 0/0.
- A Chromium regression imports two distinct corpora with the same filename,
  edits a raw turn into a Textile revision, marks and notes that visible
  revision, uses the current Stories row to share/export, inspects the exact
  manifest, and imports the Markdown into a fresh context.
- The fresh context shows the same revised prose, keep, note, source parent and
  revision target; the other same-title corpus is absent.
- A pure action-boundary regression refuses the formerly observed
  current-row/visible-tree divergence rather than selecting by title.
