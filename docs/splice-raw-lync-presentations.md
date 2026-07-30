# Splice raw-Lync presentation matrix

Ground truth: Lync `fee7adc14f0038d9d0be51bd16b930659ffae1f8`,
Splice `2f6cc3c`, their presentation/import tests, and Splice's
`splice lync archive|glowfic|ocr|tweet-embed` writers, source adapters, and
checked-in fixtures. The browser fixture
`tests/e2e/fixtures/splice-source-kinds.lync` was generated through those
writer functions and verifies as 12 accepted Lync events: 11 source events
plus one synthetic cluster annotation.

This matrix is deliberately about Splice's raw `.lync` converter commands.
Splice's `session-loom`, `claudeai-export`, `chatgpt-export`, and
`twitter-threads` commands produce typed conversation Loom snapshots, so they
enter Textile through the snapshot contract instead. The separate private
`session-import` tree commands produce open-ended `codex/*`, `claude/*`, and
`lore/*` raw kinds; their domain manifests and structural views are not
silently implied by this matrix. Textile still reports any such unpresented
kind by name.

| Splice command | Lync kind | Preserved source payload | Textile primary presentation | Source parent meaning |
| --- | --- | --- | --- | --- |
| `lync archive` (Twitter) | `twitter/tweet` | original tweet object | first exact string at `full_text`, `fullText`, or `text` | deterministic imported reply id, when present |
| `lync archive` (Twitter) | `twitter/like` | original like object | first exact string at `full_text`, `fullText`, or `text` | imported source parent, when present |
| `lync archive` (Bluesky) | `bluesky/post` | `{uri,cid,collection,rkey,record}` | exact `record.text` (top-level `text` only for normalized fallback payloads) | deterministic imported AT reply URI, when present |
| `lync glowfic` | `glowfic/thread` | thread metadata excluding posts | **structure:** title, thread id, authors, and source URL | root container |
| `lync glowfic` | `glowfic/post` | complete original post, including HTML `content` | inert plain text derived from that exact HTML | first post → thread; later post → previous post |
| `lync ocr` | `ocr/set` | set locator, source accounting, page range, gaps, document names | **structure:** locator, page/document counts, page range | root container |
| `lync ocr` | `ocr/page` | page text, description, file names, byte counts | exact `text` | first page → set; later page → previous page |
| `lync ocr` | `ocr/document` | combined document text, file name, byte count | exact `text` | set container |
| `lync tweet-embed` | `twitter/tweet-embed` | `{file,tweet_id,embed}` with the original oEmbed object | inert plain text derived from exact `embed.html` | matched canonical archive tweet when the importer was given archive ids; otherwise root |

Presentation is a view, never an import rewrite. Event ids, every parent,
actor axes, the complete payload, cluster tags, and conformance warnings remain
on the projected turn and full-tree export. Textile's reading path still follows
the nearest presented `parents[0]`; additional parents are visible on the
source control, drawn as passive typed MAP strings, and directly traversable
through LINKS. That projection choice is not a claim that
the Lync graph is a tree.

The implementation is Lync's reusable `@deepfates/lync/presentation`
contract, consumed here from a checksum-pinned build of the unpublished 0.4
candidate. Exact kind/profile claims run before its small generic
`text`/`message` contract. It does not recursively hunt for strings, and a
malformed claimed kind cannot fall through to generic prose. An unknown kind
is counted and named as unsupported in the import receipt. Domain meaning
still requires a ratified pact; the shared resolver does not invent one from
nested fields.
