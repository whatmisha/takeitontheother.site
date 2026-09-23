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

### UPG-061 — единый центрированный ActionDock

- статус: **Complete** (2026-09-02);
- единая viewport-centered группа всех нижних действий;
- semantic utility/primary/options slots внутри одной визуальной группы;
- общие primary/secondary/utility/muted/danger/icon variants;
- canary Wander, затем Pulsar и Wordplayer;
- Keyboarder, Pizza, Sticky и Sparky после canary;
- Dither отдельно после переноса source actions из export dock.

Текущий rollout: общий CSS/controller contract добавлен в framework; все восемь
инструментов переведены на одну центрированную группу utility/primary/options, проходят свои
static/domain suites и приняты в браузере на desktop. Для Wordplayer проверены
Dither и Forms, для Sticky — normal/edit, для Dither — unloaded, default,
Bayer, Pixel Size 4 и collapse-summary. Sticky сохраняет mode/data visibility
и Sheets boundary; Sparky сохраняет private progress/cancel. На mobile остаются
видимыми основные PNG/SVG actions, а вспомогательная группа скрывается.
Dither сохраняет различие source actions, PNG и raster options внутри общей группы,
сохраняя private overlay-order extension. Sparky повторно принят через локальный
viewport-harness на 390×844 и 430×932: document и SVG равны viewport без
горизонтального overflow, mobile hint и основные export actions видимы, desktop
panels/top links скрыты. Повторный raw-RGBA proof Dither выполнен отдельно: скриншот не
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
`check:file-intake` и полный Gate G5 проходят.

### UPG-063 — navigation, zoom, choice semantics

- статус: **Complete** (2026-09-02);
- Dither `←Upgrade Tools` и общий navigation contract;
- clickable zoom indicators становятся buttons;
- Dither export scale становится `1×/2×/4×/8×` radio segment;
- state buttons получают synchronized `aria-pressed`;
- shared preset keyboard interaction без объединения preset data models.

Принято: Dither удалил private `.yf-tools-link` и использует общий `top-links` /
`top-link`; пять существующих zoom indicators являются нативными buttons.
Масштаб PNG Dither представлен одной radio-группой `1×/2×/4×/8×`, при этом
старые export flags и raster pipeline сохранены. Все восемь private state buttons
синхронизируют `aria-pressed`. Шесть инструментов с preset dropdown используют
`PresetMenuKeyboardController` для Arrow Up/Down, Home/End, Enter/Space и Escape;
данные, render, selection callbacks и storage остаются у приложений. Новый
`check:choices`, 55/55 framework tests, 169/169 Pizza tests и browser smoke проходят.

### UPG-064 — optional framework surface

- статус: **Complete** (2026-09-02);
- capability-driven construction вместо безусловного controller init;
- реальный consumer + tests для `RangeSliderController`/`DicePanel`, либо
  перенос в optional/experimental surface;
- machine-readable app capability manifest;
- Component Lab для normal/hover/focus/disabled/loading/error states.

Первый срез принят: `APPLICATION_CAPABILITIES.json` фиксирует восемь entrypoints,
пять приоритетных инструментов, единственный обязательный mobile consumer,
14 FileIntake surfaces, шесть preset keyboards и пять zoom buttons. Неиспользуемые
`RangeSliderController` и `DicePanel` вынесены из стабильного public barrel в
`framework/src/experimental.js`; активных consumers у них нет. Новый
`check:capabilities` включён в Gate G5. `ApplicationShell` теперь вычисляет
capabilities до создания optional subsystems, а пустая конфигурация не создаёт
panel/tooltip/dialog/export/history/shortcut controllers. Локальная Component Lab
фиксирует normal/hover/focus/disabled/loading/error для action, choice, FileIntake
и PanelShell; `check:component-lab` также включён в gate.

## Intentional visual diffs G6 относительно G5

1. Все нижние utility/export/options собраны в одну центрированную ActionDock;
   JSON actions скрыты до `J`, основной экспорт — `⌘E`, JSON export — `⌘J`.
2. Sparky показывает primary export actions на mobile, сохраняя скрытыми utility
   actions, panels и top navigation.
3. Dither использует общий `←Upgrade Tools`, collapse headers, общий help action,
   toggle прозрачности и radio segment `1×/2×/4×/8×`.
4. Pizza Boxer PDF action не имеет обводки; подписи экспортов сокращены и содержат
   канонические shortcuts.
5. Zoom indicators Keyboarder и Wordplayer стали нативными buttons без изменения
   layout; state buttons получили доступный pressed state.
6. Wordplayer получил drop intake для raster/Forms; остальные FileIntake changes
   сохраняют private parsers и существующую прикладную семантику.

### UPG-069 — Gate G6

- статус: **Complete** (2026-09-02);
- все восемь entrypoints загружаются без ошибок;
- isolation/storage/network checks зелёные;
- app suites и output invariants зелёные;
- Dither Canvas diff равен нулю;
- Sparky desktop + 390×844 + 430×932 приняты;
- все intentional visual diffs перечислены отдельно от G5.

## Текущий срез

UPG-060—UPG-063 завершены. Все восемь consumers используют общий ActionDock,
проходят static/domain gate и приняты на desktop. Чистый browser smoke не
выявил новых warning/error; остаётся только известный Sticky EAN-13 checksum
warning. Sparky повторно принят на 390×844 и 430×932, а Dither — по raw-RGBA
SHA-256 для default, Bayer и Pixel Size 4 через локальный viewport-harness.
UPG-062 завершён: 14/14 file surfaces используют общий FileIntake, private
domain callbacks сохранены, Pizza runtime воспроизводим, Sparky mobile и Dither
raw-RGBA эталоны повторно приняты. `check:file-intake` включён в Gate G5 и все
static/domain/browser проверки зелёные. UPG-063 унифицировал navigation, zoom,
choice semantics и клавиатуру preset menus без изменения app data models.
UPG-064 завершён: capability manifest, optional barrel, условное создание
подсистем `ApplicationShell` и Component Lab готовы. UPG-069 завершён: полный
`gate:g6:static` проходит, intentional diffs и browser/isolation evidence
зафиксированы. План G6 выполнен.
