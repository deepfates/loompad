# Vendored Lync package

`deepfates-lync-0.4.3-828a140.tgz` was produced once with `pnpm pack`
from the clean `@deepfates/lync` checkout at commit
`828a14017ea71519c510b0808a49d6382a36ed33` (tree
`f24e6122012f24beea934a1f639117ab15694725`). Sibling consumers reuse these
exact archive bytes and checksum rather than repacking the source.

- Declared package version: `0.4.3`
- Archive SHA-256: `cc90bfc8766ecab7c7ab53298ca0fdff8e3649626879f6cab7300c071e566196`
- Required unpublished surfaces: `@deepfates/lync/indexed-union` and
  `@deepfates/lync/presentation`

The source verification gate passed 223 tests across 26 files, typecheck,
executable examples, and its packed-artifact check. Its bounded regressions
cover public mutation completion during an overlapping async batch, reentrant
batch producers, partial file-store writes, and relay retry/reopen after
partial writes. Textile separately exercises the installed archive through an
IndexedDB fresh-store reopen regression and its provider-free browser path.
These checks establish those cases, not a blanket durability guarantee.

This exact local package keeps Textile reproducible before an owner-approved
0.4 registry release. It is a dependency boundary, not a fork: union parsing,
conflict adjudication, topology, suppression, source-byte verification, and
domain presentation remain owned by Lync.
