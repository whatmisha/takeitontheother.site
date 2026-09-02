# Gate G6 — intentional interface unification

Дата начала: 2026-09-01.

Gate G5 завершил безопасное объединение общего framework без изменения
продуктового поведения. Gate G6 разрешает заранее перечисленные изменения
интерфейса, если алгоритмы, документы, storage, network boundary и export
остаются неизменными.

## Неподвижные границы

1. Изменяются только файлы внутри `upgrade/`.
2. Sparky остаётся главным приоритетом и единственным обязательным mobile tool.
3. Pizza Boxer, Sticky Fingers, Keyboarder и Wordplayer — следующий приоритет.
4. Google Sheets в Sticky Fingers сохраняется как user-initiated private flow.
5. Общий component shell не получает app parser, schema, history или renderer.
6. Любой Dither layout diff принимается только при нулевом изменении Canvas.
7. Старые G5 baselines не перезаписываются: G6 хранит отдельные intentional diffs.

## Целевая граница

Framework владеет presentation, focus/hover/disabled/busy, collapse/drag,
action placement, file-picker/dropzone shell и accessibility. Приложение
владеет значениями, текстами summary, parsing, validation decisions, history,
rendering, export и mode/editor lifecycle.

## Задачи

### UPG-060 — PanelShell и Dither panel redesign

- статус: **Complete** (2026-09-02);
- добавить нейтральный `PanelManager` summary API;
- не начинать drag с collapse control;
- перевести Dither с private unbounded/z-index adapter на общий manager;
- заменить `⋮⋮` на нативные collapse buttons;
- показать app-provided summary только в collapsed state;
- принять общий panel header/shell/scrollbar;
- проверить clamp, stacking, click/Enter/Space, ARIA и Canvas pixels.

Принято: Dither использует общий shell/header/scrollbar, две нативные collapse
buttons и app-owned summary. Чистый browser smoke не имеет warning/error.
SHA-256 сырых `579×600` RGBA-пикселей совпадает с G5 для Default, Bayer и
Pixel Size 4 (`1b4c210c…`, `9f8f96ab…`, `f93c0e2a…`). Полный
`gate:g5:static` проходит.

### UPG-061 — трехслотовый ActionDock

- статус: **Next**;
- viewport-centered primary export slot;
- независимые utility и export-option slots;
- общие primary/secondary/utility/muted/danger/icon variants;
- canary Wander, затем Pulsar и Wordplayer;
- Keyboarder, Pizza, Sticky и Sparky после canary;
- Dither отдельно после переноса source actions из export dock.

### UPG-062 — FileIntake

- общая accessible picker/dropzone оболочка;
- accept/help/status/replace/remove/loading/error;
- одинаковый повторный выбор того же файла;
- configurable size/type guards и app parser callbacks;
- canary Wordplayer, затем Pizza, Sticky, Keyboarder, Sparky и Dither;
- Google Sheets не входит в FileIntake.

### UPG-063 — navigation, zoom, choice semantics

- Dither `←Upgrade Tools` и общий navigation contract;
- clickable zoom indicators становятся buttons;
- Dither export scale становится `1×/2×/4×/8×` radio segment;
- state buttons получают synchronized `aria-pressed`;
- shared preset keyboard interaction без объединения preset data models.

### UPG-064 — optional framework surface

- capability-driven construction вместо безусловного controller init;
- реальный consumer + tests для `RangeSliderController`/`DicePanel`, либо
  перенос в optional/experimental surface;
- machine-readable app capability manifest;
- Component Lab для normal/hover/focus/disabled/loading/error states.

### UPG-069 — Gate G6

- все восемь entrypoints загружаются без ошибок;
- isolation/storage/network checks зелёные;
- app suites и output invariants зелёные;
- Dither Canvas diff равен нулю;
- Sparky desktop + 390×844 + 430×932 приняты;
- все intentional visual diffs перечислены отдельно от G5.

## Текущий срез

UPG-060 завершён без изменения Canvas algorithms, source image lifecycle,
raster cache, modal, bottom actions или PNG export. Следующий шаг — UPG-061:
сначала contract и canary Wander, затем Pulsar и Wordplayer; Dither переносится
только после отделения source actions от export dock.
