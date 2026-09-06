# Raw Lync reference

This document defines Textile's current application boundary for raw Lync
corpora. Lync owns append-only interchange, union verification, conflict and
topology decisions, suppression, indexed source locators, and domain
presentation. Textile owns the tactile reading projection, navigation,
curation, synchronization policy, and portable contextual export.

The exact installed dependency is recorded in
[`vendor/LYNC-PROVENANCE.md`](../../vendor/LYNC-PROVENANCE.md). It is a
checksum-pinned unpublished Lync 0.4.3 build; this repository does not fork
Lync's contracts.

## Eager raw union import

A single `.lync` or `.jsonl` file enters the eager, mutable path. Textile:

- rejects damaged or garbage physical lines, ID conflicts, missing parents,
  graph cycles, and unions with no readable supported event;
- retains accepted nonconformance warnings on the focused source;
- preserves event IDs, every ordered parent, actor axes, source payload,
  presentation paths, annotations, and named pointers;
- follows the nearest readable first parent for the reading tree while keeping
  additional graph relations available in MAP and LINKS; and
- synchronizes an export-eligible minimized source archive, not every unrelated
  or policy-withheld record.

The focused source control or `L` opens LINKS. It distinguishes primary and
additional causal parents, causal children, named `lync/pointer` targets, and
annotation targets. MAP shows additional parents as solid cross-strings,
pointers as dashed strings, and annotation targets as dotted halos. Those
relations are passive in MAP; LINKS is the direct traversal surface.

Textile-authored forks and revisions remain named Textile turns with their
origin Loom/turn identity, source-parent chain, and revision link. They are not
mislabelled as the raw source events they extend.

## Indexed ordered source sets

A multi-file import must contain exactly one Behold
`behold.live-textile-source-set.v2` manifest and the source files it binds. The
path is always read-only.

Textile authenticates the exact ordered prefixes, delegates indexing and graph
admission to Lync, and rereads one event at a time for presentation. Retained
session state contains compact graph/envelope indexes, authenticated byte
locators, and public presentation text. It does not retain selected source
lines, source byte arrays, or private resident payloads.

The declared source working set is bounded by Lync's 1 MiB chunk and 16 MiB
line limits plus one reread event. Retained state is O(events + edges + public
presentation text), not O(source bytes). The picker reports
resident/source/readable/structural/diagnostic counts and rejects changed,
truncated, conflicting, dangling, cyclic, or resident-binding-mismatched input.

This ownership model has passed a synthetic 490,734,206-byte projector gate
with 7,490 source events and no retained raw bytes or private payload objects.
The ordinary browser has opened a retained 68,444,160-byte Behold checkpoint
with 871 source events. Neither result closes the open `tex-wrif` acceptance
criterion for a retained six-hour source set through the ordinary browser.

## Presentation behavior

Textile consumes Lync's non-mutating, kind/profile-aware presentation API. An
exact claimed kind or profile is evaluated before the small generic
`text`/`message` contract. A malformed claimed event fails closed rather than
falling through to recursively discovered prose. Unknown kinds remain named as
unsupported.

The current source-kind matrix is in
[Splice raw-Lync presentations](splice-raw-lync-presentations.md). The admitted
Behold resident view and its privacy boundary are in
[Behold resident presentation](behold-resident-lync-presentation.md).

Readable events above one MiB of text use FIRST/PREV/NEXT/LAST windows of
65,536 characters. This is presentation virtualization, not truncation: the
eager source string remains exact in the story model, full-tree JSON, and
kept-context export.

Source event times remain attached to readable turns. Adjacent turns at least
five minutes apart receive an elapsed-time marker; the marker reports time and
does not invent an episode boundary.

## Keep and export

Keeps and notes on raw events are standard source-targeting `lync/annotation`
records. **Export KEPT** produces one Markdown artifact containing every
explicitly kept target and its complete all-parent causal ancestry, plus the
Textile curation events required to reopen it. Merely visible siblings remain
comparison references and do not become kept content.

Critical, `no-train`, and suppressed bodies are never carried; the artifact
contains their envelopes and reasons and is marked `PARTIAL`. A partial
artifact remains readable but refuses source reconstruction. Actor names stay
provenance; Textile does not infer user/assistant roles or a training
perspective. The complete contract is in
[Kept-context export](kept-context-export.md).

## Cross-repository rehearsal

With sibling Lync, Splice, and Curare checkouts available, run:

```sh
bun run verify:corpus-loop
```

`LYNC_ROOT`, `SPLICE_ROOT`, and `CURARE_ROOT` override sibling discovery. Set
`KEEP_CORPUS_LOOP_OUTPUT=1` to retain and print the temporary source, clusters,
annotations, selections, union, and training exports.

The command executes Splice's Twitter importer twice, verifies and merges with
the Lync CLI, runs Curare's seeded local clustering twice, projects the union
through Textile's app layer, appends a keep, exports the standard selection,
and runs Splice's training exporter. It rejects identity loss, nondeterministic
replay, absent annotations, bypassed Textile curation, or unreconciled final
rows.

This proves a provider-free integration path through Textile's real projection,
Loom, keep, and export code. It does not click the browser controls and does not
prove the human archive experience. The native archive browser journey is the
ordinary product check described in the repository README.

For a small typed-DAG browser fixture, import
`tests/e2e/fixtures/dag-links.lync`, press START for MAP, and use the relation
legend and LINKS sheet. For a retained output from the corpus rehearsal, import
`annotated.lync`, press START, descend to the branch, compare siblings with
Left/Right, and press `K` on the exact source you intend to keep.
