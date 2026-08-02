# Vendored Lync package

`deepfates-lync-0.4.3-6e0734d.tgz` was produced with `pnpm pack`
from the clean `@deepfates/lync` checkout at commit
`6e0734d5a5c7a321dfbf42970035a4d235d63a8a`.

- Declared package version: `0.4.3`
- Archive SHA-256: `90a6a551f4bbc709192d06cec71d4df26ce4e6554add90c7407900bdca250f91`
- Required unpublished surfaces: `@deepfates/lync/indexed-union` and
  `@deepfates/lync/presentation`

This exact local package keeps Textile reproducible before an owner-approved
0.4 registry release. It is a dependency boundary, not a fork: union parsing,
conflict adjudication, topology, suppression, source-byte verification, and
domain presentation remain owned by Lync.
