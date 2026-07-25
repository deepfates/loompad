---
id: tex-qit3
status: open
deps: []
links: []
created: 2026-07-25T22:58:52Z
type: bug
priority: 2
assignee: deepfates
tags: [corpus, textile, lync, presentation, behold, candidate]
---
# Textile: support domain-owned presentations for nested Lync turns

A structurally valid Behold life Lync is rejected by Textile because the readable EntityTurn is under payload.payload and the event has no top-level text/message projection. Hac-qs4o fixes the explicit Splice raw-converter kinds and names unsupported kinds, but intentionally does not recurse through arbitrary payloads or invent a Behold view. Lync makes payload meaning kind-defined and expects pact manifests above the base envelope; the likely seam is a general Textile presentation contract/registry supplied by the owning domain, not a Behold-only importer. Whether those contracts ship as packs is still an owner design question.

## Design

Candidate: let a domain-owned presenter map exact kind/profile payloads to content and structural views while Textile continues to preserve the complete source event. Unknown kinds remain named and unguessed. Keep actor/perspective identity and the desired observation/reasoning/action layout open until owner and Behold meaning are explicit.

## Acceptance Criteria

A checked-in Behold life fixture imports through a declared domain presentation contract; its observations/reasoning/actions are legible beat by beat without recursive string guessing; source ids, all parents, actor axes, raw payload, warnings, curation, sharing, and export provenance survive; an unknown nested payload remains loudly unsupported; the owner has ratified the perspective/display meaning rather than an agent inferring it.
