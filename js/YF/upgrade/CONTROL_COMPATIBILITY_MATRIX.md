# UPG-054a — numeric/value-display compatibility matrix

Дата фиксации: 2026-08-31. Runtime-состояние: после завершённого UPG-053g и
зелёного Gate G4. В этой подзадаче runtime, CSS и HTML инструментов не меняются.

Цель документа — отделить общий presentation contract числового контрола от
частных min/max/step, форматирования, settings callbacks, undo/redo и
генеративного lifecycle. До первого canary нельзя заменять app-owned controller
или переносить обработчики между инструментами.

## 1. Граница текущей задачи

UPG-054 выполняется четырьмя последовательными компонентами:

1. single-value display;
2. single-thumb range;
3. toggle;
4. segmented control.

Этот документ подробно фиксирует первый компонент и точки сцепления со
single-thumb range. Он не разрешает одновременно менять range geometry,
toggle/segmented CSS или controller behavior.

Неподвижны:

- DOM IDs и типы inputs;
- min/max/step, decimals, suffix и правила clamp/round;
- момент commit: live input, blur, Enter, Escape, Arrow и Shift+Arrow;
- settings keys, callbacks, debounce и render scheduling;
- Pizza mouse/focus transaction boundaries и undo/redo;
- Wander `Auto`/`Max`, dynamic corner-radius maximum и disabled state;
- Dither percentage/degree conversion и raster/cache lifecycle;
- Keyboarder unit suffixes и text-style editor lifecycle;
- Sticky native number inputs, spinners и mixed controller ownership;
- HSB color-picker ownership;
- Canvas/SVG/export geometry и Sparky mobile layout.

## 2. Общий framework baseline

Рабочий framework уже содержит два независимых слоя контракта.

Presentation в `framework/css/othersite-styles.css`:

- `.value-display`: transparent, borderless, right-aligned, 0.8 rem/400,
  muted color, inherited font и tabular numbers;
- focus меняет только text color;
- disabled задаёт opacity 0.4, muted color и default cursor;
- paired disabled range дополнительно приглушает label;
- single-thumb range: 1 px track, 8 px thumb, 10 px visual hover, keyboard
  focus ring и отдельный disabled state.

Behavior в `framework/src/ui/SliderController.js`:

- range `input` обновляет display, settings и callback live;
- text field фиксирует ввод на blur/Enter;
- Escape восстанавливает settings value;
- ArrowUp/ArrowDown используют `baseStep`, Shift — `shiftStep`;
- отсутствующий `shiftStep` нормализуется в `baseStep × 10`;
- `setDisplayValue()` синхронизирует только slider/display и намеренно не
  меняет settings/preset state.

Root Void проверен только как read-only donor. Его current CSS для
value-display/range совпадает с Upgrade framework; отличие — remote font URLs,
которые в Upgrade уже локализованы. Upgrade `SliderController` дополнительно
имеет default Shift-step и display-only API. Поэтому переносить runtime из Void
не нужно: выбранный общий контракт уже новее и автономен.

## 3. Browser inventory, 1280×720

В восьми приложениях найдено 137 text `.value-display`, 48 native `number`
inputs и 122 single-thumb ranges. Каждому range соответствует display; кроме
них существуют 15 самостоятельных text displays: девять object-editor полей
Pizza и шесть grid-полей Keyboarder.

| Инструмент | Text displays | Number inputs | Ranges | Default special state | Runtime owner | Неподвижный private contract |
|---|---:|---:|---:|---|---|---|
| Sparky | 27 | 0 | 27 | 3 HSB fields readonly | 24 pairs — shared `SliderController` через `defineTool`; 3 — shared `UnifiedColorPicker` | animation/focus callbacks, history/render, exact desktop и mobile character |
| Pizza Boxer | 38 | 0 | 29 | нет disabled/readonly | private modular `SliderController` + config factory; 9 editor fields имеют отдельный lifecycle | `SliderHistoryController`, mouse/focus transactions, unit conversions, surface/document/editor state |
| Sticky Fingers | 0 | 40 | 0 | native number/spinner variant | private `NumberInputController` для 25; ещё 15 barcode/object/editor controls имеют частные handlers | live input, fixed-decimal formatting, linked grid, edit mode, labels, Sheets/PDF |
| Keyboarder | 9 | 8 | 3 | 3 HSB readonly | 6 suffix fields — app numeric binder; HSB — shared color picker; 8 specialized editor fields — private | `mm` parsing/formatting, text-style/font-axis/compensation/legend editors, SVG/PDF |
| Wordplayer | 23 | 0 | 23 | 3 HSB readonly | 20 pairs — shared controller через `defineTool`; 3 — shared color picker | mode visibility, worker invalidation, Canvas, Dither/Forms and export |
| Pulsar Coder | 8 | 0 | 8 | нет disabled/readonly/suffix | shared controller через adapter | live codec generation, preset sync, SVG, известный исходный verifier mismatch |
| Dither | 13 | 0 | 13 | default disabled отсутствует | private `DitheringTool`; HSB также app-owned | `scale` как percent, `rotation` degree, focus snapshot/Escape, image cache, Canvas/overlay/PNG |
| Wander Bender | 19 | 0 | 19 | `stroke` и `cornerRadius` disabled | shared controller через adapter + app Auto/Max handlers | dynamic max, two disabled pairs, three modes, debounce categories, Paper/SVG |

