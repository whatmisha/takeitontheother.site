# Toggle and Segmented Controls Compatibility Matrix

Дата аудита: 2026-08-31.

## 1. Цель и границы

Этот документ фиксирует toggle/segmented contract до следующего шага G5.
На этапе UPG-054r рабочие HTML, CSS и JavaScript восьми инструментов не
меняются. Матрица нужна, чтобы последующее удаление legacy CSS-дублей шло по
одному семейству и одному приложению, с точным rollback при любом неожиданном
изменении верстки или domain behavior.

Жёсткие границы:

- изменяется только автономная среда `upgrade`;
- исходные проекты Lunnen, общий YF index, `othersite-ui-framework` и Void не
  являются runtime-зависимостями и не меняются;
- controller/domain logic не переносится в CSS framework;
- checked state, keyboard focus, disabled/hidden state, persistence, SVG/Canvas
  output и export options должны сохраняться;
- Sparky проверяется на desktop, 390×844 и 430×932;
- Google Sheets flow Sticky Fingers сохраняется;
- Pizza public runtime после source-изменений собирается штатной командой и
  снова содержит ровно 15 проверяемых assets;
- Dither считается raster-sensitive: неожиданный full-page или canvas diff
  означает rollback, даже если DOM geometry кажется одинаковой.

Не входят в этот компонент: collapse headers, preset dropdowns, обычные action
buttons, typography unit selectors и row/style preset buttons. Их активные
состояния остаются private и будут рассматриваться в соответствующих задачах.

## 2. Полная инвентаризация DOM

Статически найдено 77 `input[type="checkbox"]` и 37
`input[type="radio"]`: всего 114 нативных choice controls. Сгенерированный
Pizza runtime в подсчёт второй раз не входит; source fragments являются
источником истины.

| Инструмент | Checkbox | Radio | Активные семейства | Дополнительные state buttons |
|---|---:|---:|---|---|
| Sparky | 4 | 5 | 4 checkbox + 2 radio `pill-toggle`; 3 radio `segmented-control` | `motionEditPathBtn`, `aria-pressed` |
| Pizza Boxer | 21 | 15 | 13 checkbox + 2 radio `toggle-chip`; 7 `checkbox-label`; 1 `toggle-switch`; 13 segmented radio | 2 surface lock buttons, runtime `aria-pressed` |
| Sticky Fingers | 22 | 6 | 9 `toggle-chip`; 10 `checkbox-label`; 3 `toggle-switch`; 6 segmented radio | нет в core family |
| Keyboarder | 12 | 0 | 11 `pill-toggle`; 1 `toggle-switch` | 3-button private compensation segment, `aria-pressed` |
| Wordplayer | 11 | 2 | 10 `pill-toggle`; 1 `toggle-switch`; 2 private mode-navigation radio | нет |
| Pulsar Coder | 1 | 3 | 1 `checkbox-label`; 3 segmented radio | нет |
| Dither | 6 | 3 | 2 `checkbox-label`; 4 private export checkbox; 3 segmented radio | нет |
| Wander Bender | 0 | 3 | 3 segmented radio | private `auto` и `max` buttons |
| **Итого** | **77** | **37** | **114 native controls** | **8 явно stateful buttons** |

### 2.1. Сводка по presentation family

| Семейство | Checkbox | Radio | Всего | Текущий presentation owner |
|---|---:|---:|---:|---|
| `pill-toggle` | 25 | 2 | 27 | shared framework |
| `toggle-chip` | 22 | 2 | 24 | shared framework; Pizza/Sticky оставляют только scoped bridges |
| `checkbox-label` 33×18 | 20 | 0 | 20 | shared framework; app controllers остаются private |
| `toggle-switch` 40×20 | 6 | 0 | 6 | shared framework; Sticky/Pizza сохраняют только соседние metrics |
| radio/label `segmented-control` | 0 | 31 | 31 | shared framework + scoped legacy font/layout tokens |
| Wordplayer `mode-nav-options` | 0 | 2 | 2 | Wordplayer |
| Dither `export-transparency-label` | 4 | 0 | 4 | Dither |
| **Итого** | **77** | **37** | **114** | — |

