# Portable framework contract

Status: stable release `2.0.0`.

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
shortcut routing, explicit tool commands/export feedback, the generic generator
adapter, unified UI, zoom/pan, mobile coordination and deterministic utilities.
`src/experimental.js` is not stable.

Removal or incompatible behavior in the stable surface requires a new major
version. Every public change requires a version change, explicit snapshot
update and changelog entry. Internal modules are never valid application imports.

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

Native single-slider tracks keep the browser's keyboard semantics and the HTML
`step`: arrows change one step and Home/End use the bounds. Their paired numeric
fields add or subtract the fine step with Arrow Up/Down and the configured
coarse step with Shift+Arrow. Steps are additive rather than grid-snapped:
`0.25` plus `0.1` becomes `0.35`. Enter commits on blur and Escape restores the
last stored value.
Two-thumb range-slider handles use Left/Down and Right/Up for the configured
fine step, Shift for the coarse step, and Home/End for the nearest allowed
boundary. A lower handle cannot pass the upper handle, and vice versa.

## Assets

Runtime fonts and third-party dependencies are checked in under `fonts/` and
`vendor/`. Their versions and licenses are documented locally. CSS is loaded
before application CSS; applications may use documented tokens and named
modifiers but must not duplicate base component declarations.
