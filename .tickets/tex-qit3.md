---
id: tex-qit3
status: closed
deps: []
links: [Hac-1i65, tex-3au2]
created: 2026-07-25T22:58:52Z
type: bug
priority: 2
assignee: deepfates
tags: [corpus, textile, lync, presentation, behold]
---
# Textile: support domain-owned presentations for nested Lync turns

A structurally valid Behold resident-life Lync was rejected because its readable EntityTurn is nested under `payload.payload`. Behold now owns an exact non-mutating presentation pact and privacy-safe Oxford fixture at commit `a95491b55da6bb716b858ff88e8cfa7e7429b6f0`; Textile dispatches that pact by declared Loom profile rather than recursively guessing at nested strings.

## Design

A domain-owned presenter maps exact kind/profile payloads to content and structural sections while Textile preserves every original event. Behold's v1 allowlist exposes public perception, utterance, action, and outcome evidence with exact source paths. Unknown contracts remain unsupported, scripted actions retain their provenance, private reasoning stays source-only, and the actor remains a writer identity rather than a guessed human/model perspective.

## Acceptance Criteria

A checked-in Behold life fixture imports through a declared domain presentation contract; its observations, public utterance, actions, and outcomes are legible beat by beat without recursive string guessing; source ids, all parents, actor axes, raw payload, warnings, and export provenance survive; an unknown nested payload remains loudly unsupported; private reasoning is not promoted to prose.

## Completion evidence

- The unchanged 6,743-byte OxfordAster fixture verifies as two conforming Lync events and is pinned by SHA-256 in unit tests and adapter documentation.
- Unit regressions prove exact profile dispatch, safe section/source-path projection, unknown-profile and malformed-pact fail-closed behavior, and source-event reconstruction after Lync snapshot import.
- A real-browser regression imports the fixture, reads the root and resident beat, navigates both source ids in MAP, exports the full tree, and reconstructs byte-identical `.lync` source records from exported `sourceEvent` values.
- Keep/export meaning, direct editing, MAP focus design, first-parent navigation, and a reusable cross-consumer presentation package remain unchanged and separately owned.
