# Migration Status

Последнее обновление: 2026-08-30.

## Gates

| Gate | Содержание | Статус |
|---|---|---|
| G0 | Документы, source manifest, test/visual/runtime baselines | Passed |
| G1 | Восемь автономных копий, paths/storage/network isolation | Passed |
| G2 | Общий framework и conformance suite | Not started |
| G3 | Wordplayer, Keyboarder, Sparky, Pizza Boxer, Sticky Fingers | Not started |
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
| UPG-013 | Local vendor/fonts | Complete | 11 copied assets + 3 pinned downloads |
| UPG-014 | Storage isolation | Complete | 6 original sentinel keys неизменны |
| UPG-015 | Boundary scanner | Complete | `npm run check:isolation` |

## Подтверждённые исходные результаты

| Проект | Результат |
|---|---|
| Pizza Boxer top-level | 165/165 tests pass; source/public runtime checks pass |
| Pizza Boxer `v2` donor | 221/222; один failure в Node test mock без `requestAnimationFrame` |
| Sparky | 195/195 tests pass |
| Wordplayer | Dither worker и Forms worker tests pass |
| Остальные | Формального полного test suite нет; требуется manual/browser baseline |

## Известные исходные особенности

- Sticky Fingers выводит checksum warning EAN-13 на текущих данных.
- Dither имеет вертикальный scroll на desktop baseline и непригодный mobile overflow.
- Большинство инструментов, кроме Sparky, не имеют согласованного mobile layout.
- Основной Wander Bender загружает Paper.js с CDN.
- Sticky Fingers загружает PDF/OpenType зависимости с CDN и использует Google Sheets.
- Framework v3 содержит remote font и export-library URL.
- Pizza Boxer использует IndexedDB `lunnen-grid-generator`.
- v3-инструменты используют исходные localStorage namespaces без `upgrade:`.

## Gate G0 evidence

```text
SOURCE_MANIFEST.json matches the selected source trees.
Gate G0 passed: 1179 source entries, 10 screenshots, architecture and test baselines present.
```

## Следующее действие

UPG-020: перенести Othersite UI Framework v3 в `framework/src` и `framework/css`, затем создать conformance suite. До Gate G2 приложения продолжают работать со своими изолированными framework-копиями.
