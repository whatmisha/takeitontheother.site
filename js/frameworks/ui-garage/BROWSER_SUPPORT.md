# Browser and serving support

UI Garage applications are static same-origin sites. The runtime requires no
bundler and makes no CDN or remote-font requests.

## Supported browsers

The release gate targets:

- the latest two stable desktop versions of Chrome, Edge and Firefox;
- Safari 17.4 or newer on macOS;
- Safari 17.4 or newer on iOS for tools that enable the mobile layer.

JavaScript modules, dynamic import, `AbortController`, Canvas `toBlob`, SVG DOM,
the Font Loading API, Blob URLs and localStorage must be available. A tool may
declare a narrower browser range when its own rendering code needs newer APIs.

## Static server

Serve the common parent of UI Garage and the tool so both share one origin. For
example, with `ui-garage/` and `my-tool/` next to each other:

```sh
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/my-tool/`. Opening `index.html` through `file://` is
unsupported because module, font and fetch behavior differs from HTTP hosting.

For framework QA, serve the UI Garage directory itself and open
`tests/browser-smoke/`. A passing page reports zero remote requests and valid
SVG, PNG, PDF and JSON artifacts.
