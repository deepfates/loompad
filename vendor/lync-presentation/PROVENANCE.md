# Vendored Lync presentation candidate

These files come from the immutable local package artifact
`/Users/deepfates/Hacking/data/artifacts/lync/deepfates-lync-0.4.2.tgz`,
SHA-256
`c83b01766b73656a334d49b28e54056472e2b171a981560ded642524fed3aba8`.
The archive declares `@deepfates/lync` version `0.4.2` and was packed from
`deepfates/lync` commit
`0ec1b37db5759c1f8f12a47394a0300925a5bfad`.

Vendored file digests are:

- `index.js` SHA-256 `3471960558021f9ffb9a885d9f56ba1cc20de07a301041fd542952fdecea22c3`
- `index.d.ts` SHA-256 `d7f523d246181fce6d99e60e7c36021ecda74ae83e8b8847a74e4ac260cc5a33`
- `presenters/behold-inhabitant.js` SHA-256 `2490ec6463ec4f3192732d6eb8b998304c6e811be3415921e4fca7d974b9b075`

The corresponding archive members have SHA-256
`a8411061032cd81b96646c77dfbf629acc6cb02ffebf353aa4287734b6c95d1b`
(`dist/presentation.js`),
`dceac3a543c799f5be84a31eab80ac1ae712a0c974f9535925d32da1f3d5842b`
(`dist/presentation.d.ts`), and
`e027474eacb6f484ed8c4242a4af622b1879f0cd0e6700504abd772ecf2904e7`
(`dist/presenters/behold-inhabitant.js`). `index.js` differs only by omission of
its source-map trailer. The vendored Behold presenter also carries Textile's
bounded `tex-nak8` reader overlay for four current resident lifecycle event
shapes, the current world-event wait result, and truthful chat/whisper input
dispatch settlement; all other unknown shapes still fail closed. `index.d.ts` keeps Textile's published-0.3-compatible
`@deepfates/lync/events` type import and declares the two exported profile
constants directly.

Lync owns the API, dispatch, presentation pacts, and tests. This exact compiled
copy keeps the private application independently installable while its lock
remains on published Lync 0.3. It has no runtime dependencies and performs no
filesystem, network, DOM, clock, or storage I/O. Source-map trailers and map
files are omitted.

Regenerate by verifying and extracting that exact package artifact, copying
`dist/presentation.js` and `dist/presenters/behold-inhabitant.js` with the same
relative layout, omitting their source-map trailers, then applying the bounded
reader overlay and declaration-only import adaptation described above. Replace
this candidate with `@deepfates/lync/presentation` after an owner-authorized
Lync release contains the same pact; do not add unrelated consumer-local
presentation heuristics.
