# Vendored Lync package

`deepfates-lync-0.4.3-860aa54.tgz` was produced with `pnpm pack`
from the clean `@deepfates/lync` checkout at commit
`860aa549727bdec7fda2ba1571c0a6be1c787aa8`.

- Declared package version: `0.4.3`
- Archive SHA-256: `dad3cff0dfb2004a2d313f2d99a2f0ebe9e994677017b3432d8e4442b14f8d4c`
- Required unpublished surfaces: `@deepfates/lync/indexed-union` and
  `@deepfates/lync/presentation`

This exact local package keeps Textile reproducible before an owner-approved
0.4 registry release. It is a dependency boundary, not a fork: union parsing,
conflict adjudication, topology, suppression, source-byte verification, and
domain presentation remain owned by Lync.
