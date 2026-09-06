# Vendored Lync package

`deepfates-lync-0.4.3-0a511b6.tgz` was produced with `pnpm pack`
from the clean `@deepfates/lync` checkout at commit
`0a511b6f918acf87800bf433f34311ee47a9c48b`.

- Declared package version: `0.4.3`
- Archive SHA-256: `4de871ce1117cff040fedc069944c3705e314168e01f151ae6d27239f6d1b745`
- Required unpublished surfaces: `@deepfates/lync/indexed-union` and
  `@deepfates/lync/presentation`

This exact local package keeps Textile reproducible before an owner-approved
0.4 registry release. It is a dependency boundary, not a fork: union parsing,
conflict adjudication, topology, suppression, source-byte verification, and
domain presentation remain owned by Lync.
