# Textile

Textile is a tactile multiverse loom for generating and exploring branching
possibilities. Grow a story from any turn, compare alternate continuations, or
open an archive and follow the paths and relations already there. Keeps, notes,
and generation provenance stay attached to their source material, so a path
through the loom can become a durable, portable record.

Today, Textile combines OpenRouter-backed continuation and judging with a
provider-free archive reader and curator. Its longer horizon is one human
projection over a shared causal record for generative work—text and media,
model and program traces, evaluations and selections, resident lives, and
world histories. That horizon is direction, not a claim that every source or
projection is implemented.

> **Status:** private application, version 0.1.0. This repository is not an npm
> package and has not been published as a public product. It uses a
> checksum-pinned unpublished Lync 0.4.3 build described in
> [`vendor/LYNC-PROVENANCE.md`](vendor/LYNC-PROVENANCE.md).

## Five-minute provider-free archive task

Requires [Bun](https://bun.sh/).

```sh
bun install --frozen-lockfile
bun run dev
```

Open the URL printed by `bun run dev`; it defaults to
`http://localhost:5173` on macOS and `http://localhost:5000` elsewhere or under
Replit. `PORT` overrides those defaults.

The example ZIP is parsed in the browser and is not uploaded. On the normal
URL, its minimized readable projection participates in Textile's configured
Lync relay, so use only a relay you trust. To disable the relay, append
`?lync=local` to the printed URL; the status strip must say **Lync local-only**.
A Twitter import in this mode remains curatable in browser-local IndexedDB but
cannot synchronize or produce working remote share links. Raw `.lync` imports
use the stricter session-only, read-only projection in this mode.

Choose **SELECT → Stories → Import Archive** and select
[`examples/twitter-archive/textile-twitter-demo.zip`](examples/twitter-archive/textile-twitter-demo.zip).
The checked-in synthetic archive contains two reply threads, an external-parent
reply, a retweet, and likes. It needs no OpenRouter key.

Press **START** to see the map. Use Down to follow a thread and Left/Right to
compare roots. Press `K` to keep the focused turn and `N` to attach a note, then
choose **Export KEPT** from that archive's Stories actions. The downloaded
Markdown contains each kept target and its parent path. Import the Markdown in
a fresh browser to reopen the selected context, source identities, keep, and
note without the original ZIP.

See the [exact walkthrough and privacy boundary](examples/twitter-archive/README.md).

## Grow a generative loom

Generation requires an OpenRouter account and may incur provider charges; the
archive task above does not. To use generation, put
`OPENROUTER_API_KEY=your_key` in `.env`, start Textile with `bun run dev`, and
open the local URL.

Textile opens on a story rooted at “Once upon a time, in Absalom,”. To replace
that seed, press Backspace, choose **edit**, enter your text, and press START to
save. Press Enter on a turn with no continuations to generate three possible
next branches. Enter on a turn that already branches adds one more. Use Down to
follow a branch, Left/Right to compare siblings, and Escape to move between the
reading column and MAP.

Backtick opens Settings, where model, temperature, length, and automatic
iteration are explicit. Each generated branch retains its model and settings;
the underlying Loom also retains generation mode, program, reasoning policy,
available provider usage, and any provider-returned reasoning provenance.

## What works now

Textile accepts:

- Twitter/X archive ZIPs containing tweets, retweets, and likes, converted
  locally through Splice's browser-safe adapter;
- raw `.lync` and `.jsonl` event unions, including supported Splice source
  kinds, Curare annotations, named pointers, and safe Behold resident views;
- authenticated Behold ordered-prefix manifests with their selected Lync
  source files, opened as a read-only indexed review;
- conversation Loom `.json` snapshots; and
- Textile kept-context and kept-conversation Markdown artifacts.

The reading column follows the first causal parent as a tree. MAP preserves that
geometry and shows additional causal parents, pointers, and annotation targets;
the focused source's LINKS sheet provides direct typed traversal. Keeps and
notes remain attached to exact source identities. Mutable Looms can synchronize
through the configured relay, and share links open the same story, thread, or
index in another browser.

The generative surface can create exact raw continuations or run the versioned
Ax continuation program. Automatic judging records its candidate set and
choice as a non-prose Loom turn. These features are unavailable when OpenRouter
is not configured; archive reading, curation, sync, and export continue to
work.

## Present limits

- The only source-native ZIP adapter is Twitter/X. Other Splice sources enter
  through raw Lync or conversation snapshots.
- A first-parent tree is one view of a Lync DAG, not a complete graph model.
- Indexed ordered source sets are read-only. Existing eager single-file imports
  retain their mutable/exportable behavior.
- The indexed path has opened a retained 68 MB Behold checkpoint and a synthetic
  490 MB projector fixture. The open `tex-wrif` ticket still requires a retained
  six-hour source set through the ordinary browser path; multi-day usability and
  browser-vendor heap behavior are not established.
- Kept artifacts preserve contextual selections; they do not infer training
  roles, a model perspective, or preference pairs.
- The application is private. Publication of Textile and the vendored Lync 0.4
  dependency remain owner decisions.

## Controls

| Key | Action |
| --- | --- |
| Arrows | Move through depth, siblings, menus, or the Loom dial |
| Enter | Open or generate where the current mode permits it |
| Backspace | Open actions for the focused turn |
| Escape | Toggle the map |
| `K` | Keep the focused turn |
| `N` | Note the focused turn |
| `L` | Open typed Lync links for the focused source |
| Backtick | Open settings |

The on-screen gamepad exposes the same navigation on touch devices. The mode
bar is the authority for the controls available in the current projection.

## Evidence and deeper documentation

The checked-in browser suite exercises native ZIP intake, visible navigation,
exact-source keep and note actions, relay reconstruction, download, manifest
inspection, and fresh-browser reopen. Unit tests cover import rejection,
presentation, graph relations, policy suppression, portable export, generation
provenance, authentication, and runtime storage. Run the current repository
gate with:

```sh
bun run verify
bun run test:e2e
```

These tests establish bounded behavior. They do not establish general archive
compatibility, public readiness, or the value of a multi-day corpus experience.

- [Raw Lync reference](docs/reference/raw-lync.md): accepted graph behavior,
  indexed source sets, presentation boundaries, and corpus-loop rehearsal.
- [Kept conversation contract](docs/reference/kept-conversation-export.md) and
  [kept-context contract](docs/reference/kept-context-export.md): portable
  artifact meaning and privacy boundaries.
- [Operations](docs/operations.md): local and production commands, access
  gates, persistence, relay modes, and configuration.
- [Interface design](docs/explanation/interface-design.md): why the projections
  and tactile control grammar have their present shape.
- [Changelog](CHANGELOG.md): release-candidate history and the evidence claimed
  for version 0.1.0.

Project-owned unfinished work is in `.tickets/`; `tex-wrif` is the one open
ticket in this checkout. Cross-project corpus coordination belongs to the
workshop ledger, not this README.

## License

MIT
