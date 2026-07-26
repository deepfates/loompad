# Behold resident Lync presentation

Textile presents one declared Behold life profile without changing the source
Lync. The domain contract is owned by Behold at commit
`a95491b55da6bb716b858ff88e8cfa7e7429b6f0` in
`docs/RESIDENT_LYNC_PRESENTATION.md`; this file records Textile's adapter and
the boundary actually exercised here.

## Dispatch

The adapter runs only for a causally inherited Loom profile of
`org.behold.inhabitant.v1`. The root must declare
`behold.entity-loom.v1`; each turn must declare both
`behold.entity-turn-link.v1` on the outer `lync/turn` payload and
`behold.entity-turn.v1` on its nested EntityTurn. The turn's body and action
profiles must both be exactly `minecraft-human-semantic-v1`.

There is no recursive text search and no generic fallback after this profile
has claimed an event. An unknown profile, protocol, observation version, or
action input remains unsupported or receives a named source-path diagnostic.

## Derived reading

Textile can derive these sections from the ratified allowlist:

- perceptions before and after the action: HUD condition and inventory,
  player-list/chat/event information, visible entity semantics, focus, and
  egocentric material/depth labels;
- `utterance.assistant.content` only when it is a nonempty public string;
- action name, known action-specific input, source, and kind; and
- success/failure event plus known action-specific outcome evidence.

Provider-private reasoning, request/response bodies, transport evidence,
controller state, absolute coordinates, stable hidden identifiers, navigation
conclusions, and arbitrary nested strings are never promoted to prose.
Scripted Oxford actions remain visibly labelled `[script]`. A Behold source
actor is retained as the writer but does not make Textile infer that the actor
is human or model; the existing origin axis remains `unknown`.

## Source preservation

Each imported turn carries the original top-level event envelope separately
from its opaque payload. Textile reconstructs `sourceEvent` in the story tree
and JSON export while retaining source id, every parent, author/via, kind,
profile, presentation contract, semantic sections, exact JSON source paths,
and named diagnostics. The original payload remains the imported turn's
`message`; it is not rewritten to contain display text.

The checked-in fixture
`tests/e2e/fixtures/oxford-aster-human-semantic-v1.lync` is the unchanged
two-event OxfordAster slice supplied by Behold. It is 6,743 bytes with SHA-256
`f254829584b7597ab1e09e88e840be4efff631ee84ee7a595c4ee44cba069305`.
The browser regression imports it, reads the resident root and first turn,
navigates both source ids in MAP, performs the ordinary full-tree JSON export,
and proves that the exported `sourceEvent` records reproduce those fixture
bytes exactly.

This adapter does not change Keep/export meaning, Backspace editing, MAP focus,
or Textile's first-parent navigation. Heterogeneous DAG navigation and the
cross-consumer Lync presentation package remain separate work.
