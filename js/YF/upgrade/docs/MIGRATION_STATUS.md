# Migration Status

Последнее обновление: 2026-09-02.

## Gates

| Gate | Содержание | Статус |
|---|---|---|
| G0 | Документы, source manifest, test/visual/runtime baselines | Passed |
| G1 | Восемь автономных копий, paths/storage/network isolation | Passed |
| G2 | Общий framework и conformance suite | Passed |
| G3 | Wordplayer, Keyboarder, Sparky, Pizza Boxer, Sticky Fingers | Passed |
| G4 | Pulsar Coder, Dither, Wander Bender | Passed |
| G5 | Последующая визуальная и API-унификация | Passed |
| G6 | Осознанная унификация интерфейса поверх G5 | In progress |

## Задачи

| ID | Результат | Статус | Проверка |
|---|---|---|---|
| UPG-000 | Основные документы | Complete | Документы согласованы между собой |
| UPG-001 | `SOURCE_MANIFEST.json` | Complete | `npm run manifest:check`; author-owned `sparky/stages` исключён из runtime copy |
| UPG-002 | Test baselines | Complete | Команды и результаты записаны |
| UPG-003 | Visual/runtime baselines | Complete | 8 desktop + 2 Sparky mobile captures |
| UPG-010 | Чистое копирование | Complete | 915 файлов сверены до relocation-правок |
| UPG-011 | Relocation paths | Complete | Browser smoke + boundary scan |
| UPG-012 | Upgrade index | Complete | Восемь относительных ссылок |
| UPG-013 | Local vendor/fonts | Complete | 5 source-backed + 6 canonical assets + 3 pinned downloads |
| UPG-014 | Storage isolation | Complete | 6 original sentinel keys неизменны |
| UPG-015 | Boundary scanner | Complete | `npm run check:isolation` |
| UPG-020 | v3 snapshot и working framework | Complete | 50 immutable / 17 modified upstream files |
| UPG-021 | Public contracts | Complete | `framework/CONTRACT.md`, public barrel |
| UPG-022 | Keyboarder improvements | Complete | export/font/preset conformance |
| UPG-023 | Sparky improvements | Complete | 34 framework + 195 Sparky tests |
| UPG-024 | Void principles | Complete | history audit, RNG/share/export/mobile tests |
| UPG-025 | CSS compatibility | Complete | exact v3/Void base, local font-only diff |
| UPG-026 | Framework conformance | Complete | SVG/Canvas browser demos, `gate:g2:static` |
| UPG-030 | Wordplayer Canvas-canary | Complete | public barrel/CSS, no local foundation, workers + browser parity |
| UPG-031 | Keyboarder SVG-canary | Complete | public barrel/CSS, no local framework, SVG/PDF + browser parity |
| UPG-032 | Sparky priority migration | Complete | 196 tests; exact desktop + 390×844 + 430×932 browser parity |
| UPG-033 | Pizza Boxer adapter migration | Complete | 166 tests; exact desktop parity; 15-asset reproducible runtime |
| UPG-034 | Sticky Fingers façade migration | Complete | 4 tests; exact normal/edit parity; Sheets + PDF browser acceptance |
| UPG-040 | Pulsar Coder legacy-adapter migration | Complete | 8 tests; exact desktop parity; presets/panels/SVG export accepted |
| UPG-041 | Dither Canvas-adapter migration | Complete | 9 tests; exact default/Bayer/Pixel Size 4 parity; modal and PNG path accepted |
| UPG-042 | Wander Bender three-mode migration | Complete | 10 tests; exact Radial/Random/Flow, collapse and extraction parity; local Paper.js |
| UPG-050 | Post-parity compatibility matrix and rollout plan | Complete | `G5_UNIFICATION_PLAN.md`; runtime unchanged; Gate G4 remains green |
| UPG-051a | Pizza Boxer shared-CSS participation | Complete | lower cascade layer; one Arial bridge; 289 computed-style records and geometry exact; 167 tests |
| UPG-051b | Sticky Fingers shared-CSS participation | Complete | lower cascade layer; Arial/unbounded-panel bridges; 214 normal/edit style records exact; 4 tests |
| UPG-052a | Wander canonical top navigation | Complete | intentional `.top-link` visual diff + ARIA; zoom/panel/SVG/domain invariants exact; 10 tests |
| UPG-052b | Pulsar canonical top navigation | Complete | intentional `.top-link` visual diff + ARIA; preset/zoom/panels/SVG/inputs exact; 8 tests |
| UPG-052c | Dither canonical top navigation attempt | Reverted / deferred | deterministic canvas-area capture changed; rollback restored exact `aa118…` baseline |
| UPG-052d | Pizza Boxer canonical top navigation | Complete | rebuilt 15-asset runtime; intentional link/group shift; panels/SVG/113 inputs/collapse exact; 167 tests |
| UPG-052e | Sticky Fingers canonical top navigation | Complete | intentional link/group shift; normal/edit SVG, 79 inputs, panels and 878.703 px height exact; 4 tests |
| UPG-052f | Keyboarder navigation accessibility | Complete | ARIA-only; zero visual diff; keyboard SVG and 82 inputs exact; all domain suites pass |
| UPG-052g | Sparky navigation accessibility | Complete | ARIA-only; zero desktop visual diff; mobile-safe attribute proof; character SVG/68 inputs exact; 196 tests |
| UPG-052h | Wordplayer mode-navigation accessibility | Complete | explicit variant; byte-identical Dither/Forms captures; Canvas/panels/68 inputs exact; workers pass |
| UPG-053a | Panel/collapse compatibility matrix | Complete | 33 shells; visual/ownership/accessibility families recorded; Wander selected as first title-only canary |
| UPG-053b | Wander shared panel-title canary | Complete | 13.6→14.4 px only; 46 px header/collapse, 300×605.703 panel, 41 inputs and three SVG modes exact; 10 tests |
| UPG-053c | Pulsar shared panel-title canary | Complete | three titles 13.6→14.4 px only; header/anchors, default/collapsed/expanded rects, 1000×720 SVG and 22 inputs exact; 8 tests |
| UPG-053d | Pizza Boxer shared panel-title rollout | Complete | seven titles/summaries 13.6→14.4 px; 15-asset rebuild; right stack/editors/SVG/113 inputs exact; 167 tests |
| UPG-053e | Sticky Fingers shared panel-title rollout | Complete | seven titles/summaries 13.6→14.4 px; normal/edit, 878.703 px Layout, inner restore, editors/SVG/79 inputs exact; 4 tests |
| UPG-053f | Direct canonical panel-title verification | Complete | no visual diff; Sparky 47 px and Keyboarder/Wordplayer 46 px headers; collapse/modes/SVG/Canvas/inputs exact; boundary tests added |
| UPG-053g | Shared collapse accessibility | Complete | idempotent click/Enter/Space + synchronized ARIA; direct apps/Wander exact; Pulsar duplicate removed with byte-identical capture; 35 framework tests |
| UPG-054a | Numeric/value-display compatibility matrix | Complete | 137 text displays, 48 native number inputs, 122 ranges; ownership/state families fixed; Pulsar selected as presentation-only canary |
| UPG-054b | Pulsar shared value-display canary | Complete | 8 displays consume shared base; intentional 4 px padding/min-width diff; panels/ranges/exact 22 inputs and 40 180-char SVG restore; keyboard/commit semantics exact |
| UPG-054c | Wander shared value-display rollout | Complete | 19 displays shared/tabular; private disabled extension exact; Auto/Max + dynamic max, 41 inputs, panel and three SVG modes restore |
| UPG-054d | Sparky canonical value-display verification | Complete | verification-only: 24 shared pairs + 3 readonly HSB; desktop SVG/68 inputs/panels/keyboard exact; unchanged sources preserve accepted mobile baselines; 196 tests |
| UPG-054e | Wordplayer ordinary/compact value-display verification | Complete | verification-only: 20 shared pairs + 3 readonly HSB; sole scoped 8-field Forms extension protected; both modes, Canvas, panels, 68 inputs and workers exact |
| UPG-054f | Keyboarder shared HSB/private mm verification | Complete | verification-only: canonical 3 HSB + six 100×26 suffix fields; private precision lifecycle recorded; 133 295-char SVG/82 inputs/panels exact after reload; 6 suites |
| UPG-054g | Pizza Boxer shared value-display rollout | Complete | shared base + one scoped layout selector; intentional 4 px normalization across 38 displays; 15-asset rebuild; 113 inputs/29 ranges/editors/panels/SVG exact; 167 tests |
| UPG-054h | Dither raster-safe shared value-display | Complete | shared base with scoped normal-glyph/HSB compatibility; rejected tabular raster drift; default/Bayer/Pixel4 byte-identical; 38 inputs/13 ranges/panels exact; 10 tests |
| UPG-054i | Sticky Fingers native-number boundary | Complete | zero active text displays; dead CSS removed; 39 static + 1 dynamic native number fields preserved; normal/edit 79 form states/panels/SVG exact; 5 tests |
| UPG-054j | Single-thumb range compatibility matrix | Complete | 122 ranges: 107 ordinary + 15 HSB; 106 shared-compatible, Pizza HSB 3 + Dither 13 private; Pulsar selected as zero-diff canary |
| UPG-054k | Pulsar shared ordinary-range canary | Complete | shared thumb/track/hover/focus + one 6 px reset bridge; normal/hover/focus byte-exact; 8 ranges/panels/22 input-select states/40 180-char SVG exact; 8 tests + Gate G4 |
| UPG-054l | Direct canonical range verification | Complete | Sparky 24+3, Wordplayer 20+3, Keyboarder 0+3; no production diff; shared skin/HSB gradients/docking/live restore and compact Forms protected |
| UPG-054m | Wander shared ordinary-range rollout | Complete | 19 shared ranges + 6 px reset bridge; private disabled Auto/Max exact; byte-identical Radial/Random/Flow captures/SVG, dynamic max 15; 10 tests |
| UPG-054n | Pizza Boxer shared ordinary-range rollout | Complete | 26 ordinary ranges use shared skin + 6 px reset bridge; three HSB ranges/history remain private; default/hover/focus/HSB/Paragraph/Graphics exact; 15-asset rebuild; 167 tests |
| UPG-054o | Shared/private HSB boundary | Complete | nine shared 12 px-thumb ranges + three private Pizza 8 px-thumb ranges; gradients, HEX/output, docking and restore verified; 36 framework + 167 Pizza tests |
| UPG-054p | Dither private + Sticky zero-range boundary | Complete | Dither keeps 10 ordinary + 3 HSB raster-safe ranges with 10 px thumb/private timing; Sticky keeps 0 ranges + 40 native numbers; 11 + 5 tests |
| UPG-054q | Range component gate | Complete | `check:ranges` enforces 97 shared ordinary + 9 shared HSB + 16 private = 122 and Sticky 0; full Gate G4, isolation and all app suites pass |
| UPG-054r | Toggle/segmented compatibility matrix | Complete | 77 checkbox + 37 radio = 114 native controls; seven presentation families, private variants and UPG-054s–y rollout fixed; production unchanged |
| UPG-054s | Toggle contract gate + direct shared verification | Complete | `check:toggles` gates 114 native controls and family ownership; Sparky desktop/mobile, Keyboarder and Wordplayer checked/restored; production unchanged |
| UPG-054t | Pulsar shared checkbox/segmented canary | Complete | shared 33×18 checkbox base + segmented font token; scoped `revert-layer`/0.85rem bridge; exact screenshot/state/panels/22 fields/40,180-char SVG; 8 tests |
| UPG-054u | Wander Bender shared segmented rollout | Complete | one 3-radio segment uses shared presentation through scoped `revert-layer`/0.85rem bridge; byte-identical screenshot and 48-control state; three SVG modes and private Auto/Max exact; 10 tests |
| UPG-054v | Pizza Boxer shared choice rollout | Complete | 15 chips, 7 checkbox-label, 4 segments and 1 switch use shared presentation; exact default screenshot/113 fields/components/SVG, Paragraph/Graphics state and round-trips; 15-asset rebuild; 167 tests |
| UPG-054w | Sticky Fingers shared choice rollout | Complete | 9 chips, 10 checkbox-label, 2 segments and 3 switches use shared presentation; exact normal/edit state, component styles, panels and SVG; focus/round-trip accepted; 5 tests + Gate G4 |
| UPG-054x | Dither raster-safe shared choice rollout | Complete | 2 checkbox-label + 1 segment use shared presentation; scoped 1/1/2 px + gap bridge; 4 export checks stay private; 0 changed Canvas RGB channels in default/Bayer/Pixel4; 11 tests + Gate G4 |
| UPG-054y | Toggle component gate | Complete | `check:toggles` fixes 114 native controls, final shared/private ownership, 6 private inputs and 8 private state buttons; isolation/all app suites/Gate G4 pass |
| UPG-055a | Preset toolbar compatibility matrix | Complete | six active dropdowns; 5+10+1+19+3 shipped manifest presets and 4 inline Pulsar presets; four data families, rollback rules and UPG-055b–f fixed; production unchanged |
| UPG-055b | Preset contract + direct shared verification | Complete | `check:presets` gates 6 dropdowns/38 selectable manifest presets/4 inline presets and data ownership; Sparky/Keyboarder exact restore, Wordplayer 0 changed Canvas RGB channels; production unchanged |
| UPG-055c | Pulsar shared preset presentation canary | Complete | fixed four-item menu uses shared skin + exact font/padding/overflow bridges; closed/open styles, 22 fields/panels and initial/Accurate/Voyager SVG states exact; ARIA-only semantics added |
| UPG-055d | Sticky Fingers shared preset presentation | Complete | manifest-only dropdown uses shared skin + exact sizing/scroll bridges; closed/open byte-exact, three presets and normal/edit state/SVG exact; Sheets boundary retained |
| UPG-055e | Pizza Boxer shared preset presentation | Complete | repository dropdown uses shared skin + exact sizing/scroll bridges; New/E-ink round-trips, 113 form states/panels/SVG and closed/open styles exact; schema/import/history/draft private; 15-asset rebuild; 167 tests |
| UPG-055f | Preset component gate | Complete | final shared/private ownership and bridge removal conditions recorded; six dropdowns/38 selectable manifest presets/4 inline presets; isolation and all eight app suites pass through Gate G4 |
| UPG-056a | Action/export compatibility matrix | Complete | 8 bars; 31 btn-fixed + 2 special buttons + 9 labels; format/state/CSS ownership, rollout and rollback fixed; production unchanged |
| UPG-056b | Action contract + direct shared verification | Complete | check:actions gates 42 controls and 8 private pipelines; all bars explicitly named toolbars; five ARIA-only captures have 0 changed RGB; Sparky cancel no longer logs AbortError; desktop/mobile/direct suites pass |
| UPG-056c | Wander shared action canary | Complete | one button uses canonical shared bar/button; intentional Arial 14.4/600→CoFo 16/500 and 110.016→124.914 px; raster diff button-only; panel/41 fields/three SVG modes exact; 10 tests |
| UPG-056d | Pulsar shared action rollout | Complete | three buttons use canonical shared bar/button; intentional 14.4/600→16/500 and 8×15→8×20 px; raster diff action-only; Verify/Copy, 22 fields/panels and exact 40,180-char SVG retained; 8 tests |
| UPG-056e | Pizza Boxer shared action adapter | Complete | four buttons use shared shell with private muted/PDF/group variants; 640×36 bar retained; JSON/SVG/PDF actions and New/E-ink exact states/SVG pass; 15-asset rebuild; 167 tests |
| UPG-056f | Sticky Fingers shared action adapter | Complete | six buttons use shared shell with private muted/group/mode/data variants; normal/edit, Outline/Prepress, preset/SVG/PDF and exact 79-state/SVG baselines pass; Sheets boundary retained; 5 tests |
| UPG-056g | Dither raster-safe action boundary | Complete | shared fixed-button shell with private left anchor/remove/export labels; default/Bayer/Pixel Size 4 Canvas has 0 changed pixels; alpha, ×2/×4/×8, PNG and disabled/no-image pass; 11 tests |
| UPG-056h | Action component gate | Complete | all 8 bars use shared shell; Dither anchor and app domain variants documented; Sparky progress remains private; all suites, isolation and full Gate G4 pass |
| UPG-057a | Dialog/tooltip/error/toast compatibility matrix | Complete | 3 native dialogs, 2 active overlays + 2 dormant fragments, 1 popup, 47 tooltip hosts and feedback families inventoried; selector collision and rollout/rollback fixed; production unchanged |
| UPG-057b | Feedback contract gate | Complete | `check:feedback` fixes dialog/overlay/popup/tooltip/blocking-call counts and shared/private ownership; included in Gate G4 before production rollout |
| UPG-057c | Scoped modal CSS + native DialogHost hardening | Complete | overlay/native content shells isolated with exact Keyboarder geometry; native cancel/close/replacement/focus/destroy covered; 3 labelled dialogs; 38 framework tests and full Gate G4 pass |
| UPG-057d | Keyboard-accessible TooltipService | Complete | 47 hosts gain focus/Escape/role/description lifecycle; pointer geometry/styles exact in Sparky, Keyboarder and Wordplayer; dynamic/disabled/cleanup tested; 39 framework tests + Gate G4 pass |
| UPG-057e | Dither shared OverlayDialogHost canary | Complete | exact 600×483.523 overlay geometry; shared Escape/backdrop/Tab/focus/ARIA/scroll lifecycle; default/Bayer/Pixel Size 4 states and pixels exact; 41 framework tests + Gate G4 pass |
| UPG-057f | Pulsar overlay rollout + dormant proof | Complete | Verify keeps exact rich failure HTML, 600×272.820 shell and `97155e5a…` SVG; shared focus/Tab/Escape/backdrop/ARIA/scroll; Pizza has no trigger/controller and Sticky no trigger; 42 framework tests + Gate G4 pass |
| UPG-057g | Feedback accessibility + blocking-call migration | Complete | Sticky live status is polite/assertive by severity; Sticky, Pulsar and Wander use shared DialogHost without changing domain text; 6 native dialogs and 0 primary blocking calls; closed presentation/domain state exact; 42 framework tests + Gate G4 pass |
| UPG-057h | Feedback component gate | Complete | final shared/private ownership and dormant-fragment removal rules recorded; all 8 entrypoints complete with closed surfaces and 0 browser errors; 6 dialogs/2 overlays/47 tooltips/0 blocking calls; isolation + full Gate G4 pass |
| UPG-058a | Legacy CSS/orphan inventory gate | Complete | 5 frozen resets, 17 initial promotions, 2 dormant overlays, 3 broad native-dialog collisions and Wander overlay-only family classified; machine checker added to Gate G4; production unchanged |
| UPG-058b | Wander legacy modal canary | Complete | markup-less overlay/close/body and broad content CSS removed; canonical native shell promoted through frozen reset; closed screenshot, 41 fields, panel and SVG exact; 10 tests + Gate G4 pass |
| UPG-058c | Pizza Boxer orphan Help removal | Complete | help slot/loader/fragment and modal-only CSS removed; public runtime 15→14 assets; 113 fields/panels and New/E-ink/New SVG exact; private error/recovery retained; 167 tests + Gate G4 pass |
| UPG-058d | Sticky Fingers dormant Help removal | Complete | orphan markup/controller/modal CSS removed; canonical native shell promoted; normal/edit screenshots, 79 fields, panels and SVG exact; Sheets/EAN retained; 5 tests + Gate G4 pass |
| UPG-058e | Active Dither/Pulsar overlay CSS reduction | Complete | shared structural shells/headings with scoped private deltas; Dither closed/open exact; Pulsar Verify/CRC/Copy/SVG exact and native feedback canonical; 21 temporary promotions, 0 dormant/collisions; Gate G4 pass |
| UPG-058f | Universal reset/promotion removal | Complete | five local universal resets and 21 temporary `all: revert-layer` promotions reduced to 0/0; Wander, Sticky, Pizza, Dither and Pulsar retain exact active geometry/state/output through narrow property bridges; all app suites and isolation pass |
| UPG-058g | Legacy CSS cleanup gate | Complete | every remaining app delta has owner/reason/removal condition; 8/8 live entrypoints complete with visible output and 0 browser errors; Pizza source/public 14-asset runtime, isolation and full Gate G4 pass |
| UPG-059 | Gate G5 | Complete | `gate:g5:static` passes: 8 hub links, 8 shared CSS + 8 shared JS boundaries, 0 resets/promotions, owned app deltas, accepted Sparky desktop/390×844/430×932, full G4/isolation/app suites |
| UPG-060 | Общий PanelShell/summary и Dither panel redesign | Complete | 2 native collapse buttons; app summaries; shared clamp/stack/header; clean browser smoke; exact G5/G6 SHA-256 for Default/Bayer/Pixel4; Gate G5 pass |
| UPG-061 | Трёхслотовый ActionDock | Complete | all 8 consumers use shared slots and pass static/domain/browser acceptance; Sparky mobile reaccepted; Dither default/Bayer/Pixel4 raw-RGBA hashes exact |
| UPG-062 | FileIntake | Complete | 14/14 surfaces in six tools use the shared controller; 0 added to Wander/Pulsar; 6 component tests + machine contract; private parsers/history and Sticky Sheets retained; Wordplayer/Pizza/Sparky/Dither browser probes, Sparky mobile and Dither hashes pass; full Gate G5 green |

