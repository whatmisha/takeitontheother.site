# Start here

## Current status

This is the stable `1.0.0` release. Runtime, assets and complete SVG and Canvas
starters are independently testable and travel together in this folder.

## Runtime boundary

Load the framework CSS before application CSS:

```html
<link rel="stylesheet" href="./ui-garage/css/framework.css">
<link rel="stylesheet" href="./ui-garage/css/ui-contract.css">
<link rel="stylesheet" href="./app.css">
```

Import only the public barrel:

```js
import { defineTool } from './ui-garage/src/index.js';
```

Do not import `src/core/*`, `src/ui/*` or create side-effect auto-init modules. Advanced
exports are available from the same barrel; optional, not-yet-stable controls
live in `src/experimental.js`.

Every tool must provide a unique, versioned storage namespace, for example:

```js
presets: { storageKey: 'ui-garage:my-generator:presets:v1' }
```

Generic UI behavior is configured explicitly. `UnifiedUiController` never
detects an application from its URL. Tool-specific panel summaries and shortcut
copy are passed as `summaryProviders` and `shortcutRows`; a primary file action
uses `data-shortcut-open-file`; panels excluded from global collapse use
`data-shared-collapse="false"`.

## Choose a starting point

For a production-shaped graphics generator, copy the nearest complete starter
into the new project and replace only its domain settings and render functions:

- `starters/svg-full/` — vector rendering with SVG/PNG/PDF export;
- `starters/canvas-full/` — DPR-aware raster rendering with PNG export, asset
  intake and an optional SVG hook.

Both starters include panels, controls, history, presets, persistence, share,
validated JSON, file intake, dialogs, responsive behavior and complete cleanup.
They import only `src/index.js`; no existing product is required or referenced.
Assets loaded by the Canvas starter are session-only unless the new tool defines
and documents its own persistence format.

To create a deliberately minimal clean SVG or Canvas scaffold outside this
folder, run:

```sh
node scripts/create-tool.mjs ../my-tool --id my-tool --renderer svg --name "My Tool"
```

The command never overwrites an existing path. The generated scaffold is
intentionally smaller than the full starters. Before moving the directory or
starting application work, run `npm run check`. Serving and browser requirements
are in `BROWSER_SUPPORT.md`.
