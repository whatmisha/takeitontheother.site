# Portability status

Baseline: G13, commit `5700146f4eff56d8d8ece8092dc5d85475c483b1`.
Candidate: `0.1.0-dev.2` in `upgrade/extracted/ui-garage/`.

## Completed in iteration 1

- isolated folder created without changing current consumers;
- runtime, CSS, fonts, vendors/licenses, tests and Component Lab copied;
- G13 baseline captured;
- app-name/URL branching removed from candidate `UnifiedUiController`;
- UI summaries, private shortcuts and file/panel exceptions converted to config
  or declarative attributes;
- internal gate-stage import query strings removed;
- shared preset-storage fallback removed;
- portable manifest and boundary verifier added.
- `npm run check` passed after copying the folder to a nested temporary path
  containing spaces and Unicode.
- portable folder renamed to `ui-garage`; project-specific evidence moved to
  `upgrade/docs`; package branding and bundled font inventory cleaned.
- current candidate: 85 tests, 89 manifested files and 43 source modules;
- content and filename scans find no previous product branding, forbidden font
  references or application-specific names in the portable source/docs/tests;
- only CoFo Sans Regular and Medium remain; both WOFF outline files parse with
  the bundled OpenType runtime.
- FX-03 public API and module ownership are exact machine-readable snapshots;
- application/controller teardown supports init, destroy and clean re-init;
- failed initialization, duplicate/aborted export, aborted import, timers and
  Blob URL cleanup are covered by tests;
- side-effect auto-init entrypoints were removed from the portable package.
- `npm run check` is green both in place and in a fresh nested copy whose path
  contains spaces and Unicode.

## Open work, in execution order

| Priority | Phase | Gap | Acceptance |
|---|---|---|---|
| P0 | FX-04 | Run isolated browser network and artifact checks | No 404s, runtime network fallbacks or broken SVG/PNG/PDF/JSON artifacts |
| P1 | FX-06 | Build complete `starters/svg-full` and `starters/canvas-full` | Both use only public API and pass artifact smoke tests |
| P1 | FX-02 | Expand Component Lab to every accepted state and add visual baselines | Shared component states have one visual owner |
| P1 | FX-05 | Switch the current eight tools to a pinned release copy | 8/8 use one version/hash and G13 remains green |
| P1 | FX-07 | Build a ninth tool from only this copied folder | Full product workflow works without original apps |
| P2 | FX-08 | Release `1.0.0`, archive/hash and migration guide | Reproducible release artifact accepted |

The clean-slate and lifecycle/public API tasks are complete. Do not mark this
candidate portable or switch existing tools before FX-04 is complete. Do not
release `1.0.0` before FX-07.