## Подтверждённые исходные результаты

| Проект | Результат |
|---|---|
| Shared framework | 49/49 tests pass; range, toggle, preset, action, feedback and FileIntake contracts pass |
| Pizza Boxer top-level | 169/169 tests pass; source/public 14-asset runtime checks pass |
| Pizza Boxer `v2` donor | 221/222; один failure в Node test mock без `requestAnimationFrame` |
| Sparky | 196/196 tests pass (195 исходных + shared-framework boundary) |
| Wordplayer | Shared-framework boundary, Dither worker и Forms worker tests pass |
| Keyboarder | Boundary + 5 domain suites; SVG text/outline и editable PDF browser export pass |
| Sticky Fingers | 5/5 boundary/domain tests; manifest presets, Google Sheets and local-font PDF browser acceptance pass |
| Pulsar Coder | 8/8 boundary/codec tests; exact 1280×720 SVG/panel/input parity and SVG export pass |
| Dither | 11/11 boundary/algorithm tests; byte-identical default, Bayer and Pixel Size 4 browser captures |
| Wander Bender | 10/10 boundary/mode tests; exact three-mode canvas/panel parity plus Rays, collapse and extraction browser acceptance |

## Известные исходные особенности

- Sticky Fingers выводит checksum warning EAN-13 на текущих данных.
- Pulsar Coder до и после миграции не может проверить собственный Voyager-код: encoder делит поток на последовательные ray chunks, а verifier собирает его interleave-порядком, поэтому CRC не совпадает.
- Dither имеет вертикальный scroll на desktop baseline и непригодный mobile overflow.
- Большинство инструментов, кроме Sparky, не имеют согласованного mobile layout.
- Основной исходный Wander Bender загружает Paper.js с CDN; Upgrade использует локальный shared vendor.
- Исходный Sticky Fingers загружал PDF/OpenType зависимости с CDN; Upgrade использует локальный framework vendor и оставляет Google Sheets единственным пользовательским внешним runtime.
- Исходный framework v3 содержит remote font/export URL; рабочий `upgrade/framework` полностью локализован.
- Исходный Pizza Boxer использует IndexedDB `lunnen-grid-generator`; копия Upgrade изолирована как `upgrade-pizza-boxer-v1`.
- v3-инструменты используют исходные localStorage namespaces без `upgrade:`.

## Gate G0 evidence

```text
SOURCE_MANIFEST.json matches the selected source trees.
Gate G0 passed: 1179 source entries, 10 screenshots, architecture and test baselines present.
```

## Следующее действие

План UPG-000—UPG-062 выполнен. FileIntake раскатан на 14 file surfaces в шести
инструментах без переноса private parser/schema/history/render logic во
framework; Sticky Google Sheets сохранён отдельно. Новый `check:file-intake`
включён в Gate G5, все app suites и браузерные проверки проходят. Работа
намеренно остановлена: UPG-063 не начат.
