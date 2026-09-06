# Kept-context export

This contract applies to raw multi-parent Lync unions. Native conversation
archives use the smaller
[`textile/kept-conversation` contract](kept-conversation-export.md).

For a raw Lync corpus, **Export KEPT** means the ordinary positive selection.
A kept source event carries the recursive union of all causal parents. A kept
Textile-authored fork or revision carries its exact Textile loom/turn identity,
parent chain, explicit revision target, and every raw ancestor's all-parent
downset. It is not rewritten into the source event it extends. A sibling that
happened to be visible when K was pressed is comparison context in the curation
patch, not kept conversation content.

The download is one Markdown file with two layers:

1. Human-readable sections show each kept target, keep attribution, the
   first-parent reading path used by Textile, additional causal ancestors,
   source actor/kind/time/identity, and curation notes.
2. A base64-encoded JSON manifest between `textile-kept-manifest:v1` markers
   carries deterministic event order, exact source lines, ordered
   first/additional parent references, all-parent downsets, origin
   story/loom/root/source-set identity, portable Textile turns, original and
   Textile curation events, comparison-only IDs, and integrity/policy reports.

Events are ordered causally, parents before children. Source ID lexicography is
used only to stabilize ready events that are causally incomparable; it is not
treated as chronology. Actor fields are provenance and are not converted to
ChatML or user/assistant roles.

The menu action resolves by the Stories row's immutable loom ID, never its
title. The current reader is derived from that same catalog key rather than a
second independently mutable tree state. A stale mixed row/reader snapshot is
refused instead of emitting a plausible artifact for another story.

## Privacy boundary

The synced raw-source archive is limited to presented source events, their
causal ancestors, relevant annotations, and policy envelopes. Unrelated
unsupported records do not hitchhike. Unsupported causal ancestors are kept
only while their payload is export-eligible and receive an honest structural
presentation rather than recursive text guessing.

Bodies governed by Lync critical suppression or a `no-train` annotation are
removed before the source archive is synced. Critical and no-train policy
events are also envelope-only. Export re-applies this policy to legacy records
instead of trusting carried metadata. Markdown, the manifest, share links, and
second-browser state therefore contain the source envelope, policy event IDs,
and explicit reason—but not the withheld body.

An artifact with withheld causal payloads is marked `PARTIAL`. It remains a
useful reading/report artifact, but **Import Archive** refuses to recreate
source events whose bodies are absent. Export-eligible artifacts reopen as a
new raw corpus with the same source IDs, exact causal content, explicit keeps,
portable Textile forks/revisions, and visible notes; no original archive is
required.

## Current boundary

This is a portable contextual conversation artifact, not a training-row
projection. It does not choose a mind or perspective, assign model roles, or
turn comparison siblings into negative examples. Textile's reading column
remains a first-parent path, while MAP passively shows typed cross-relations and
LINKS provides explicit non-first-parent and pointer traversal.
