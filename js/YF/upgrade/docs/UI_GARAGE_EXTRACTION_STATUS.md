# Portability status

Baseline: G13, commit `5700146f4eff56d8d8ece8092dc5d85475c483b1`.
Candidate: `0.1.0-dev.1` in `upgrade/extracted/ui-garage/`.

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
- current candidate: 74 tests, 92 manifested files and 47 source modules;
- content and filename scans find no previous product branding, forbidden font
  references or application-specific names in the portable source/docs/tests;
- only CoFo Sans Regular and Medium remain; both WOFF outline files parse with
  the bundled OpenType runtime.

## Open work, in execution order

| Priority | Phase | Gap | Acceptance |
|---|---|---|---|
| P0 | FX-03 | Audit all 47 source modules for stable/optional ownership and full teardown | Public API snapshot and init/destroy/re-init tests pass |
| P0 | FX-04 | Run isolated browser network and artifact checks | No 404s, runtime network fallbacks or broken SVG/PNG/PDF/JSON artifacts |
| P1 | FX-06 | Build complete `starters/svg-full` and `starters/canvas-full` | Both use only public API and pass artifact smoke tests |
| P1 | FX-02 | Expand Component Lab to every accepted state and add visual baselines | Shared component states have one visual owner |
| P1 | FX-05 | Switch the current eight tools to a pinned release copy | 8/8 use one version/hash and G13 remains green |
| P1 | FX-07 | Build a ninth tool from only this copied folder | Full product workflow works without original apps |
| P2 | FX-08 | Release `1.0.0`, archive/hash and migration guide | Reproducible release artifact accepted |

The clean-slate boundary task is complete. Do not mark this candidate portable
or switch existing tools before the remaining P0 rows are complete. Do not
release `1.0.0` before FX-07.
