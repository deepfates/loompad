# Changelog

## [0.1.0] - Private application release candidate

Textile remains a private application and is not part of the npm publication
train.

### Added

- An ordinary native Twitter/X archive front door. Textile opens the ZIP
  locally through Splice's browser-safe adapter and presents tweets, retweets,
  likes, held reply topology, external-parent provenance, and exact source IDs
  as one reviewable Loom.
- Portable `textile/kept-conversation` Markdown: explicitly kept targets plus
  their Loom-parent context, notes, actor/source provenance, and a machine
  manifest reopen without the original ZIP. Nearby unkept archive items are
  excluded.
- A privacy-safe, checked-in nine-record archive and five-minute product
  walkthrough under `examples/twitter-archive/`.
- Direct raw `.lync` import with source identity, extra DAG parents, Curare
  annotations, and standard keep-selection export preserved.
- Fail-closed diagnostics for damaged, conflicting, incomplete, or cyclic
  unions.
- A genuine provider-free corpus rehearsal that executes sibling Splice,
  Lync, and Curare checkouts and crosses Textile's production projection, Loom
  import, append-only keep mark, reprojection, and selection exporter.

### Changed

- Production can boot without OpenRouter for provider-free corpus work;
  generation and judging alone return an explicit disabled response.
- Imported corpus records render as distinct visual beats while generated story
  fragments retain their continuous-prose seams.
- Token-only production access no longer makes durable websocket sync public.
- Corpus import receipts now name branch points, prior selections, conformity,
  and the sibling/Keep/map controls needed for a cold human inspection.
- The supported Lync range is `>=0.3.0 <0.5.0`; the checked-in rehearsal uses
  the sibling 0.4 source candidate while the registry lock remains on 0.3.
- The build toolchain now uses Vite 7 and its current esbuild line; the obsolete
  top-level-await compatibility plugin was removed, and `bun audit` is clean.

### Verification boundary

The native archive path is exercised through the real browser: ZIP chooser,
visible prose navigation, source chip, Keep, note, second-client relay
reconstruction after reconnect, menu download, manifest inspection, and fresh
browser reopen. This proves a useful contextual conversation artifact, not a
training perspective or support for every heterogeneous archive container.

The provider-free cross-repository rehearsal still crosses real app-layer code
rather than browser controls; its documented MAP and source-kind walk remains
the explicit human inspection for raw `.lync` unions.
