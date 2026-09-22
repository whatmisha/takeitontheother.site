# Browser runtime

These pinned browser builds are part of the published static application:

- `opentype.js` 1.3.4
- `jsPDF` 4.2.1
- `svg2pdf.js` 2.7.0

They load lazily only when outlined SVG or PDF export needs them. They are
generated from `tools/package-lock.json`; do not edit the minified files by
hand. After changing a pinned version, run:

```bash
npm --prefix tools install
npm --prefix tools run vendor
```

`npm --prefix tools run public:check` verifies both these copies and the
browser-resolvable source module graph. License texts are in `licenses/`.
