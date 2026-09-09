# UI Garage 1.0.2

UI Garage 1.0.2 adds the two-handle range-slider reference and keyboard
contract to the stable portable release. Copy this entire folder into another
repository, serve it from the same origin as the new tool, and use
`START_HERE.md` plus either full starter. No source application, package
installation, build step or external runtime request is required.

The release contains the stable public JavaScript API, canonical UI CSS and
local fonts, complete SVG and Canvas starters, Component Lab, local exporter
vendors and licenses, tests, recipes, manifest and clean-room Ribbon Field
proof. Shared capabilities include history, presets, versioned persistence,
share URLs, panels, shortcuts, dialogs, file intake, zoom/pan, mobile behavior,
SVG/PNG/PDF/JSON workflows and optional namespaced IndexedDB drafts.

This patch adds integer and decimal range-slider examples, accessible handle
names, dynamic ARIA bounds and browser-level keyboard regression coverage. It
also keeps the Component Lab dialog and ActionDock previews contained and
prevents the shortcut-help trigger from being injected twice.

Run `npm run gate:framework-extraction` after every copy. The archive SHA-256 is
distributed beside the archive; the per-file hashes live in
`framework-manifest.json`.