`Keyboarder #compModeGroup` использует три `<button>`, а не radio/label DOM.
Он намеренно не прибавляется к 114 native inputs.

## 3. Семейства и совместимость

### 3.1. Shared `pill-toggle`: уже канонический

Используют Sparky, Keyboarder и Wordplayer. Во всех трёх приложениях base
приходит из `framework/css/othersite-styles.css`; локальных копий компонента
нет. Keyboarder содержит только layout extension для распределения pills по
ширине и private `.is-disabled` bridge.

Shared contract:

- label содержит checkbox или radio и видимый `span`;
- checked state определяется через `:has(input:checked)`;
- hover и `focus-visible` принадлежат framework;
- disabled, `.controls-disabled`, `.inactive` и `.hidden` поддерживаются;
- application code владеет значением setting, зависимостями между settings и
  перерисовкой.

Особые границы:

- два Sparky pills `Manual`/`Follow cursor` — radio-like behavior поверх двух
  checkbox/radio state settings; их взаимная синхронизация остаётся в
  `tool.js`;
- `showMotionPath` динамически скрывается вне Path mode;
- Keyboarder advanced-only pills и private `.is-disabled` не обобщаются;
- Wordplayer dither/forms-only visibility остаётся private.

Вывод: production migration не нужна, требуется verification и boundary gate.

### 3.2. Shared `toggle-chip`: совместим после удаления дублей

Активен только в Pizza Boxer и Sticky Fingers. Shared и обе legacy копии имеют
одинаковые размеры, padding, цвета, checked/focus state и icon transitions.
Shared версия дополнительно задаёт `touch-action: manipulation` и отключает
tap highlight; это не меняет desktop geometry.

Два варианта DOM:

- checkbox chips: grid/surface/object visibility и OpenType features;
- radio chips: Pizza Graphics `Width`/`Height` size mode.

Icon state может определяться и `input:checked`, и JS-классом
`.toggle-chip-checked`; оба пути должны остаться. Surface-specific размеры
Pizza (`surface-*`) и inline `flex: 1` Graphics являются app-owned extensions.

Вывод: один общий component, rollout отдельно для Pizza и Sticky.

### 3.3. Shared `checkbox-label`: единый совместимый base

20 контролов в Pizza, Sticky, Pulsar и Dither используют один shared 33×18
switch с 14 px thumb и checked offset 17 px. Полные app-дубли удалены.

Совпадающий base:

- flex label, `padding: var(--spacing-sm) 0`;
- скрытый native checkbox внутри `.control-group`;
- pseudo-elements `::before`/`::after`;
- unchecked `#3a3a3a`, checked `#888`, white thumb;
- label text 0.85rem;
- hover opacity 0.9.

Различия:

- Pizza/Pulsar/Wander donor CSS содержит optional `.checkbox-icon` rules;
- Sticky и Dither не используют icon contract;
- отдельного keyboard focus ring и disabled skin в legacy component нет;
- selectors полагаются одновременно на старый sibling DOM и современный
  `label:has(input:checked)`.

Framework содержит ровно исходный совместимый base без новой focus/disabled
семантики. Accessibility enhancement остаётся отдельной задачей после parity.

### 3.4. Shared `toggle-switch`: совместим с текстовым bridge

Шесть export/edit toggles используют одинаковый 40×20 track, 14 px thumb и
20 px checked translation. Keyboarder и Wordplayer уже получают component из
framework. Pizza и Sticky сохраняют полные legacy дубли.

Единственное значимое отличие рядом с component: shared
`.toggle-label-text` — 0.9rem, legacy Pizza/Sticky — 0.85rem. Rollout оставил
только scoped font-size/neighbor bridges, а полные switch-копии удалены.

