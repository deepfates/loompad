# Vendored Lync presentation candidate

These files come from the immutable local package artifact
`/Users/deepfates/Hacking/data/artifacts/lync/deepfates-lync-0.4.1.tgz`,
SHA-256
`0230b18b564f88af0dbefc5d21e7b75757ab33d461e155079ab0b36e93fae655`.
The archive declares `@deepfates/lync` version `0.4.1` and was packed from
`deepfates/lync` commit
`38017609699d9d0a1c0d1b356a0715eb88f8dc9f`; the additive Behold v2
presenter landed in its parent commit
`ed057468e8d6b81dcdf9ebbac590e5bf6e809b84`.

Vendored file digests are:

- `index.js` SHA-256 `3471960558021f9ffb9a885d9f56ba1cc20de07a301041fd542952fdecea22c3`
- `index.d.ts` SHA-256 `d7f523d246181fce6d99e60e7c36021ecda74ae83e8b8847a74e4ac260cc5a33`
- `presenters/behold-inhabitant.js` SHA-256 `96087974cf19735c9a69d6aec939cd7019f7c56f188269a833cd972d01ede936`

The corresponding archive members have SHA-256
`a8411061032cd81b96646c77dfbf629acc6cb02ffebf353aa4287734b6c95d1b`
(`dist/presentation.js`),
`dceac3a543c799f5be84a31eab80ac1ae712a0c974f9535925d32da1f3d5842b`
(`dist/presentation.d.ts`), and
`30ce12133a037f0e6840f84b8e513111d5abc4307acd79cdb02f56a97f794b7f`
(`dist/presenters/behold-inhabitant.js`). The JavaScript copies differ only
by omission of their source-map trailers. `index.d.ts` keeps Textile's
published-0.3-compatible `@deepfates/lync/events` type import and declares the
two exported profile constants directly; runtime behavior remains the exact
compiled 0.4.1 surface.

Lync owns the API, dispatch, presentation pacts, and tests. This exact compiled
copy keeps the private application independently installable while its lock
remains on published Lync 0.3. It has no runtime dependencies and performs no
filesystem, network, DOM, clock, or storage I/O. Source-map trailers and map
files are omitted.

Regenerate by verifying and extracting that exact package artifact, copying
`dist/presentation.js` and `dist/presenters/behold-inhabitant.js` with the same
relative layout, omitting only their source-map trailers, and applying the
declaration-only import adaptation described above. Replace this candidate with
`@deepfates/lync/presentation` after the owner-authorized Lync 0.4
publication; do not maintain consumer-local presentation heuristics.
