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

- Private-alpha login pages now advertise Textile's PWA manifest and iOS app
  metadata. Only install manifests and declared icons bypass the site gate; the
  app shell, service worker, and APIs remain protected. Public metadata and
  OpenRouter attribution now use the live `textile.quest` domain.
- The visible Stories-drawer import picker now accepts multiple files like its
  keyboard-triggered counterpart, so an ordered Lync manifest and its exact
  source files can enter the existing authenticated source-set importer.
- Relay history and editable model configuration now share one explicit
  runtime-data root (`TEXTILE_DATA_DIR`, default `.data`), allowing production
  to mount them durably while keeping the checked-in model catalog immutable.
  Missing mutable catalogs seed from the bundled catalog; corrupt catalogs fail
  visibly instead of being overwritten. GitHub and production deployments now
  have one `bun run verify` gate covering lint, tests, and the production build.
- Generation now distinguishes exact raw continuation models from versioned Ax
  instruction programs. Hidden prompt armor, cleanup, whitespace rewriting,
  preamble retries, and judge retries were removed; stored model turns retain
  the generation mode and program that produced them. Raw continuation also
  disables provider reasoning explicitly so hidden thinking cannot consume its
  output allowance. Ax continuation now does the same, while judging requests
  explicit low reasoning; generation turns retain the policy and available
  provider token/cost usage in Loom provenance. Automatic choices are durable
  judge turns with ordered candidate and selected-turn identity, and stalled
  judges fail after a visible 30-second deadline.
- Story paths preserve every turn string and use one explicit structural space
  only when neither adjacent turn carries whitespace. The same serialization
  now drives the visible prose and the next provider request, preventing fused
  text such as `Cedric.Sir` without trimming or rewriting stored output.
- Model ID, name, token, and temperature editing now uses inline form controls
  instead of unsupported browser prompt dialogs.
- Raw Lync projection now consumes the checksum-pinned Lync presentation
  candidate. Textile's duplicated Splice and Behold presenter implementations
  were removed; exact source paths, profile fail-closed behavior, typed graph
  identity, and source-preserving contextual export remain intact.
- Presentation sections identical to a turn's primary text use a compact
  on-Loom marker and are expanded on read, avoiding a third serialized copy of
  large OCR prose without truncating source or presentation data.
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