Семантика не унифицируется:

- Pizza: convert text to outlines при export;
- Sticky: edit mode, outlines и prepress;
- Keyboarder: editable text/outline export mode;
- Wordplayer: transparent PNG background.

### 3.5. Radio/label `segmented-control`: общий base + legacy token

31 radio распределены между Sparky, Pizza, Sticky, Pulsar, Dither и Wander.
DOM и checked/focus selectors совпадают. Shared label font-size равен 0.9rem,
legacy вариант — 0.85rem. Dither дополнительно сохраняет по 1 px
`margin-top`/`margin-left` на label; Pizza surface tabs имеют собственные
width/padding/ellipsis rules.

Безопасная унификация:

- framework остаётся владельцем flex container, hidden radios, checked,
  hover, focus и compact padding;
- default `--segmented-control-font-size` равен 0.9rem;
- legacy adapters задают только 0.85rem token;
- Dither сохраняет scoped 1 px margin bridge;
- Pizza сохраняет `.surface-tabs` extension;
- controller state и обработчики `change` не перемещаются.

Shared и legacy CSS сейчас используют `:focus`, а не `:focus-visible`.
Менять эту семантику одновременно с promotion запрещено: mouse-focus capture
может измениться. Это отдельное accessibility improvement.

### 3.6. Private варианты

Они не должны маскироваться под общий radio/label component:

- Keyboarder compensation mode: grid из трёх buttons, 28 px height,
  `.is-active`, runtime `aria-pressed`; keyboard/model calculations private;
- Wordplayer mode navigation: крупные toolbar buttons, отдельный radiogroup,
  `focus-visible`; переключает Canvas engine/panels/workers;
- Dither export checkbox: native 16×16, находится в нижней action bar;
  ×2/×4/×8 размечены checkbox, но controller делает их взаимно
  исключающими; менять DOM на radio в presentation rollout нельзя;
- Sparky Edit path: action button с `aria-pressed`, пауза/редактирование
  animation timeline;
- Pizza surface locks: icon buttons, controller синхронизирует
  `aria-pressed`; geometry constraints private;
- Wander `auto`/`max`: compact `.unit-btn.active`, одновременно отключают
  соответствующие range/value controls. Отсутствующий `aria-pressed` —
  зафиксированный accessibility debt, не повод менять behavior в canary.

## 4. Controller ownership

| Инструмент | Кто владеет состоянием и side effects | Что запрещено переносить в framework |
|---|---|---|
| Sparky | `defineTool`/`settingsStore` для обычных toggles; `tool.js` для focus modes, Manual/Follow и animation editing | взаимные зависимости focus, mobile showcase, animation timeline, SVG rendering |
| Pizza Boxer | Grid settings commands/view, `SurfacePanelController`, editor bindings/controllers, export settings | history transactions, surface grids, text/graphics constraints, generated-runtime wiring |
| Sticky Fingers | façade/legacy controllers в `script.js`, settings, edit/prepress/export flows | edit-mode panel lifecycle, Google Sheets, barcode/data rows, export configuration |
| Keyboarder | `defineTool` для pills; `tool.js` для compensation buttons и outline export | model/table compensation, advanced visibility, font/export modes |
| Wordplayer | `defineTool` для pills; private mode controller and workers; export controller | Dither/Forms switching, worker messages, Canvas invalidation, PNG transparency |
| Pulsar Coder | `pulsar-main.js` + settings store | ECC mode, payload encoding, rays and SVG generation |
| Dither | `DitherTool` event handlers/settings | raster cache/invalidation, algorithms, export scale exclusivity, alpha export |
| Wander Bender | `wander-bender.js` + settings | three SVG modes, Auto/Max dependencies, dynamic range maxima |

Правило framework: presentation читает native checked/disabled/focus state,
но не записывает domain setting, не инициирует export и не решает, какие
контролы взаимно исключаются.

## 5. State matrix для browser acceptance

