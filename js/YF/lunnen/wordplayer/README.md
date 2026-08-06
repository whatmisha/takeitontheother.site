# Wordplayer

Wordplayer is a self-contained static ES-module application. Its UI foundation,
runtime modules, fonts and assets all live inside this directory. It does not
depend on `/js/othersite-ui-framework/v3` or another project directory.

For local development, serve the Wordplayer directory itself:

```sh
cd /path/to/takeitontheother.site/js/YF/lunnen/wordplayer
python3 -m http.server 8000
```

Then open:

`http://localhost:8000/`

## Runtime

- Dither and Forms calculations run in dedicated workers so slider interaction
  does not block the interface.
- Image samples, form masks, font strings and glyph metrics use bounded caches.
- OpenType and static outline fonts are loaded only when curved SVG export is
  requested.

Run the worker regression and high-resolution performance checks with:

```sh
node tests/dither-worker.test.mjs
node tests/forms-worker.test.mjs
```
