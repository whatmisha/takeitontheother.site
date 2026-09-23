# Gate G4 — All eight tools on the shared framework

Gate G4 completes the parity-first framework migration for Pulsar Coder,
Dither and Wander Bender after the five primary tools accepted in Gate G3.

## Static acceptance

Run from `upgrade/`:

```sh
npm run gate:g4:static
```

The command includes Gate G3 and then runs the secondary-tool suites:

- Pulsar Coder: 8 boundary and codec tests;
- Dither: 9 boundary and algorithm tests;
- Wander Bender: 10 boundary, mode and geometry tests.

It also reruns the 34 framework conformance tests, 196 Sparky tests, 167 Pizza
Boxer tests, Wordplayer workers, Keyboarder domain/export checks, four Sticky
Fingers tests, source provenance, local assets, storage namespaces and runtime
filesystem/network boundaries.

## Browser acceptance recorded

- Pulsar Coder: exact 1280×720 SVG, panel and input parity; SVG export accepted.
  The pre-existing Voyager verifier defect is documented and unchanged.
- Dither: byte-identical default, Bayer and Pixel Size 4 captures; Canvas,
  overlay, panels, modal state and PNG path accepted. Its existing desktop and
  mobile overflow is intentionally unchanged.
- Wander Bender: Radial, seeded Random and seeded Flow Field match the source in
  canvas, SVG and panel geometry. Rays 3→6, collapse, extraction and reset also
  match. Only the required `←Upgrade Tools` back link differs from the source.

Detailed evidence is in each application's `MIGRATION.md`.

## Isolation evidence

The current boundary scan covers 434 runtime text files, nine entrypoints and
seven internal dependency symlinks. No symlink escapes `upgrade/`; no active
runtime imports `lunnen`, `othersite-ui-framework` or Void. Paper.js, fonts and
export libraries are local. Google Sheets remains the sole user-initiated
external runtime exception in Sticky Fingers.

## Result

All eight index links work and all eight applications consume the shared
framework directly or through a documented façade. Desktop parity is accepted,
Sparky remains the only mobile compatibility requirement, and post-parity
unification can proceed component by component under the protected Sparky gate.