| State | Что фиксируется | Обязательные семейства |
|---|---|---|
| Initial unchecked/checked | class/checked, label/track/thumb colors, rects, output snapshot | все |
| Mouse hover | background/border/icon swap без geometry shift | pill, chip, switch, segment, Dither export |
| Keyboard focus | Tab order, outline/box-shadow, Enter/Space/arrow behavior как до migration | все интерактивные варианты |
| Programmatic sync | controller меняет `.checked`, `.active`, `.is-active`, `aria-pressed` без stale UI | все приложения |
| Disabled/inactive | pointer behavior, opacity, dependent fields | pill, Keyboard advanced, Wander Auto/Max, export buttons |
| Hidden/mode-specific | отсутствующий control не занимает место | Sparky Path, Wordplayer modes, Keyboard advanced, Sticky edit mode |
| Persistence/restore | preset/share/storage/reload возвращает тот же choice state | все, где state persistent |
| Domain output | SVG/Canvas/input count/hash/geometry не меняются после round-trip | все |

Для radio groups дополнительно проверяются: ровно одна активная option,
повторный click не снимает выбранное значение, controller получает правильный
value, а import/reload восстанавливает checked label.

## 6. Риски по приложениям

### Sparky — критический приоритет

- shared component уже активен, поэтому основная опасность — regression от
  будущей правки framework CSS;
- mobile touch targets и скрытие Path controls проверяются на двух viewport;
- Manual/Follow — зависимое состояние, а не два независимых switches;
- все SVG/animation tests и desktop/mobile baselines обязательны после каждого
  shared CSS change.

### Pizza Boxer — критический приоритет

- source fragments собираются в hashed public runtime;
- 36 native controls распределены между grid, surfaces и динамическими object
  editors;
- shared presentation не должна менять history begin/commit, surface lock,
  object constraint или HSB/export behavior;
- checked/hover/focus проверяются в default, Paragraph, Graphics и surface
  panel states.

### Sticky Fingers — критический приоритет

- 28 native controls, normal/edit modes и динамические panels;
- три `toggle-switch` имеют разные side effects;
- Google Sheets остаётся единственным пользовательским внешним runtime;
- проверяются normal/edit SVG, panel stack, PDF/SVG and data import boundary.

### Keyboarder — критический приоритет

- `pill-toggle` уже shared;
- generic class `.segmented-control` локально переопределён под buttons; этот
  намеренный selector collision защищается test и не переводится в radio DOM;
- compensation mode и outline export должны возвращать exact SVG и editable /
  outlined PDF behavior.

### Wordplayer — критический приоритет

- mode navigation визуально является toolbar, а не compact segment;
- pills меняют параметры обоих Canvas engines;
- проверяются оба режима, workers, transparent export и hidden mode controls.

### Pulsar, Wander, Dither

- Pulsar — малый zero-domain-diff canary: 1 checkbox + 3 radio;
- Wander — только один shared-compatible radio segment; Auto/Max private;
- Dither последним: raster capture может меняться от font metrics и на 1 px
  сдвига; четыре export checkbox остаются private.

## 7. Порядок rollout

Каждый пункт — отдельная итерация с собственным before/after evidence. Не
объединять два приложения в один production commit.

### UPG-054s — contract gate и direct canonical verification

1. Добавить `scripts/check-toggle-contracts.mjs` и `npm run check:toggles`.
2. Зафиксировать 77 checkbox, 37 radio, family counts и private exceptions.
3. Добавить boundary assertions для shared-only pills/toggle-switches в
   Sparky, Keyboarder и Wordplayer.
4. Browser-проверка Sparky desktop/mobile, Keyboarder и Wordplayer без
   production diff.

### UPG-054t — Pulsar canary

1. Добавить в shared framework совместимый `checkbox-label` base.
2. Ввести `--segmented-control-font-size` с default 0.9rem.
3. Оставить Pulsar 0.85rem adapter, удалить только покрытые local дубли.
4. Сравнить normal/hover/focus, 4 choice states, panels, 22 input/select
   states и exact SVG; прогнать Pulsar/framework/isolation/G4 tests.

