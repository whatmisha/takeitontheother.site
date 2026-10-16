# Erik interface review — 2026-10-15

References: `grainy_land/index.html`, `grainy_land/app.css`, Sparky's `styles/sparky.css`, and the shared `othersite-styles.css`, `ui-contract.css`, `ToolUiController`, `ActionDockController` and `ApplicationShell`.

| Area | Found | Applied correction |
| --- | --- | --- |
| Top navigation | Full-width custom alignment and extra Erik/Crawl label displaced the preset controls. | Inherit shared centered `.top-links`; constrain it to the space between side panels; preserve centered wrapping on smaller desktop windows. |
| Preset actions | Custom ellipsis file menu, no native shared link. | Standard preset/share controls; Save as and JSON actions use ActionDock extras and canonical shortcuts. |
| Canvas | Gray preview wrapper and frame styling differed from the actual artboard; standalone Fit button lacked zoom behavior. | Shared artboard edge follows the auto-fitted canvas. Following the UI simplification request, zoom/pan and the Fit button are disabled; resize keeps the canvas centered. |
| Panels | Different top offsets, widths and gaps. | Shared 20 px edge offsets and responsive studio-panel width; content/style left and Motion right. Shared collapse, drag and height resize remain. |
| Content editor | Separate text and row editors, mode selection and conversion actions added complexity. | One textarea with inline syntax and a wide modal editor for long lines; Apply is a single undo step, Cancel/Escape discard the modal draft. Syntax help is in ?. Legacy active content converts automatically, with an original-library backup. |
| Typography controls | Numeric spinners differed from shared value fields; disclosures lacked standard chevrons. | Shared range/value fields; Weight, Tracking and Text measure are directly exposed. Font caption, brand-color shortcut, PNG note and role/name alignment UI are removed. Column gap remains available for pairs. |
| Timeline | Tiny labels and a custom/native-mixed range appearance. | Compact 640 px maximum-width palette with centered Play/Pause and Stop, range tick marks and current-segment caption. Removed loop, step/restart buttons, marker links and frame count. At 1280×720 the timeline is 82 px tall; separate circular icon buttons, phase and editable timecode share the top row. |
| Export progress | Separate thin native progress bar and rectangular Cancel button. | Combined pill replacing export actions, matching Sparky/Grainy Land, with accessible cancel control and progress element. |
| Timing | Duration waited for the last line to disappear at the far edge. | Whole-ribbon opacity fade starts when final ink enters; timeline has a fade tick mark and updates the caption for the selected segment. |
| Help and shortcuts | File actions were outside the standard command list. | Shared keyboard-help list includes save, JSON, playback and frame stepping. |

## Verification

- 31 Node tests: mixed notation, legacy migration/backup, JSON round trips, column wrapping, headings, timing and geometric collision prevention.
- 19 browser artifact checks: exact PNG equality between renderer and worker, transparent final frame, complete ZIP, cancellation/retry, 1920×1080 H.264 decoding and 23.000-second Full Credits duration.
- Seven isolated browser checks for the actual preset session, file intake and storage failure paths.
- Visual checks at 1024×768, 1280×720 and 1920×1080. Side panels do not overlap the default canvas/timeline; header centers on the viewport. At 1024 px the header wraps to two rows. Expanded ActionDock extras span the bottom, as in the framework. Temporary viewport override was reset.
- Full-content share link restored the 557-character Full Credits body and settings. Export cancellation returned controls and retained the current timecode. J/Escape exposed/hid extra actions.

The intended UI remains desktop-only. Long panel content scrolls, as in the other tools. The older intermittent logo-handoff antialiasing difference is recorded in `acceptance.json`; the exact-byte comparisons passed in this run. This review covers Erik and its integration, not unrelated work in other tools.


## Simplification verification

- Re-ran all 31 Erik tests and 27 shared UI/controller tests.
- Wide editor: Cancel kept the original 557 characters; Apply preserved two appended newlines (559 characters); one Undo restored all 557 characters. The dialog uses the shared focus restoration and native modal behavior.
- Playback: Play became Pause while frames advanced; Pause held 00:09:27; Stop returned to 00:00:00. Seeking to 00:05:00 showed Logo → Crawl.
- Canvas stayed at x316–964 / y118.75–483.25 during wheel input at 1280×720. At 1024×768, canvas center and workspace center both equalled (512, 345). No zoom control or canvas interaction listeners are initialized.
- Motion contains exactly four sliders, with a 10 px margin between its header and first control. No section headings or timing notes remain.
- Help retained both formatting hints after text edits and undo. The original Full Credits preset was restored after the checks.

## Compact editor and transport verification — 2026-10-16

- Text starts at five rows: 129.97 px including padding/border, with 21.6 px line height. Native vertical resizing stops at 230.40 px with Logo collapsed; the panel body has no overflow (327 px client/scroll height).
- Expanding Logo reduces the resized Text field to 152.40 px. At 960×600 it becomes 90 px, with zero panel-body overflow. The field retains its own text scrollbar.
- Alignment control and event bindings removed. The existing `justify-all` default and preset compatibility remain unchanged.
- Play/Pause and Stop use shared 36×36 circular icon actions, separated by 8 px. The group remains exactly centered. Phase and timecode align on the same row at both 1280×720 and 960×600, without overlap. Timeline height is 82 px.
- Play shows the Pause SVG while frames advance; Pause shows Play and freezes playback; Stop returns to zero. Timecode seeking and the Logo → Crawl caption work. No browser console errors.
- All 31 Erik and 27 shared UI/controller tests pass. Full Credits content and settings preserved; viewport reset and preview left at 00:12:00. Renderer/export code is unchanged.

## Ending integration — 2026-10-16

- Content now has Crawl / Ending tabs using shared segmented controls, tab semantics and arrow/Home/End navigation. Crawl retains its bounded five-line editor; Ending gets enough panel height for its controls.
- Ending type select, file action, range/value fields and fade switch reuse framework controls. The four Motion sliders and centered circular transport remain unchanged. Timeline gains an ending tick and phase captions.
- Verified actual .lottie upload, draft restoration on reload, gap retiming (450 / 120 = 113 output frames), and the default-off fade switch. The uploaded test asset is removed after QA.
- All 35 model/preset tests and 27 shared UI tests pass, plus 9 ending artifact checks, 9 isolated library checks and the existing 19 crawl/export checks.