Важно: одинаковый класс `.value-display` не означает одинаковое поведение.
Shared framework controller непосредственно владеет 71 обычной парой: Sparky
24, Wordplayer 20, Pulsar 8 и Wander 19. Остальные внешне похожие controls
остаются app-owned.

## 4. Группы controls и форматирования

### Sparky

- 24 integer displays без suffix: shape, focus, motion, bolid и eyes.
- Два layout-варианта: 11 полей имеют вычисленную ширину 111.5 px/15.5 px,
  16 — auto; типографика и state одинаковы.
- Три readonly HSB поля показывают `°`, `%`, `%` и не входят в
  `SliderController`.
- Любой framework CSS diff требует desktop и двух mobile acceptance sizes.

### Pizza Boxer

- 29 связанных пар: base grid 5, surface grid 5, dimensions 3, HSB 3,
  typography 12 и Lunnen Display weight 1.
- Девять самостоятельных text fields редактируют paragraph/graphics position,
  baseline и dimensions.
- Две visual width families: 20 fixed computed displays и 18 auto fields.
- Formatting включает 0–4 decimals, dropdown-linked weights и преобразование
  typography units. Оно остаётся в `SliderValueMath`, `SliderConfigFactory` и
  app controllers.
- `SliderHistoryController` начинает range action на primary mousedown и
  завершает на mouseup/document mouseup; text action живёт от focus до blur.
  Presentation rollout не имеет права менять или дублировать эти listeners.

### Sticky Fingers

- Это не value-display variant, а 40 нативных `.number-input` высотой 32 px с
  заполненным background и видимыми browser spin buttons.
- Центральный `NumberInputController` обслуживает 25 полей: 7 grid/dimension,
  6 HSB и 12 typography. Он обновляет settings live на `input`, форматирует на
  blur, обрабатывает Enter/Escape/Arrow/Shift+Arrow.
- Ещё 15 полей принадлежат barcode, data-preview, paragraph/graphics editors и
  Lunnen Display weight. Их commit/history не совпадают с центральными 25.
- Следовательно, Sticky нельзя включать в rollout простой заменой
  `.number-input` на `.value-display` или сменой `type="number"` на text.

### Keyboarder

- Шесть самостоятельных grid values показывают ровно три decimals и suffix
  ` mm`; собственный binder хранит `data-numeric-setting`, парсит suffix,
  использует steps 0.001/0.01 и синхронизирует settings без range.
- Эти поля — отдельный bordered/filled mono variant: 100×26 px,
  10 px monospace, tabular numbers.
- Три HSB displays — readonly canonical color-picker fields.
- Восемь native number inputs принадлежат font axes, compensation table,
  legend width/offsets; часть динамическая и без стабильного ID. Они не входят
  в первый generic value-display rollout.

### Wordplayer

- 20 shared pairs: Dither parameters 12 и Forms parameters 8; hidden mode panel
  остаётся в DOM, поэтому inventory включает оба режима.
- Forms содержит намеренный compact variant 11.52 px и шириной 3.2 em; его
  нельзя выровнять с обычными fields без отдельного layout acceptance.
- Три HSB displays readonly и принадлежат shared color picker.

### Pulsar Coder

- Восемь однородных shared pairs, одна computed-style family, нет suffix,
  readonly, disabled, transaction history или dynamic limits.
- Decimals: integer и one-decimal; callbacks только перегенерируют codec SVG.
- Это наиболее чистый presentation-only canary.

### Dither

- Десять transform/effect controls связываются app-owned логикой; три HSB
  controls имеют отдельные handlers.
- `scaleValue` отображает 0.1–4.0 как 10–400%, а Arrow изменяет percentage
  space на 1/10 percentage points. Generic numeric formatting это сломает.
