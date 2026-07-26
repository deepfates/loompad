# Vendored Splice browser adapter

These two small ESM files are the compiled, filesystem-free browser export from
`deepfates/splice` commit
`afa3d7c2952c06ed43392c8a5868c6f3421b86b2`:

- `index.js` SHA-256 `ba3fb30232b098095eafcff56894341d12dcb4647d2f385fde265ba7fa7c0f06`
- `browser/twitter-archive.js` SHA-256 `1d1cf953ae5af2ea4289b0157df4091121e1f7e724e2b93c9f0a0dd50ade4b`

Splice owns archive parsing and provenance semantics. Textile vendors this
unpublished 0.4 release-candidate surface so a clean standalone install can use
the ordinary archive front door before registry publication. Regenerate by
building that exact Splice commit and copying `dist/browser.js` plus
`dist/browser/twitter-archive.js` with the same relative layout, omitting their
source-map trailer comments because map files are not vendored. Replace this
copy with the package export after the owner-authorized Splice publication.

The adapter imports only `json5` at runtime and performs no filesystem or
network I/O. Textile owns ZIP member selection and supplies decoded text.
