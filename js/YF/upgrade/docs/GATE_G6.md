# Gate G6 — interface unification acceptance

Status: **Complete** (2026-09-02).

Gate G6 accepts the intentional interface changes listed in
`G6_INTERFACE_UNIFICATION_PLAN.md` while preserving application-owned rendering,
documents, parsers, export pipelines, storage and network boundaries.

## Automated evidence

- `npm run gate:g6:static` passes the complete G5 suite plus FileIntake, choice,
  capability-manifest and Component Lab contracts.
- Framework: 55/55; Sparky: 196/196; Pizza Boxer: 169/169.
- All remaining application boundary/domain suites pass.
- Isolation covers eight tool entrypoints, the Upgrade hub and local framework;
  no runtime dependency escapes `upgrade/`.

## Browser evidence

- Eight tools load without module errors and retain visible output.
- Every ActionDock is viewport-centered; Pizza PDF has no border; JSON actions
  are hidden by default and canonical shortcut routing is component-tested.
- Sparky at 390×844 and 430×932 has no horizontal overflow. Primary exports are
  centered 12 px from the bottom; utility actions remain hidden.
- Dither default, Bayer and Pixel Size 4 raw-RGBA SHA-256 values remain exactly
  `1b4c210c…`, `9f8f96ab…` and `f93c0e2a…`.
- Component Lab renders all six required states without horizontal overflow.

Known pre-existing Sticky EAN-13 warning and Pulsar legacy verifier mismatch are
unchanged and remain documented in `MIGRATION_STATUS.md`.