- `rotationValue` сохраняет degree suffix. Escape возвращает значение,
  записанное при focus, а не общий SettingsStore snapshot.
- Любая смена glyph metrics может затронуть raster capture; Dither идёт
  последним и имеет то же rollback правило, что отложенная navigation.

### Wander Bender

- 19 shared pairs, но `stroke` и `cornerRadius` disabled на default startup.
- `Auto` вычисляет stroke из width и одновременно выключает pair.
- `Max` вычисляет corner radius как width/2, динамически меняет range max и
  выключает pair. Ручной ввод снимает соответствующий automatic state.
- Private disabled presentation opacity 0.3/cursor `not-allowed` намеренно
  отличается от shared 0.4/default и должен мигрировать только как явно
  принятый visual diff после behavior proof.

## 5. Presentation families

| Family | Normal | Focus/active edit | Disabled/readonly | Members |
|---|---|---|---|---|
| canonical transparent | inherited CoFo, 12.8 px/400, muted, transparent, borderless, right, tabular | text becomes primary; geometry unchanged | opacity 0.4/default; HSB readonly остаётся визуально normal | Sparky, ordinary Wordplayer, shared HSB in Sparky/Keyboarder/Wordplayer |
| legacy transparent | system/inherited font, 12.8 px/400, muted, transparent; legacy min-width/padding variants | primary text color | обычно shared fallback; Wander overrides to 0.3/not-allowed | Pizza, Pulsar, Wander, Dither |
| Wordplayer compact | canonical base, 11.52 px, width 3.2 em | canonical focus color | не используется сейчас | 8 Forms displays |
| Keyboarder metric | 10 px mono, 100×26 px, filled background, 1 px border, radius 6 | shared primary color while shell remains | не используется сейчас | 6 grid metric fields |
| Sticky number | 32 px filled native number input, 13.6 px, browser spinners | outline none; native editing/stepper remains | default state not present in startup | 40 Sticky fields |

Single-thumb range visual state already nearly common:

| State | Current common contract | Exceptions/risk |
|---|---|---|
| normal | transparent 10 px hit area, 1 px border-color track, 8 px white thumb | app margins and HSB gradients remain private |
| hover | thumb scales 1.25 to 10 px | do not use hover as transaction start |
| focus | two-ring thumb shadow, no outer input outline | preserve keyboard visibility |
| disabled | opacity 0.4, muted thumb/track, default cursor; label dimmed | Wander display uses 0.3/not-allowed; behavior still app-owned |
| active drag | native range interaction | Pizza begin/commit action boundaries must remain private |

## 6. Ownership rules for implementation

Framework may own:

- presentation tokens and base selectors;
- tabular-number typography;
- normal/focus/disabled styling;
- shared controller only where it is already the runtime owner;
- reusable browser/test helpers for state capture.

Application must continue to own:

- config values and formatting;
- suffix parsing and display conversion;
- callbacks, debounce and invalidation;
- history/transactions and restore snapshots;
- dynamic min/max/disabled decisions;
- object editor and color-picker lifecycle;
- generated output and export decisions.

CSS promotion cannot be accompanied by moving controller code. A component is
considered unified when it consumes shared presentation; behavior may remain
behind a documented adapter indefinitely.

## 7. Rollout и первый canary

### UPG-054b — Pulsar value-display canary

Меняется только presentation source `.value-display` normal/focus/disabled.
Range CSS и JavaScript остаются прежними. Legacy wrapper/layout rules можно
оставить app-owned; удалять допускается только подтверждённый duplicate самого
display selector, чтобы shared lower-layer rule стал фактическим источником.

Почему Pulsar первый:

- восемь однородных fields и одна visual family;
- shared controller уже является runtime owner;
- нет suffix, readonly, disabled, dynamic max или undo transaction;
- три независимые panel anchors и exact SVG/input state уже имеют baseline;
- низкий риск позволяет проверить метод до Sparky и других приоритетных apps.

До/после обязательно записать:

- computed normal/focus и искусственно включённый disabled presentation;
- rect каждого display, label, range, panel и SVG;
- значения и HTML min/max/step всех восьми pairs;
- range live update;
- text blur и Enter commit;
- Escape restore;
- Arrow и Shift+Arrow с точным шагом;
- exact 22-input state и 40 180-character SVG после восстановления;
- full-page screenshot и список только намеренных glyph/padding отличий;
- 8 Pulsar tests, isolation и полный Gate G4.

Rollback condition: любое изменение codec output, callbacks, panel/SVG rect,
range geometry, min/max/step или восстановленного input state.

