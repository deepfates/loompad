---
id: tex-nj3a
status: closed
deps: []
links: []
created: 2026-08-01T06:09:19Z
type: task
priority: 1
assignee: deepfates
tags: [textile, lync, behold, presentation, compatibility]
---
# Textile: consume Behold resident-v2 presentation pact

Update Textile's vendored browser-safe Lync presentation boundary from the corrected immutable Lync 0.4.1 artifact so raw Lync review presents additive Behold resident-v2 turns without changing retained v1 rendering. The artifact path, package version, source commit, and hashes must be recorded exactly; do not reproduce the pact as Textile-local heuristics.

## Design

Wait for the Lync coordinator's corrected 0.4.1 tarball/path/hash. Copy only the compiled presentation files used by Textile, update provenance, and exercise the ordinary raw-Lync projection boundary with one focused v2 fixture. Behold and Lync remain owners of turn semantics and the presentation pact respectively.

## Acceptance Criteria

Given verifier-clean Lync fixtures for one retained Behold v1 loom and one Behold resident-v2 loom, Textile's ordinary raw-Lync projector presents both through the vendored Lync contract, identifies their correct versioned presentation contracts/sections, emits no unsupported-profile diagnostic, and reconstructs every source line byte-for-byte. Provenance pins the immutable Lync 0.4.1 artifact path/source/hash and every vendored file digest. Focused and full Textile test/lint/build checks pass; repository is committed cleanly; nothing is pushed or published.

## Notes

**2026-08-01T06:14:39Z**

Verified immutable artifact /Users/deepfates/Hacking/data/artifacts/lync/deepfates-lync-0.4.1.tgz at SHA-256 0230b18b564f88af0dbefc5d21e7b75757ab33d461e155079ab0b36e93fae655 and package version 0.4.1 (source 38017609699d9d0a1c0d1b356a0715eb88f8dc9f; v2 presenter ed057468e8d6b81dcdf9ebbac590e5bf6e809b84). Vendored only presentation runtime files, omitting source-map trailers, plus the existing published-0.3-compatible declaration adapter. Added exact 2,687-byte v2 fixture SHA-256 8a1e660c692827d1c66a098120be0ae05509d08978d17a10231b6705bd4cddef. Focused raw projection: 21 pass, 0 fail. Full checks: lint pass; 199 tests pass, 0 fail; production build pass. Existing v1 exact-fixture test remains green. No push/publication.
