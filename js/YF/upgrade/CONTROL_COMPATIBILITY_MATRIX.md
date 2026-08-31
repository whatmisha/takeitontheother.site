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

### UPG-054d — Sparky value-display verification

Для приоритетного Sparky изменение приложения не потребовалось: 24 domain
slider displays уже напрямую используют shared `.value-display`, а ещё три
readonly HSB fields создаются shared `UnifiedColorPicker`. В
`styles/sparky.css` нет ни base-, ни state-переопределений этого компонента;
добавлен только boundary test, фиксирующий shared normal/focus/disabled rules,
отсутствие private fork и статический inventory из 24 fields.

Desktop 1280×720 остаётся точным: viewport hash `4c57d661…`, character SVG
26 806 characters/hash `12b209a2…`, 68 inputs, 27 displays и панели
300×389.352/266.75/291/187. Arrow меняет ray length 240→241,
Shift+Arrow — 240→250, Escape возвращает 999→240, blur фиксирует 241.
Shape collapse даёт 300×47 и после раскрытия возвращает exact SVG, inputs и
panel geometry. У всех 27 fields computed presentation уже canonical:
CoFo Sans 12.8 px, tabular numerals и нулевой padding.

Так как UPG-054d не меняет HTML, runtime или CSS приложения/framework, ранее
принятые Sparky mobile captures 390×844 и 430×932 остаются неизменными по
source proof; private mobile stylesheet также не содержит `value-display`.
Полный набор из 196 тестов остаётся обязательным acceptance gate.

### UPG-054e — Wordplayer value-display verification

Wordplayer также не требует visual/runtime migration. Его 20 статических
slider displays уже наследуют shared base/state rules; три readonly HSB fields
создаёт shared color picker. Единственный private selector намеренно сохранён
как extension: `#formsPanel .compact-slider-control .value-display` задаёт
только width 3.2 em, min-width 0 и font-size 0.72 rem для восьми Forms pairs.
Boundary test теперь запрещает любые другие private `value-display` selectors
и фиксирует inventory 20/8.

Browser acceptance 1280×720 разделён по режимам. Dither показывает ordinary
12.8 px/tabular fields размером 135×14.5; панели General/Pixels/Dither имеют
300×136, 300×670 и 300×305.5. Forms сохраняет восемь compact fields
11.52 px/tabular размером 36.859×13 и panel 300×513; collapse даёт 300×46 и
точно восстанавливает geometry. Canvas остаётся 1280×720 CSS и 2560×1440 при
DPR 2; все 68 inputs, 23 displays и panel/mode states возвращаются точно.
Стабильные viewport hashes в чистых состояниях: Dither `597e93a6…`, Forms
`3103d245…`; принятые UPG-052h full-page baselines остаются действительными,
так как HTML/runtime/CSS не менялись.

Ordinary keyboard contract: 2.00→2.01 по Arrow, 2.01→2.10 по Shift+Arrow,
Escape восстанавливает current setting, blur фиксирует 2.05 и Enter возвращает
2.00. Compact Forms: 15→16→20, Escape возвращает 20, blur фиксирует 17 и Enter
возвращает 15. Boundary, Dither worker и Forms worker tests проходят.

### UPG-054f — Keyboarder canonical HSB и private mm fields

Keyboarder завершён verification-only с двумя намеренно разными contracts.
Три readonly HSB fields принадлежат shared color picker и при раскрытом Key
color имеют canonical transparent/tabular presentation 12.8 px и 135×14.5.
Шесть статических `.value-display` принадлежат не SliderController, а private
`NUMERIC_CONTROLS`: 100×26, mono 10 px, border/background, три decimals и
suffix ` mm`. Boundary test фиксирует shared states, inventory 6/3, private
ownership и разрешает только три существующих scoped selectors Grid/Type/label.

Browser 1280×720 подтверждает 82 inputs и exact keyboard SVG
133 295 characters/hash `f1c3d795…`. Colors сохраняет 300×46 collapsed,
300×284 expanded и 300×453 с раскрытым Key HSB; открытие/закрытие не меняет SVG
или input state. Corner radius проходит private keyboard contract:
1.180→1.181 по Arrow, затем snap к 1.190 по Shift+Arrow; Escape после draft 999
возвращает текущее 1.190, comma/suffix blur фиксирует `1,234 mm` как 1.234.

Важный исходный lifecycle: UI показывает только три decimals, тогда как preset
может хранить более точное значение. Поэтому повторный Enter видимого
`1.180 mm` не обязан восстановить byte-identical geometry текущей сессии;
reload/повторное применение preset возвращает exact 133 295-character SVG,
82 inputs, displays и panels. Это причина не переносить шесть fields на generic
SliderController в G5. HTML/runtime/CSS не менялись; Keyboarder boundary и пять
domain suites проходят.

### UPG-054g — Pizza Boxer shared value-display presentation

Pizza Boxer теперь получает normal/focus/disabled presentation из shared
`.value-display`; из `styles/controls.css` удалены только дублирующие base и
focus declarations. Wrapper/layout, range skin, private `SliderController`,
`SliderHistoryController`, settings callbacks и девять standalone object-editor
fields не менялись. Boundary test разрешает единственный локальный selector
`.control-group label .value-display`, фиксирует inventory 38 и shared states.

