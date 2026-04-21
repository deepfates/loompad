# Vendored fonts

All .woff/.woff2/.ttf/.otf files here were copied from `node_modules/srcl`
on 2026-04-21 to remove the SRCL runtime dependency.

OFL-licensed fonts (Anonymous Pro, Atkinson Hyperlegible Mono, Share Tech
Mono, Space Mono, Xanh Mono) ship with their OFL.txt attribution alongside
them — see the corresponding `OFL-<Font>.txt` files. Remove those only if
you also remove the font they cover.

Other faces (Monaspace family, Fira Code, Iosevka Term, Geist Mono, TT2020,
TX02Mono, SeriousShanns) have their own licenses in their upstream repos;
check those before redistributing separately.

The current picker surface — see `FONT_OPTIONS` in
`client/interface/components/ThemeToggle.tsx` — is a subset. If you add a
new face here, register an `@font-face` and a `.font-use-*` rule in
`client/styles/terminal.css`, and a `FONT_OPTIONS` entry in `ThemeToggle`.
