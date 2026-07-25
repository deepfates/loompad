---
id: Hac-qs4o
status: open
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

