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

- статус: **Complete** (2026-09-02);
- viewport-centered primary export slot;
- независимые utility и export-option slots;
- общие primary/secondary/utility/muted/danger/icon variants;
- canary Wander, затем Pulsar и Wordplayer;
- Keyboarder, Pizza, Sticky и Sparky после canary;
- Dither отдельно после переноса source actions из export dock.

Текущий rollout: общий CSS-only contract добавлен в framework; все восемь
инструментов переведены на utility/primary/options slots, проходят свои
static/domain suites и приняты в браузере на desktop. Для Wordplayer проверены
Dither и Forms, для Sticky — normal/edit, для Dither — unloaded, default,
Bayer, Pixel Size 4 и collapse-summary. Sticky сохраняет mode/data visibility
и Sheets boundary; Sparky сохраняет private progress/cancel и mobile hide rule.
Dither отделяет source actions от центрального PNG и правых raster options,
сохраняя private overlay-order extension. Sparky повторно принят через локальный
viewport-harness на 390×844 и 430×932: document и SVG равны viewport без
горизонтального overflow, mobile hint видим, desktop panels/top links/ActionDock
скрыты. Повторный raw-RGBA proof Dither выполнен отдельно: скриншот не
использовался как его замена.

Финальная Dither-проверка выполнена в same-origin viewport-harness при
1280×860. Сырые `579×600` RGBA-хеши совпали с сохранёнными эталонами:
default/FS/Pixel 1 — `1b4c210c87d08f9b628d8f1fd8c146b3258544c82c1bef41822f4178abc7ff9e`,
Bayer/Pixel 1 — `9f8f96ab4f5f184a1e89f824a661ccd74c9794d135e7a56e52222d69083d4ce1`,
FS/Pixel 4 — `f93c0e2a0e8402df5182b479935ba7223dbc2d6212c21114061e12a8b3ef75df`.
UPG-061 завершён.

### UPG-062 — FileIntake

- статус: **Complete** (2026-09-02);
- общая accessible picker/dropzone оболочка;
- accept/help/status/replace/remove/loading/error;
- одинаковый повторный выбор того же файла;
- configurable size/type guards и app parser callbacks;
- canary Wordplayer, затем Pizza, Sticky, Keyboarder, Sparky и Dither;
- Google Sheets не входит в FileIntake.

Инвентарь и результат зафиксированы в `FILE_INTAKE_COMPATIBILITY_MATRIX.md`: все
14 file surfaces в Wordplayer, Pizza, Sticky, Keyboarder, Sparky и Dither
используют общий controller; Wander и Pulsar не получили лишних inputs. Шесть
component tests фиксируют type/size guards, state/ARIA, drop/keyboard, same-file
reset, nested input guard и multi-file selection. Private decode, parsers,
sanitizers, schemas, confirmation, history и render/export pipelines остались в
приложениях; Sticky Google Sheets не менялся. Wordplayer, Pizza, Sparky и Dither
приняты end-to-end browser probes, все шесть consumers — live semantics smoke.
`check:file-intake` и полный Gate G5 проходят. UPG-063 не начат.

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

UPG-060 и UPG-061 завершены. Все восемь consumers используют общий ActionDock,
проходят static/domain gate и приняты на desktop. Чистый browser smoke не
выявил новых warning/error; остаётся только известный Sticky EAN-13 checksum
warning. Sparky повторно принят на 390×844 и 430×932, а Dither — по raw-RGBA
SHA-256 для default, Bayer и Pixel Size 4 через локальный viewport-harness.
UPG-062 завершён: 14/14 file surfaces используют общий FileIntake, private
domain callbacks сохранены, Pizza runtime воспроизводим, Sparky mobile и Dither
raw-RGBA эталоны повторно приняты. `check:file-intake` включён в Gate G5 и все
static/domain/browser проверки зелёные. Работа намеренно остановлена перед
UPG-063.
