# Gate G2 evidence

Дата проверки: 2026-08-30.

## Результат

Gate G2 пройден. Общий framework создан как автономная рабочая версия поверх immutable snapshot v3, дополнен проверенными возможностями Keyboarder, Sparky и Void и пока не подключён ни к одному из восьми production-copy инструментов.

## Происхождение

- `framework/upstream-v3` содержит 50 неизменённых файлов v3.
- `framework/UPSTREAM_V3.json` фиксирует 15 изменённых рабочих файлов из исходного набора.
- Новые нейтральные модули и conformance tests находятся только в `framework`.
- `framework/css/othersite-styles.css` побайтно совпадает с активным `styles.css` Void после единственной допустимой трансформации: четыре remote CoFo Sans URL заменены на `../fonts/**`.
- SHA-256 и правило CSS-трансформации записаны в `framework/CSS_PROVENANCE.json`.

## Перенесённые возможности

Keyboarder:

- same-origin lazy jsPDF/svg2pdf/OpenType loaders без дублирующихся запросов;
- XML-safe SVG, editable/outlined PDF, embedded fonts и variable-font preservation;
- suggested preset name и ограниченный по времени seed fetch.

Sparky:

- preset migration/force seed hooks;
- shortcut `space`, non-interactive zoom и fit по логическому артборду;
- `data-export-exclude`, transient slider display и collapse/restore панелей.

Void:

- исходный `HistoryManager` уже совпадал с v3 побайтно;
- per-preset history, temporary Shared/New slots и unsaved guard уже были обобщены в v3;
- добавлены `SeededRandom`, clean-seeded short URL/full dirty URL, `ExportGuard` и opt-in `MobileBootstrap`.

Void-specific glyph/domain code, мобильная разметка, аналитика и внешние ссылки не переносились.

## Conformance

`npm run test:framework`: 34/34 pass. Набор покрывает public API, SVG/Canvas, settings/controls, deterministic RNG, history, preset session/storage/migrations, short/full share, export guard/exclusions/font embedding, zoom/pan, panels, mobile capability, listener disposal, CSS provenance/order и локальность dependency graph.

Browser demos:

| Demo | Результат | Console warnings/errors |
|---|---|---:|
| SVG Pattern Studio | title корректен, SVG tree отрисован | 0 |
| Canvas Studio | canvas видим, backing size 2560×1440, два controls | 0 |

Оба demo импортируют `framework/src/index.js`; application stylesheet подключён после framework stylesheet.

## Полный статический gate

```text
SOURCE_MANIFEST.json matches the selected source trees.
Gate G0 passed: 1179 source entries, 10 screenshots.
Verified 11 shared assets and 3 pinned downloads.
Framework v3 provenance passed: 50 immutable files, 15 working modifications.
Storage isolation passed: 9 runtime files and 8 original sentinels checked.
Boundary check passed: 549 runtime text files, 9 entrypoints, 7 internal dependency symlinks.
Framework: 34/34 pass.
Sparky: 195/195 pass.
Pizza Boxer: 165/165 pass; source/public runtime match.
Wordplayer worker suites: pass.
```

Команда: `npm run gate:g2:static`.

## Следующая граница

Gate G3 начинается с Wordplayer как Canvas-canary, затем Keyboarder как SVG/export-canary и только после их паритета — protected migration Sparky. До индивидуального acceptance каждый инструмент продолжает использовать собственную изолированную framework-копию.
