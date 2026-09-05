# Changelog

## 0.1.0-dev.2 — 2026-09-05

- Added exact stable and optional public API snapshots plus ownership metadata
  for every source module.
- Made application and controller teardown symmetric and re-initializable.
- Added cancellation and cleanup for active exports, imports, timers and Blob
  URLs.
- Removed side-effect auto-init entrypoints from the portable package.
- Removed remaining application-specific comments and CSS names.

## 0.1.0-dev.1 — 2026-09-05

- Created the initial self-contained UI Garage candidate.
- Added shared runtime source, CSS, local fonts, vendor dependencies, tests and
  the Component Lab.
- Made UI summaries, shortcut copy and selectors explicit configuration.
- Removed stage query strings from internal ES module imports.
- Made preset storage namespaces mandatory.
- Added version, manifest and portable-boundary verification metadata.
