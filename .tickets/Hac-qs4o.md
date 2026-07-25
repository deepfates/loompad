---
id: Hac-qs4o
status: closed
deps: []
links: []
created: 2026-07-25T17:56:47Z
type: bug
priority: 1
assignee: deepfates
tags: [corpus, textile, splice, importer, glowfic, twitter]
---
# Textile: render every readable Splice raw-Lync source kind

Textile rawLync.readableText recognizes payload.text/full_text/fullText/message but not Splice Glowfic payload.content or tweet-embed payload.embed.html. In the same verifier-clean 37-event heterogeneous union, 30 Glowfic posts and 3 tweet embeds were retained by Lync but absent from Textile's navigable content projection. This makes Import Lync report a plausible partial corpus without naming per-kind omissions.

## Acceptance Criteria

Textile projects useful normalized text for every readable raw-Lync kind currently emitted by Splice, including Glowfic posts and tweet embeds; container/non-readable events are accounted for visibly rather than silently absent; source ids, parents, actors, tags, and warnings survive; a checked-in heterogeneous browser fixture proves navigation and curation across kinds.


## Notes

**2026-07-25T22:59:13Z**

2026-07-25 clean source-kind checkpoint. Splice 7335267 ground truth covers raw converter commands archive/glowfic/ocr/tweet-embed: 11 source events across 9 exact kinds (Twitter tweet/like, Bluesky post, Glowfic thread/post, OCR set/page/document, tweet embed). Textile now uses explicit kind presenters, inert HTML-to-text for Glowfic/embed, structural cards for Glowfic/OCR containers, and a small generic text/message fallback; it never recursively hunts unknown payloads. Import receipts report 9 readable + 2 structural + every unsupported kind. Real in-app browser: imported the verifier-clean fixture, discovered OCR→Glowfic/tagged post→Twitter/embed via MAP, kept/noted the structural set, copied share link, exported an 11-source-node tree, and exported a two-event source-targeted patch; merging patch+source verified 14 accepted / 0 defects. Regression curates one representative of all 9 kinds, opens shared state in a second context, and checks identity/parents/actors/tags/text in tree export and exact targets in 18-event patch. Gates: 164 unit, lint, build, 24 e2e outside the five owner-blocked Backspace/direct-edit semantics. Scope boundary and matrix are in docs/splice-raw-lync-presentations.md. Behold nested EntityTurn remains unsupported by design and is recorded separately as candidate tex-qit3, not claimed complete here.