Результат: выполнено. Из frozen `css/yf-styles.css` удалены только базовые
`.value-display` normal/focus declarations; wrapper/layout и весь range CSS
остались частными. Восемь fields теперь получают transparent/tabular,
focus и disabled presentation из shared stylesheet. Boundary test запрещает
возврат app-owned base selector и фиксирует shared normal/focus/disabled rules.

Принят один намеренный visual diff: legacy `min-width: 40px` и правый padding
4 px исчезли. Каждый display сохранил высоту 15 px и правую границу, но его rect
стал 144.5 → 140.5 px со сдвигом левой границы на 4 px; numeric glyphs
переместились к canonical right edge. Range rect/style/min/max/step, три panel
rect и SVG rect не изменились. Fresh 1280×720 viewport capture:
`fcbf4764…` → `481445a4…`; full capture: `4e09d62a…` → `001ddcb2…`.

Browser behavior до и после совпадает: Arrow 14→15, Shift+Arrow 14→16,
Enter/blur commit, Escape 999→14 и live range 14→15. После reload все 22 input
state совпадают, а exact SVG остаётся 40 180 characters с hash `97155e5a…`.
Main/Encoding/Visual сохраняют 300×560, 300×214.6016 и 300×46. Pulsar не имеет
disabled display в default runtime, поэтому disabled state закреплён shared CSS
boundary, а не искусственным app state. Восемь tests, isolation и Gate G4
проходят.

### UPG-054c — Wander value-display rollout

Результат: выполнено. Все 19 fields получают base normal/focus presentation и
tabular numbers из shared CSS. Из legacy skin удалены только duplicate base
selector и private `font-variant-numeric: normal`; wrapper/layout и весь range
CSS сохранены. `Auto`/`Max` остаётся явным extension: disabled displays по-прежнему
имеют opacity 0.3/cursor `not-allowed`, а disabled ranges — opacity 1/pointer.

На семи видимых Radial fields принят тот же canonical geometry diff, что у
Pulsar: 15 px height, width 144.5 → 140.5 px, left edge +4 px, неизменный right
edge. Двенадцать скрытых Random/Flow fields сохраняют нулевой rect; у всех 19
меняются только tabular/min-width/padding presentation. Panel остаётся
300×605.703, 41 input state и кнопки точны. Viewport capture:
`9e253d70…` → `0383fe9c…`; full capture: `9814efef…` → `5877e8c2…`.

Auto/Max lifecycle совпадает: default `stroke=23`, `corner=12`, обе пары
disabled; off включает редактирование; повторный Auto вычисляет 20, повторный
Max — 12.5. При live width 30 обе пары остаются disabled и получают stroke 25,
corner/max 15. Old-CSS и new-CSS вкладки создают byte-identical 1 800-character
SVG с hash `b6564ee2…`. Arrow 0→1, Shift+Arrow 0→10 и Escape 999→0 совпадают.
Radial/Random/Flow SVG hashes `8bcdfde2…`, `fa1daf28…`, `f6fa2d66…` точны;
10 tests, isolation и Gate G4 проходят.

### Последующий порядок value-display

1. Sparky — приоритетный rollout с desktop и 390×844/430×932 mobile checks.
2. Wordplayer — ordinary и compact Forms variants раздельно.
3. Keyboarder — canonical HSB отдельно от bordered `mm` extension.
4. Pizza — только presentation; mouse/focus history transactions остаются
   частными и покрываются source/public-runtime rebuild.
5. Dither — последним, с byte-level raster rollback.
6. Sticky — отдельный native-number contract; не часть text-display rollout.

После value-display rollout single-thumb range получает собственную матрицу и
canaries. Toggle и segmented не начинаются, пока value-display/range не закрыты.

## 8. Acceptance template каждой подзадачи

1. Зафиксировать current screenshot, DOM values и computed states.
2. Изменить один presentation component в одном приложении.
3. Не трогать JS, если задача явно не названа behavior task.
4. Сравнить normal/hover/focus/disabled; readonly отдельно.
5. Проверить click/drag, keyboard, blur/Enter/Escape и Shift+Arrow.
6. Восстановить initial state и сравнить все inputs и generated output.
7. Проверить panel/canvas/SVG geometry и bottom/top controls.
8. Запустить app tests, `npm run check:isolation`, `git diff --check`.
9. При framework change запустить полный `npm run gate:g4:static` и Sparky
   desktop/mobile browser acceptance.

Новый baseline принимается только для перечисленного presentation diff. Любая
необъяснённая domain, geometry, transaction или raster разница означает rollback.
