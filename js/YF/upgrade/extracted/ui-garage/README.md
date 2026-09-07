# UI Garage

UI Garage is a self-contained foundation for static SVG and Canvas graphics
tools. Runtime source, CSS, fonts, vendor libraries, licenses, tests and the
Component Lab are local to this folder.

Current stable version: `1.0.0`.

Requirements:

- browser runtime: static same-origin HTTP hosting, no bundler;
- verification only: Node.js 24 or a compatible maintained version;
- no package installation is required for the current test suite.

Run from this directory:

```sh
npm test
npm run verify
npm run gate:framework-extraction
```

For the real-browser portability smoke, serve this folder over HTTP and open
`tests/browser-smoke/`. The page imports only `src/index.js`, verifies local
CSS/fonts/vendor responses, rejects remote resource requests, and validates
SVG, PNG, PDF and JSON artifacts. A successful run displays
`Browser smoke passed` together with artifact byte sizes.

Read `START_HERE.md` before creating an application and `CONTRACT.md` before
extending the public API. `PUBLIC_API.json` and `MODULE_OWNERSHIP.json` are the
machine-readable API and ownership snapshots enforced by the test gate.

Use `starters/svg-full/` or `starters/canvas-full/` as the complete reference
application for a new graphics tool. Both demonstrate the shared UI, lifecycle,
history, presets, share, imports and exports without depending on another tool.

Create a non-destructive clean scaffold outside this folder:

```sh
node scripts/create-tool.mjs ../my-tool --id my-tool --renderer svg --name "My Tool"
```

Use `--renderer canvas` for a Canvas scaffold. Existing output paths are never
overwritten. See `BROWSER_SUPPORT.md` for the supported browser policy and
same-origin static-server setup. Release contents and updating a copied folder
are documented in `RELEASE_NOTES.md` and `MIGRATION_GUIDE.md`.