### UPG-054u — Wander segmented rollout

1. Перевести один radio segment на shared presentation с 0.85rem bridge.
2. Не менять private Auto/Max CSS или behavior.
3. Сверить Radial/Random/Flow screenshots, all inputs, panel geometry и все
   три SVG outputs.

### UPG-054v — Pizza Boxer rollout

1. По отдельным CSS blocks перевести `toggle-chip`, `toggle-switch`,
   `checkbox-label` и radio/label segment на shared base.
2. Сохранить 0.85rem text/segment tokens, surface tabs и Graphics flex bridge.
3. Не менять controller imports или event wiring.
4. Пересобрать public runtime; проверить 15 assets, 113 input states, panels,
   surfaces, Paragraph/Graphics, SVG/export и все 167 tests.

### UPG-054w — Sticky Fingers rollout

1. Перевести три общих семейства и segment на shared base.
2. Сохранить 0.85rem bridges и edit-mode visibility.
3. Проверить normal/edit, 79 form states, panels, SVG/PDF, preset/data rows и
   Google Sheets boundary; прогнать все Sticky tests.

### UPG-054x — Dither raster-safe boundary

1. Попробовать shared `checkbox-label` и segment только с 0.85rem + 1 px
   scoped bridges.
2. Оставить четыре export checkbox private.
3. Сравнить full-page и canvas bytes для default, Bayer и Pixel Size 4, затем
   checked/focus/export-scale states.
4. При любом необъяснимом raster diff откатить promotion и документировать
   Dither как private exception.

### UPG-054y — component gate

1. Обновить `check:toggles` фактической shared/private классификацией.
2. Защитить Keyboarder button segment, Wordplayer mode navigation, Dither
   export checks и private state buttons от случайной generic унификации.
3. Запустить полный Gate G4, isolation, все app suites и `git diff --check`.
4. Зафиксировать оставшиеся bridges, затем перейти к UPG-055 preset toolbar.

## 8. Acceptance и rollback

Promotion принимается только если одновременно выполнено:

- ожидаемый visual diff перечислен заранее; для canary по умолчанию ожидается
  zero diff;
- bounding rects labels/tracks/panels не изменились, если это не согласованная
  нормализация;
- checked, focus, disabled, hidden и programmatic restore состояния совпадают;
- SVG/Canvas/export domain output не изменился;
- app tests, `check:isolation`, `check:toggles` и `gate:g4:static` проходят;
- нет новых URL/path/storage dependencies за пределами `upgrade`.

Rollback выполняется внутри текущей app-итерации, если:

- контрол сдвигает panel или меняет mobile touch layout Sparky;
- пропадает focus indication либо изменяется keyboard behavior;
- checked UI расходится с settings/controller state;
- меняется SVG/Canvas/export output;
- Dither получает необъяснимый raster diff;
- Pizza runtime перестаёт быть воспроизводимым;
- Sticky edit/Sheets/PDF flow меняется.

После rollback общий framework не подгоняется под один private случай ценой
регрессии остальных инструментов. Исключение остаётся scoped и документируется.

## 9. Журнал выполнения

### UPG-054s — Complete

Добавлен `scripts/check-toggle-contracts.mjs`, команда `check:toggles` и её
включение в Gate G4. Проверка машинно фиксирует все 114 native inputs, family
totals и текущих shared/private presentation owners. В boundary suites
Sparky/Keyboarder/Wordplayer добавлены запреты на local base-дубли и assertions
для private variants.

Browser verification на 1280×720:

- Sparky: 9 native choices, 6 input-bearing pills, 3 focus-mode radios;
  `Sphere` on/off возвращает SVG к 26 806 characters;
- Keyboarder: 12 checkbox, 11 pills, shared 40×20 export switch; `Guides`
  on/off возвращает SVG к 133 295 characters; private button segment остаётся
  grid и синхронизирует 3 `aria-pressed`;
