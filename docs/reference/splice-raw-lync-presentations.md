# Splice raw-Lync presentation matrix

This matrix describes Splice's raw `.lync` converter commands as consumed by
Textile's current checksum-pinned Lync presentation package. Splice owns the
writer and source-adapter semantics; Lync owns the presentation contracts;
Textile renders the resulting public view without rewriting the event.

The checked-in `tests/e2e/fixtures/splice-source-kinds.lync` was generated
through Splice's writer functions and verifies as 12 accepted Lync events: 11
source events plus one synthetic cluster annotation.

Splice's `session-loom`, `claudeai-export`, `chatgpt-export`, and
`twitter-threads` commands produce typed conversation Loom snapshots, so they
enter Textile through the snapshot contract. Separate private session-import
trees can contain open-ended `codex/*`, `claude/*`, and `lore/*` kinds; this
matrix does not imply presentation support for them. Textile names any
unpresented kind.

| Splice command | Lync kind | Preserved source payload | Textile primary presentation | Source parent meaning |
| --- | --- | --- | --- | --- |
| `lync archive` (Twitter) | `twitter/tweet` | original tweet object | first exact string at `full_text`, `fullText`, or `text` | deterministic imported reply ID, when present |
| `lync archive` (Twitter) | `twitter/like` | original like object | first exact string at `full_text`, `fullText`, or `text` | imported source parent, when present |
| `lync archive` (Bluesky) | `bluesky/post` | `{uri,cid,collection,rkey,record}` | exact `record.text` (top-level `text` only for normalized fallback payloads) | deterministic imported AT reply URI, when present |
| `lync glowfic` | `glowfic/thread` | thread metadata excluding posts | structure: title, thread ID, authors, and source URL | root container |
| `lync glowfic` | `glowfic/post` | complete original post, including HTML `content` | inert plain text derived from that exact HTML | first post → thread; later post → previous post |
| `lync ocr` | `ocr/set` | portable-v2 identity scheme, set locator, source accounting, page range, gaps, document names | structure: locator, page/document counts, page range | root container |
| `lync ocr` | `ocr/page` | page text, description, file names, byte counts | exact `text` | first page → set; later page → previous page |
| `lync ocr` | `ocr/document` | combined document text, file name, byte count | exact `text` | set container |
| `lync tweet-embed` | `twitter/tweet-embed` | `{file,tweet_id,embed}` with the original oEmbed object | inert plain text derived from exact `embed.html` | matched canonical archive tweet when importer receives archive IDs; otherwise root |

Presentation is a view, never an import rewrite. Event IDs, every parent, actor
axes, complete payload, cluster tags, and conformance warnings remain on the
projected turn and full-tree export. Textile's reading path follows the nearest
presented `parents[0]`; additional parents appear on the source control and MAP
and are directly traversable through LINKS. That projection is not a claim that
the Lync graph is a tree.

Exact kind/profile claims run before Lync's small generic `text`/`message`
contract. The presenter does not recursively hunt for strings, and a malformed
claimed kind cannot fall through to generic prose. Unknown kinds are counted
and named as unsupported in the import receipt. Domain meaning still requires
an owned pact; the shared resolver does not invent one from nested fields.
