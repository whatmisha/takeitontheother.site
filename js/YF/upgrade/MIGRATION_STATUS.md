# Migration Status

Последнее обновление: 2026-08-31.

## Gates

| Gate | Содержание | Статус |
|---|---|---|
| G0 | Документы, source manifest, test/visual/runtime baselines | Passed |
| G1 | Восемь автономных копий, paths/storage/network isolation | Passed |
| G2 | Общий framework и conformance suite | Passed |
| G3 | Wordplayer, Keyboarder, Sparky, Pizza Boxer, Sticky Fingers | Passed |
| G4 | Pulsar Coder, Dither, Wander Bender | Passed |
| G5 | Последующая визуальная и API-унификация | In progress |

## Задачи

| ID | Результат | Статус | Проверка |
|---|---|---|---|
| UPG-000 | Основные документы | Complete | Документы согласованы между собой |
| UPG-001 | `SOURCE_MANIFEST.json` | Complete | `npm run manifest:check` |
| UPG-002 | Test baselines | Complete | Команды и результаты записаны |
| UPG-003 | Visual/runtime baselines | Complete | 8 desktop + 2 Sparky mobile captures |
| UPG-010 | Чистое копирование | Complete | 915 файлов сверены до relocation-правок |
| UPG-011 | Relocation paths | Complete | Browser smoke + boundary scan |
| UPG-012 | Upgrade index | Complete | Восемь относительных ссылок |
| UPG-013 | Local vendor/fonts | Complete | 5 source-backed + 6 canonical assets + 3 pinned downloads |
| UPG-014 | Storage isolation | Complete | 6 original sentinel keys неизменны |
| UPG-015 | Boundary scanner | Complete | `npm run check:isolation` |
| UPG-020 | v3 snapshot и working framework | Complete | 50 immutable / 15 modified upstream files |
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

## Подтверждённые исходные результаты

| Проект | Результат |
|---|---|
| Pizza Boxer top-level | 167/167 tests pass (165 original + JS/CSS boundary); source/public runtime checks pass |
| Pizza Boxer `v2` donor | 221/222; один failure в Node test mock без `requestAnimationFrame` |
| Sparky | 196/196 tests pass (195 исходных + shared-framework boundary) |
| Wordplayer | Shared-framework boundary, Dither worker и Forms worker tests pass |
| Keyboarder | Boundary + 5 domain suites; SVG text/outline и editable PDF browser export pass |
| Sticky Fingers | 5/5 boundary/domain tests; manifest presets, Google Sheets and local-font PDF browser acceptance pass |
| Pulsar Coder | 8/8 boundary/codec tests; exact 1280×720 SVG/panel/input parity and SVG export pass |
| Dither | 10/10 boundary/algorithm tests; byte-identical default, Bayer and Pixel Size 4 browser captures |
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

UPG-054j: составить отдельную compatibility matrix для 122 single-thumb ranges.
Разделить shared SliderController pairs, Pizza transaction/history controls,
Dither raster/cache, Wander Auto/Max disabled, Sticky native-number companions
и HSB gradients. В этой подзадаче не менять runtime/CSS: выбрать первый
presentation-only canary, зафиксировать thumb/track/focus/disabled states,
mouse/keyboard lifecycle и rollback criteria для SVG/Canvas/export.
