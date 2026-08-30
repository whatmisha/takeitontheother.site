# Migration Status

Последнее обновление: 2026-08-30.

## Gates

| Gate | Содержание | Статус |
|---|---|---|
| G0 | Документы, source manifest, test/visual/runtime baselines | Passed |
| G1 | Восемь автономных копий, paths/storage/network isolation | Passed |
| G2 | Общий framework и conformance suite | Passed |
| G3 | Wordplayer, Keyboarder, Sparky, Pizza Boxer, Sticky Fingers | In progress (Wordplayer + Keyboarder + Sparky complete) |
| G4 | Pulsar Coder, Dither, Wander Bender | Not started |
| G5 | Последующая визуальная и API-унификация | Not started |

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

## Подтверждённые исходные результаты

| Проект | Результат |
|---|---|
| Pizza Boxer top-level | 165/165 tests pass; source/public runtime checks pass |
| Pizza Boxer `v2` donor | 221/222; один failure в Node test mock без `requestAnimationFrame` |
| Sparky | 196/196 tests pass (195 исходных + shared-framework boundary) |
| Wordplayer | Shared-framework boundary, Dither worker и Forms worker tests pass |
| Keyboarder | Boundary + 5 domain suites; SVG text/outline и editable PDF browser export pass |
| Остальные | Формального полного test suite нет; требуется manual/browser baseline |

## Известные исходные особенности

- Sticky Fingers выводит checksum warning EAN-13 на текущих данных.
- Dither имеет вертикальный scroll на desktop baseline и непригодный mobile overflow.
- Большинство инструментов, кроме Sparky, не имеют согласованного mobile layout.
- Основной Wander Bender загружает Paper.js с CDN.
- Sticky Fingers загружает PDF/OpenType зависимости с CDN и использует Google Sheets.
- Исходный framework v3 содержит remote font/export URL; рабочий `upgrade/framework` полностью локализован.
- Pizza Boxer использует IndexedDB `lunnen-grid-generator`.
- v3-инструменты используют исходные localStorage namespaces без `upgrade:`.

## Gate G0 evidence

```text
SOURCE_MANIFEST.json matches the selected source trees.
Gate G0 passed: 1179 source entries, 10 screenshots, architecture and test baselines present.
```

## Следующее действие

UPG-033: подключить Pizza Boxer через тонкий React/framework adapter, не меняя geometry/domain components, IndexedDB schema и публичный production runtime.