Изменение проведено через штатный Vite/release pipeline: source graph содержит
101 module, а public runtime синхронизирован как 15 content-hashed assets. В
browser 1280×720 все 38 displays получают только ожидаемую нормализацию:
`min-width: 40px` → `auto` и `padding-right: 4px` → `0`. Обычные видимые fields
имеют 144.5→140.5 px при сдвиге x на 4 px и неизменном right edge; у Graphics
Height ширина также уменьшается на 4 px, а положение остаётся у его собственного
adjacent-control layout. Font, 15 px height, values и tabular numbers точны.

Default, Paragraph 300×680 и Graphics 300×451 состояния совпадают со старым
runtime по 113 inputs, 29 ranges, всем panels/surface и SVG 94 374 characters,
hash `4abbde0d…`. Front Width подтверждает private keyboard transaction:
500.0→501.0 по Arrow, затем 510.0 по Shift+Arrow; Escape откатывает draft 999 к
510.0, blur фиксирует 501.5, Enter возвращает 500.0 с exact SVG/state. Grid
collapse даёт 300×46 и после expand точно возвращает 300×526.1016. Семь
targeted transaction/boundary tests и полный комплект 167 Pizza tests проходят.

### UPG-054h — Dither raster-safe shared value-display

Из `style.css` удалены unscoped `.value-display` base/focus declarations;
normal/focus/disabled теперь приходят из shared stylesheet. Локально остаются
только layout extension `.control-group label .value-display` и существующий
частный `.hsb-value`. Десять обычных fields сохраняют 140.5×15 geometry,
позиции и normal numeric glyphs; computed `min-width` меняется 40 px→auto без
видимого layout diff. Три HSB fields сохраняют свой 40 px private variant.

Первый прямой переход на shared `tabular-nums` детерминированно изменил default
full-page hash `89276268…`→`c799d96b…` и canvas-area `aa118d76…`→`698cacf2…`
при полностью одинаковых DOM geometry/state. По заранее заданному rollback
правилу tabular change не принят: узкий scoped `font-variant-numeric: normal`
вернул исходные bytes. Это не возвращает локальный base selector и не меняет
shared focus/disabled presentation.

Финальный browser acceptance 1280×720 byte-identical: default
`89276268…`/canvas `aa118d76…`, Bayer `ef32e2fa…`/canvas `01021af1…`, Pixel
Size 4 `06d19922…`/canvas `0941d49e…`. Точны 38 inputs, 13 ranges, panels
300×352.5 и 300×680, bottom actions, body 1280×860 и обе canvas geometry.
Раскрытый HSB стабильно совпадает (`c580826c…`, canvas `26c782d3…`); modal
ARIA/geometry совпадают, закрытие возвращает exact default bytes.

Private formatting также сохранено: Scale 100%→101% по Arrow и →111% по
Shift+Arrow, Escape возвращает focus snapshot 100%; blur 125% сохраняет прежнее
native range coercion к 1.3. Rotation 0°→1°→11° и Escape→0°. После settle old
и new возвращают exact default raster/state. Boundary test теперь защищает
percentage/degree, cache invalidation и неизменный PNG `toBlob` path; все десять
Dither tests проходят.

### UPG-054i — Sticky Fingers native-number boundary

Sticky Fingers завершён как отдельный native-number contract, а не как
text-display rollout. В активном DOM нет ни одного `.value-display`: 39
статических `input[type="number"].number-input` дополняются одним динамическим
fixed-column input. Поэтому три мёртвых local `value-display` selectors удалены,
а shared base становится единственным источником, если такой text field будет
когда-либо добавлен. Активные 40 native number inputs не менялись.

Private presentation сохранён: основные fields имеют native `appearance`,
spinner opacity 1, 32 px height, 13.6 px font, 8 px horizontal padding и 8 px
top margin; динамический fixed-column field остаётся отдельным 60×24/16 px
variant. Поведение также неоднородно. `NumberInputController` обновляет settings
на live input, форматирует decimals и имеет специальный Shift snap для
`decimals === 2`; динамический field использует только app-owned `change`
handler, а Paragraph/Graphics/Barcode fields сохраняют свои editor handlers.

Browser 1280×720 подтверждает byte-identical normal `c021f8ed…` и edit
`ea806751…` captures, 79 form states (73 inputs), 40 number fields, panels,
680×680 artboard и exact SVG 18 640/hash `1592eaac…` либо edit 18 607/hash
`8850fd2f…`. Paragraph 300×855.492 и Barcode Graphics 300×463 совпадают по
inputs, computed number presentation, panels и SVG. Front Width сохраняет
120.0→120.5→130.5; live draft 999 + Escape остаётся 999.0, потому что source
settings уже обновлён. Headline сохраняет 7.00→7.01→7.10. Clean reload точно
восстанавливает normal/edit baselines. Google Sheets boundary не менялся;
пять тестов проходят.

### Завершение value-display

Все восемь инструментов классифицированы и проверены. Shared base обслуживает
совместимые text displays; Dither/Wordplayer/Keyboarder сохраняют только узкие
варианты, а Sticky остаётся native-number family без фиктивной конвертации.

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