- Wordplayer: 13 native choices, 10 pills, shared 40×20 export switch;
  Invert восстанавливается, Forms→Dither возвращает исходные panels/mode.

Sparky 390×844 и 430×932: document/canvas width равен viewport, horizontal
overflow отсутствует, desktop panels скрыты, все 9 choices остаются в DOM.
Browser console errors: 0. Sparky 196/196 и все Keyboarder/Wordplayer suites
проходят. Production HTML/CSS/runtime не менялись.

### UPG-054t — Complete

В shared CSS добавлены exact-compatible `checkbox-label` 33×18/14 px и token
`--segmented-control-font-size` с default 0.9rem. Из
`pulsar_coder/css/yf-styles.css` удалены полные checkbox/segmented blocks.
Единственный app bridge задаёт 0.85rem и через `revert-layer` продвигает только
эти shared selectors поверх frozen unlayered reset. State/domain handlers не
изменялись.

Первый after capture выявил потерю label padding из-за cascade layer и был
отклонён до приёмки. После scoped bridge:

- full-page before/after SHA-256 совпадает: `001ddcb254570140…`;
- complete computed/state record совпадает;
- checkbox label 260×26, track 33×18, thumb 14×14/left 17;
- segment 260×33.6015625, labels 13.6 px;
- все panels, 22 input/select/textarea states и 4 choice states совпадают;
- SVG возвращается к 40 180 chars после Show Rays off/on и ECC 2x/None;
- unchecked track `rgb(58,58,58)`, checked track `rgb(136,136,136)`, radio
  focus ring 2 px сохранены.

Framework 36/36, Pulsar 8/8, `check:toggles` и isolation проходят. Immutable
`upstream-v3` не менялся; `CSS_PROVENANCE.json` документирует G5 extension.

### UPG-054u — Complete

Wander Bender использует shared radio/label segmented presentation вместо
полного local duplicate. Legacy 13.6 px font metric задан через
`--segmented-control-font-size: 0.85rem`; scoped `revert-layer` bridge
компенсирует только frozen unlayered reset. Private Auto/Max buttons, их active
state и disabled range/value dependencies не менялись.

Browser verification на 1280×720:

- full-page before/after SHA-256 совпадает: `5877e8c29e237acc…`;
- полный record 48 controls, computed styles и geometry совпадает;
- segment остаётся 260×55.203125, panel — 300×605.703125;
- Radial/Random/Flow SVG имеют 1 838/12 261/26 292 chars;
- round-trip возвращает Radial, Auto/Max active и четыре dependent controls
  disabled;
- browser console errors: 0.

Wander 10/10, framework 36/36 и `check:toggles` проходят. Следующий rollout —
UPG-054v Pizza Boxer с отдельным before/after evidence и rebuild 15 assets.

### UPG-054v — Complete

Pizza Boxer удалил полные local base/state blocks для 15 `toggle-chip`, семи
`checkbox-label`, четырёх radio/label segments и одного `toggle-switch`.
Presentation приходит из shared CSS. Приложение сохраняет surface-tab sizing,
Graphics size flex-layout, controller/event ownership и private lock buttons.
0.85rem token и scoped cascade bridges компенсируют frozen universal reset.

Browser verification на 1280×720:

- первый +3 px, затем +1 px layout drift были отклонены и локализованы до
  segment label cascade и `.show-toggle-chip-group` padding;
- финальный full-page SHA-256 совпадает: `1dfbb49ac2b3aa3…`;
- 113 input/select/textarea states, 36 choice states и все computed component
  records совпадают;
- пять default panels, Paragraph 300×680 и Graphics 300×451 state/geometry
  records совпадают;
- SVG остаётся 94 374 chars, SHA-256 `4abbde0d…`;
- Show Columns off уменьшает SVG до 84 854 chars; chip, Link Mode,
  checkbox-label и export switch round-trip возвращают все 113 states и точный
  исходный SVG;
