# Behold resident Lync presentation

Textile presents the declared Behold resident-life profiles without changing
their source Lync. Behold owns the domain contract in
`docs/RESIDENT_LYNC_PRESENTATION.md`; Lync implements the presenter consumed
here through `@deepfates/lync/presentation`. The current package provenance and
checksum are in [`vendor/LYNC-PROVENANCE.md`](../../vendor/LYNC-PROVENANCE.md).

## Dispatch

Lync's presenter runs only for a causally inherited Loom profile of
`org.behold.inhabitant.v1` or `org.behold.inhabitant.v2`. The root must declare
`behold.entity-loom.v1`; each turn must declare both
`behold.entity-turn-link.v1` on the outer `lync/turn` payload and
`behold.entity-turn.v1` or `behold.entity-cognition-turn.v1` on its nested
private-life event. The event's body and action profiles must both be exactly
`minecraft-human-semantic-v1`.

There is no recursive text search and no generic fallback after this profile
has claimed an event. An unknown profile, protocol, observation version, or
action input remains unsupported or receives a named source-path diagnostic.

## Derived reading

Lync derives these sections from the domain allowlist; Textile groups and
renders the returned public sections:

- perceptions before and after the action: HUD condition and inventory,
  player-list/chat/event information, visible entity semantics, focus, and
  egocentric material/depth labels;
- `utterance.assistant.content` only when it is a nonempty public string;
- action name, known action-specific input, source, and kind; and
- success/failure event plus known action-specific outcome evidence.

An explicit cognition event presents its admitted perception and “chose no
bodily action.” It has no action, outcome, or terminal observation; the reader
rejects a cognition record that invents any of those fields.

Provider-private reasoning, request/response bodies, transport evidence,
controller state, absolute coordinates, stable hidden identifiers, navigation
conclusions, and arbitrary nested strings are never promoted to prose. Scripted
Oxford actions remain labelled `[script]`. A Behold source actor is retained as
the writer but does not make Textile infer that the actor is human or model;
the origin axis remains `unknown`.

## Source preservation

Each eager imported turn carries the original top-level event envelope
separately from its opaque payload. Textile reconstructs `sourceEvent` in the
story tree and JSON export while retaining source ID, every parent, author/via,
kind, profile, presentation contract, semantic sections, exact JSON source
paths, and named diagnostics. The original payload remains the imported turn's
`message`; it is not rewritten to contain display text.

An authenticated Behold ordered source set has a different, read-only ownership
model. Canonical bytes remain in the operator-selected Files. Each public turn
retains its exact source file, line and byte range, prefix SHA-256, resident
binding, and manifest digest. Private payloads and `sourceLine` strings are
reread one at a time and are not retained in Textile's snapshot or story tree.

The checked-in fixture
`tests/e2e/fixtures/oxford-aster-human-semantic-v1.lync` is the unchanged
two-event OxfordAster slice supplied by Behold. It is 6,743 bytes with SHA-256
`f254829584b7597ab1e09e88e840be4efff631ee84ee7a595c4ee44cba069305`.
The browser regression imports it, reads the resident root and first turn,
navigates both source IDs in MAP, performs the ordinary full-tree JSON export,
and proves that the exported `sourceEvent` records reproduce those fixture
bytes exactly.

The retained Behold episode 000019 ordered source set was exercised through the
ordinary front door as 68,444,160 authenticated bytes, 871 source events, 869
readable turns, two structural events, and zero unsupported diagnostics. This
is a bounded checkpoint, not evidence for multi-day browser usability.

Presentation does not change Keep/export meaning, edit behavior, MAP focus, or
Textile's first-parent reading path. Typed additional-parent and pointer
navigation and contextual export remain separate application responsibilities.
