# Portable framework contract

Status: stable release `1.0.0`.

## Dependency direction

Allowed: application → `src/index.js`; application → its domain modules;
framework → files contained in this directory. Forbidden: framework → an
application, application A → application B, runtime CDN fallbacks and imports
outside the copied folder.

Applications must not import framework internals. Tool-specific geometry,
schemas, presets, copy, filenames and business rules stay in the application.
Generic differences are supplied through config, hooks, adapters, documented
CSS tokens or `data-*` attributes.

## Stable candidate surface

`PUBLIC_API.json` is the machine-readable snapshot. The public barrel exports
the application shell, SVG and Canvas targets,
settings, history, presets, share codec, SVG/PDF/text-outline infrastructure,
panels, sliders, color controls, dialogs, tooltips, file intake, ActionDock,
shortcut routing, unified UI, zoom/pan, mobile coordination and deterministic
utilities. `src/experimental.js` is not stable.

Until `1.0.0`, changes to the stable candidate surface require a version change,
an explicit snapshot update and a changelog entry. Starting with `1.0.0`, removal
or incompatible behavior in that surface requires a new major version. Optional
exports may change before `1.0.0`; promoting one to stable requires the same
snapshot review. Internal modules are never valid application imports.

`MODULE_OWNERSHIP.json` records the owner, surface and cleanup contract of every
source module and must stay in exact lockstep with `src/`.

## UI configuration

`UnifiedUiController` accepts `toolName`, `summaryProviders`, `shortcutRows`,
`fileTriggerSelector`/`resolveFileTrigger`, `panelSelector`,
`excludedPanelSelector` and `historySelector`. Side-effect auto-init entrypoints
are not shipped; applications initialize controllers through the public API or
through `defineTool`.

The default file trigger is `[data-shortcut-open-file]`. The default collapse
scope is visible `.controls-panel` elements with a direct-header
`.collapse-icon`; set `data-shared-collapse="false"` for a private panel.

## Storage and lifecycle

`PresetStore` requires a non-empty, unique, versioned `storageKey`; there is no
shared production fallback. Applications own migrations. Framework controllers
must support symmetric init/destroy and must release listeners, observers,
timers, workers and Blob URLs they create.

## Keyboard contract

Canonical commands are Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Cmd/Ctrl+E,
Cmd/Ctrl+J, Shift+Cmd/Ctrl+J, J, Cmd/Ctrl+backslash, `?`, and Escape when the
corresponding capability exists. Browser-owned Cmd/Ctrl+0 and Cmd/Ctrl+1 are not
captured. Zoom plus/minus is opt-in through the zoom capability.
The primary export defaults to SVG; Canvas tools can declare
`export.primaryFormat: 'png'`, `primaryFilename` and `primaryScale` without
registering a competing shortcut.

## Assets

Runtime fonts and third-party dependencies are checked in under `fonts/` and
`vendor/`. Their versions and licenses are documented locally. CSS is loaded
before application CSS; applications may use documented tokens and named
modifiers but must not duplicate base component declarations.