- keyboard focus у export switch сохраняет 2 px black + 4 px white ring;
- browser error-level logs: 0; private surface lock states не изменились.

Source/build/public checks подтверждают 15 hashed assets. Pizza 167/167,
framework 36/36, `check:toggles` и полный Gate G4 проходят. Следующий rollout —
UPG-054w Sticky Fingers; edit-mode, Google Sheets и PDF остаются private
acceptance boundaries.

### UPG-054w — Complete

Sticky Fingers удалил полные local base/state blocks для девяти `toggle-chip`,
десяти `checkbox-label`, двух radio/label segments и трёх `toggle-switch`.
Shared CSS теперь владеет presentation; application по-прежнему владеет
edit-mode, settings/controllers, preset/data rows, Google Sheets и SVG/PDF.
0.85rem segment token, private chip alignment/padding/font и scoped cascade
promotion сохраняют legacy metrics поверх frozen universal reset.

Browser verification на 1280×720:

- normal и edit complete records совпадают: 79 form fields, 28 choices и все
  component computed styles;
- Data Import остаётся 300×242; edit Layout — 300×878.703125, Objects —
  300×383, Text Styles — 300×237;
- первая проверка поймала -8 px Layout drift от shared last-child margin;
  scoped 8 px group bridge вернул exact geometry до приёмки;
- normal SVG остаётся 18 640 chars/hash `1592eaac…`, edit — 18 607/hash
  `8850fd2f…`; принятые full-page hashes — `164e7ea8…`/`29946506…`;
- Show objects, Prepress и edit-mode round-trip возвращают исходные state/SVG;
  switch focus ring остаётся 2 px black + 4 px white;
- browser error-level logs: 0; прежний EAN-13 checksum warning сохранён.

Sticky 5/5, framework 36/36, `check:toggles` и полный Gate G4 проходят.
Следующий rollout — UPG-054x Dither с byte-exact raster rollback.

### UPG-054x — Complete

Dither удалил полные local `checkbox-label` и segmented base/state blocks.
Shared presentation обслуживает две checkbox-label и три pattern radio;
четыре native 16×16 export checkbox остаются private. Scoped bridge сохраняет
0.85rem и исходные segment margins 1 px top/left, 2 px bottom и `gap: normal`.

Первый after record поймал -2 px segment height и был отклонён. После bridge
default/Bayer component records совпадают полностью: 38 fields, обе panels,
choice styles и Canvas/overlay geometry. Pixel Size 4 отличается только
автоматическим `scrollTop` правой панели на 2 px; весь screenshot diff лежит
в x≥976. В области Canvas 246 440 pixels × 3 channels дают ноль отличий для
default, Bayer и Pixel Size 4. Invert/Show Effect меняют и точно возвращают
raster, ×2 export checkbox возвращает private state, radio focus остаётся
2 px с offset 2 px. Browser errors: 0. Dither 11/11 и Gate G4 проходят.

### UPG-054y — Complete

Финальный `check:toggles` фиксирует 77 checkbox + 37 radio = 114 native,
27 pill + 24 chip + 20 checkbox-label + 6 switch + 31 segment + 6 private
inputs. Дополнительно gate считает и защищает восемь private state buttons:
Sparky Edit Path, два Pizza surface locks, три Keyboarder compensation buttons
и Wander Auto/Max. Wordplayer mode navigation и четыре Dither export checks
остаются отдельными native variants. Pizza runtime controller обязан
синхронизировать `aria-pressed`; отсутствие `aria-pressed` у Wander Auto/Max
зафиксировано как существующий debt, а не исправлено скрытно.

Все shared-compatible app CSS теперь запрещены от возврата полных base blocks;
каждый оставшийся bridge scoped и документирован. `check:ranges`,
`check:toggles`, isolation, все восемь app suites и полный Gate G4 проходят.
Следующий компонент — UPG-055 preset toolbar.
