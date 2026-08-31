# Sticky Fingers shared-framework migration

Sticky Fingers keeps its legacy modular GridGenerator and connects to the shared Upgrade framework through a deliberately small façade. The 10k-line `script.js` was not rewritten.

## Preserved application responsibilities

- Label geometry, grid calculations, text/graphics/barcode objects, edit mode, prepress frames and data-row navigation remain application-owned.
- The existing EAN-13 implementation is unchanged, including the visible console warning for the checked-in sample whose provided checksum is `7` and calculated checksum is `6`.
- SVG/PDF and multi-label export remain application-owned and use the already-localized jsPDF, svg2pdf and OpenType files from `../framework/vendor/`.
- Google Sheets CSV loading remains the only external runtime capability and starts only after the user clicks `Load Data`.
- Domain DOM remains unchanged. UPG-052e replaces only the back link's legacy
  class/text; UPG-053e promotes only panel-title typography in application CSS.
- Sticky Fingers' Lunnen Display files remain private because their hashes differ from the shared framework versions.

## Shared responsibilities

- `src/framework/FrameworkAdapter.js` is the single façade to the public `../framework/src/index.js` contract.
- Color conversion, luminance, contrast and grid-opacity calculations use the shared `ColorUtils`; the local duplicate was removed.
- Byte-identical TT Commons WOFF2/OTF files now load from `../framework/fonts/`; the four local duplicates were removed.
- `presets/manifest.json` is the only preset discovery source. Unused directory-listing and GitHub fallback code was deleted.
- `framework-base.css` loads the shared framework stylesheet in a named lower cascade layer before the frozen Sticky skin. Explicit bridges preserve inherited Arial action buttons and the legacy unbounded edit-panel height until their intentional G5 visual migration.

## Acceptance evidence

- Four automated tests cover the framework boundary, three-file manifest, explicit Google Sheets flow and existing EAN-13 checksum behavior.
- Browser metrics match exactly before/after at 1280×720 in both normal and edit modes: `gridSvg` viewBox `0 0 680 680`, 680×680 artboard, SVG counts, panels, inputs and preset text.
- G5 CSS participation checks compare 214 representative computed-style records in both normal and edit modes. All selected styles, panel visibility, `max-height`, SVG/top/actions geometry and the original 878.703 px long edit panel match after the two documented bridges.
- UPG-052e uses canonical `.top-link`, `←Upgrade Tools` and ARIA. The accepted
  visual difference is CoFo 16/500 with 8×20 px padding instead of the legacy
  system 14.4/600 `←YF Tools` link with 8×15 px padding. Recentring the wider
  toolbar moves preset and Edit Mode together by 27.70 px; their sizes/styles,
  exact normal/edit SVG markup, all 79 form states, panel/action geometry and
  the 878.703 px long edit panel remain unchanged. The three-item manifest
  dropdown still opens with correct ARIA state.
- Laptop → Tablet → Laptop preset switching returns exactly to baseline.
- The checked-in Google Sheets test link loads rows and exposes batch PDF/SVG actions; a reload returns to the original preset state.
- Current-label PDF export loads local OpenType and shared TT Commons successfully, with no dialog or browser error.
- `npm run check:isolation` passes; the only runtime network exception remains user-initiated `docs.google.com/spreadsheets`.

## G5 panel-title rollout

UPG-053e promotes all seven main/editor title wrappers and inline summaries from
13.6 to 14.4 px with an explicit 16 px line-height. The private panel/collapse
controller is unchanged. Normal Data Import remains 300×242; edit-mode Layout
remains 300×878.703, and every main header remains 46 px. Text Styles preserves
an expanded inner section through 300×505 → 300×46 → 300×505 collapse/restore.

Paragraph remains 300×847.492 and Graphics 300×567 with 54 px action headers.
Normal/edit SVG markup and all 79 form states match before/after. The intentional
full-page capture changes are
`2d2e8504548fb9b7aa821165f3987674f9407bb5b01f8583b02ea261ad02d850` →
`164e7ea8b77c18e1caab9105e33d1fa4097d257efc6f9b587b22a1c895e7b64f`
and
`c2d23861865909af98bc7aaae5261ebabb69873c1f6af80f1a9206c06c82f36d` →
`29946506e778ed142f24631037b5c942939f6518d45181a97f7c12d4d285815c`.
Google Sheets remains explicit and user-initiated; the local PDF code path was
not modified. Four tests and the complete isolation check pass.

Run `npm run test:sticky` from `upgrade/` for the automated Sticky Fingers checks.
