# Vendored Lync presentation candidate

These files are the compiled, browser-safe presentation surface from
`deepfates/lync` commit
`fee7adc14f0038d9d0be51bd16b930659ffae1f8`:

- `index.js` SHA-256 `e116b6dc9288d1916fc940e020c175753161c0bec0e4dfef9ba8cdf773605beb`
- `presenters/behold-inhabitant.js` SHA-256 `d98e141b3c1932af43c79ff4a172d04045a1e05a0dacbf6ceac7c29027c7ed82`

Lync owns the API, dispatch, presentation pacts, and tests. This exact compiled
copy keeps the private application independently installable while its lock
remains on published Lync 0.3. It has no runtime dependencies and performs no
filesystem, network, DOM, clock, or storage I/O. Source-map trailers and map
files are omitted.

Regenerate by building that exact Lync commit and copying
`dist/presentation.js` and `dist/presenters/behold-inhabitant.js` with the
same relative layout. Replace this candidate with
`@deepfates/lync/presentation` after the owner-authorized Lync 0.4
publication; do not maintain consumer-local presentation heuristics.
