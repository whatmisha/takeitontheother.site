# Start here

## Current status

This is an extraction candidate, not the finished framework release. Runtime
and assets are independently testable; complete SVG and Canvas starters are not
included yet.

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

Before moving the directory or starting application work, run `npm run check`.
