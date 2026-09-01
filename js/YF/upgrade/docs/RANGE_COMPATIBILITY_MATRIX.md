# UPG-054j — single-thumb range compatibility matrix

Дата фиксации: 2026-08-31. Runtime-состояние: после завершённого
value-display rollout UPG-054a–UPG-054i и зелёного Gate G4. Эта подзадача не
меняет HTML, CSS или JavaScript инструментов.

Цель документа — отделить общий visual contract одноползункового range от
частных settings, history, render, cache и export lifecycle. Сам факт наличия
`input[type="range"]` не разрешает переносить controller или обработчики в
framework.

## 1. Неподвижная граница

В range rollout нельзя одновременно менять:

- `min`, `max`, `step`, initial value или динамические limits;
- DOM IDs, порядок controls, panel geometry или responsive layout;
- range `input`/`change`, pointer и keyboard event lifecycle;
- форматирование связанного value display;
- Pizza Boxer history transaction boundaries;
- Sparky interactive/settled placement state;
- Wordplayer worker invalidation и mode visibility;
- Dither raster/cache lifecycle, Canvas или PNG;
- Wander Bender `Auto`/`Max` и disabled decisions;
- HSB gradient calculation или color ownership;
- SVG/PDF/PNG output, filename и export geometry;
- toggle и segmented-control presentation.

Range rollout является presentation-only. Runtime owner каждого family
остаётся тем же, что до унификации.

## 2. Полный inventory

В восьми инструментах находятся 122 одноползунковых range: 107 ordinary и 15
HSB. Sticky Fingers не содержит активных range.

| Инструмент | Ordinary | HSB | Всего | Runtime owner | Особый контракт |
|---|---:|---:|---:|---|---|
| Sparky | 24 | 3 | 27 | shared `SliderController` + shared `UnifiedColorPicker` | interactive/settled placement, render/history callbacks, desktop и mobile |
| Pizza Boxer | 26 | 3 | 29 | private `SliderController`, `SliderHistoryController`, `ColorPanelController` | pointer transactions, unit conversion, editors, dynamic HSB gradients |
| Sticky Fingers | 0 | 0 | 0 | native number/edit handlers | 40 native number fields; старый range CSS не является runtime contract |
| Keyboarder | 0 | 3 | 3 | shared `UnifiedColorPicker` | общий picker перемещается между color rows; SVG/PDF остаются частными |
| Wordplayer | 20 | 3 | 23 | shared `SliderController` + shared `UnifiedColorPicker` | Dither/Forms mode visibility, worker invalidation, Canvas/export |
| Pulsar Coder | 8 | 0 | 8 | shared `SliderController` через adapter | live codec regeneration, preset sync, SVG |
| Dither | 10 | 3 | 13 | private `DitheringTool` | percent/degree display, focus snapshot, raster cache, Canvas/PNG |
| Wander Bender | 19 | 0 | 19 | shared `SliderController` через adapter | `Auto`, `Max`, dynamic corner maximum, two disabled pairs, Paper/SVG |
| **Итого** | **107** | **15** | **122** |  |  |

Shared behavior уже непосредственно обслуживает 71 ordinary pair: Sparky 24,
Wordplayer 20, Pulsar 8 и Wander 19. Ещё девять HSB ranges в Sparky,
Keyboarder и Wordplayer принадлежат shared `UnifiedColorPicker`. Pizza Boxer
оставляет private ownership всех 29 ranges; Dither — всех 13.

## 3. CSS/cascade inventory

Upgrade использует две схемы подключения framework CSS:

1. Sparky, Keyboarder и Wordplayer подключают
   `framework/css/othersite-styles.css` напрямую перед app stylesheet.
2. Pizza, Pulsar, Dither, Wander и Sticky подключают тот же файл в нижнем
   cascade layer через локальный `framework-base.css`; их unlayered frozen skin
   побеждает shared declarations до явного удаления подтверждённого дубля.

| Family | Количество | Фактический presentation source | Решение |
|---|---:|---|---|
| direct canonical ordinary | 44 | shared CSS: Sparky 24 + Wordplayer 20 | verification-only |
| layered canonical ordinary duplicates | 53 | local CSS: Pizza 26 + Pulsar 8 + Wander 19 | удалять по одному приложению после browser proof |
| direct canonical HSB | 9 | shared CSS: Sparky/Keyboarder/Wordplayer по 3 | verification-only |
| Pizza HSB variant | 3 | `grid_generator/styles/controls.css` | оставить private: 8 px thumb и app gradients |
| Dither ordinary + HSB variants | 13 | `dither/style.css` | оставить private: 1 px control box, 10 px thumb, 1.3 hover и raster-sensitive capture |
| inactive Sticky slider skin | 0 runtime | `label_generator/style.css` | не считать rollout; удалить только в UPG-058 с orphan proof |

Итого 106 ranges могут потреблять shared base без принятия нового визуального
baseline: 97 ordinary и девять shared HSB. Остальные 16 сохраняют явный private
variant: Pizza HSB 3 и Dither 13.

### Ordinary canonical source

Framework задаёт:

- 100% width и 10 px hit area;
- transparent input background и 1 px `--color-border` track;
- 8 px white thumb (`--slider-thumb-size`), 10 px при hover через scale 1.25;
- pointer cursor и relative positioning;
- `margin-top: calc(var(--spacing-md) - 2px)` и 12 px bottom margin;
- keyboard focus shadow: 2 px background gap + 4 px text-color ring;
- disabled opacity 0.4, default cursor, muted thumb/subtle track и dimmed label.

Pizza, Pulsar и Wander повторяют normal/hover/focus declarations с теми же
computed values. Их unlayered universal reset `* { margin: 0 }` сильнее
lower-layer framework, поэтому после удаления visual duplicate требуется узкий
app bridge для исторического `margin-top: 6px`; computed bottom margin остаётся
0. Без этого bridge range сдвинулся бы вверх.

### Shared HSB source

Shared HSB сохраняет 10 px hit area, но использует 12 px thumb и transparent
track, поверх которого `ColorPicker.updateGradients()` устанавливает hue,
saturation и brightness gradients. Эти девять ranges не следует смешивать с
8 px ordinary thumb.

### Private variants

- Pizza HSB использует 8 px thumb и app-owned dynamic gradient rules. Его
  ordinary ranges совместимы со shared base, но HSB block остаётся целиком.
- Dither использует 1 px input box/track, 10 px thumb с `-4.5px` centering,
  hover scale 1.3, app gradients и поздний `cursor: default`. Эти отличия уже
  участвуют в byte-sensitive Canvas capture; shared ordinary/HSB skin на них
  не распространяется.
- Wander намеренно визуализирует два disabled range как обычные активные:
  opacity 1, pointer cursor, white thumb и ordinary track. Только связанный
  value display имеет opacity 0.3/`not-allowed`. Эти scoped overrides остаются
  после удаления normal duplicate.

## 4. State compatibility matrix

| State | Shared ordinary | Shared HSB | Исключения и проверка |
|---|---|---|---|
| normal | 10 px hit area, 1 px border track, 8 px thumb | 10 px hit area, transparent gradient track, 12 px thumb | Dither 1/10 px; Pizza HSB 8 px |
| hover | thumb scale 1.25 | thumb scale 1.25 | Dither scale 1.3; hover не начинает history action |
| focus | no input outline; two-ring thumb shadow | тот же ring | проверить keyboard focus отдельно от pointer click |
| active drag | browser-native thumb movement | browser-native + live color callback | Pizza begin/commit transaction остаётся private |
| disabled | opacity 0.4, default cursor, muted thumb/track, dimmed label | сейчас не используется | Wander scoped override сохраняет визуально active range |
| hidden | DOM/value сохраняются в collapsed/mode panel | picker может быть закрыт или перемещён | Wordplayer оба modes и shared color picker должны восстановиться точно |

Pseudo-element computed styles зависят от browser engine, поэтому acceptance
использует одновременно source-boundary assertions, screenshots, focus state,
DOM geometry и domain output. Одного `getComputedStyle(input)` недостаточно для
proof thumb/track.

## 5. Behavior ownership matrix

### Shared ordinary controller

Sparky, Wordplayer, Pulsar и Wander используют framework `SliderController`:
range `input` live обновляет display, settings и app callback. Native range
keyboard сохраняет HTML `step`; Arrow/Shift+Arrow, Enter, blur и Escape на
связанном text display остаются отдельным проверяемым контрактом. Удаление CSS
не имеет права добавлять listeners или менять controller config.

Дополнительные app boundaries:

- Sparky переводит eye placement в `interactive` на range input и завершает
  его на range `change`; mobile acceptance обязателен даже при нулевом CSS diff.
- Wordplayer invalidates Dither/Forms worker state и сохраняет hidden mode
  controls в DOM.
- Pulsar live перегенерирует codec SVG; собственный известный verifier
  mismatch не является регрессией range rollout.
- Wander обновляет stroke/corner radius из width, динамически меняет corner
  `max` и включает/выключает pair кнопками `Auto`/`Max`.

### Pizza Boxer

Private `SliderController` сохраняет нормализацию и unit formatting.
`SliderHistoryController` начинает action на primary `mousedown`, commit — на
local или document `mouseup`; focus/blur связанного text input образуют другую
transaction. CSS rollout не переносит эти listeners и не меняет pointer events.
HSB callbacks остаются в `ColorPanelController` и `SliderConfigFactory`.

### Dither

Private handlers обновляют transform/settings live, форматируют scale в
процентах и rotation в градусах, инвалидируют `processedImage` cache и вызывают
immediate/debounced raster render. HSB ranges обновляют hex/background,
saturation/brightness gradients и тот же cache. Focus/Escape text lifecycle
использует app snapshot. Поэтому Dither получает documented private range
variant, а не косметическую замену shared CSS.

### Sticky Fingers

У Sticky нет range companion: его 40 native number fields нельзя включать в
range rollout статистически или визуально. Наличие неиспользуемых slider rules
в stylesheet не является основанием создавать range DOM.

## 6. Rollout order

| ID | Шаг | Допустимый diff |
|---|---|---|
| UPG-054k | Pulsar ordinary range canary | удалить active normal/hover/focus duplicate, оставить только reset-safe 6 px top-margin bridge; visual/runtime diff должен быть нулевым |
| UPG-054l | Sparky, Wordplayer, Keyboarder verification | source-boundary tests и browser states; production CSS не менять |
| UPG-054m | Wander ordinary rollout | удалить normal duplicate; сохранить и проверить scoped disabled overrides/Auto/Max |
| UPG-054n | Pizza ordinary rollout | удалить только ordinary duplicate, пересобрать 15 assets; HSB и history оставить private |
| UPG-054o | HSB boundary | подтвердить девять shared HSB и три private Pizza HSB; gradients/color/output exact |
| UPG-054p | Dither private adapter + Sticky zero-range boundary | CSS presentation не менять; закрепить raster-safe variant и отсутствие active Sticky ranges |
| UPG-054q | Range component gate | все 122 классифицированы; app suites, isolation и Gate G4 green |

Pulsar выбран первым canary, потому что его восемь ranges однородны, используют
shared controller и canonical 8 px skin, не имеют HSB, disabled, dynamic limits,
history transactions или raster output. Его local ordinary block дублирует
framework по computed values; expected visual diff — строго нулевой.

### Результат UPG-054k

Canary завершён. Из `pulsar_coder/css/yf-styles.css` удалены active
thumb/track/hover/focus и все ordinary base declarations, кроме узкого
`margin-top: 6px` bridge над unlayered universal reset. Controller, configs,
dead HSB block и app stylesheet не менялись.

На 1280×720 до/после побайтно совпали normal `acef24e6…`, hover `5ee75df2…`
и focus `956b1176…` captures. Совпадают восемь range objects с min/max/step,
252×10 rect и computed 6/0 px margins, все panel/canvas rect, 22 input/select
states и SVG 40 180/hash `97155e5a…`. Live range 14→15 изменяет display/SVG,
15→14 возвращает exact SVG; draft 999 + Escape возвращает 14, Arrow даёт 15,
Enter восстанавливает baseline. Восемь Pulsar tests, isolation и Gate G4
проходят.

### Результат UPG-054l

Sparky, Wordplayer и Keyboarder подтверждены verification-only; production
sources не менялись. Boundary tests фиксируют отсутствие private thumb/track
skin, 24/20/0 static ordinary ranges и shared three-range `ColorPicker`.
Wordplayer сохраняет только scoped `#formsPanel ... { width: 100%; }` layout
extension для восьми compact controls.

Browser 1280×720 подтверждает:

- Sparky: 27 runtime ranges, ordinary 260×10 с margins 6/12 px, HSB 244×10,
  picker 260×164; 5→6→5 возвращает exact 26 806-character SVG, dock
  `headColorHsbSlot`→`eyeColorHsbSlot` работает;
- Wordplayer: 23 runtime ranges; восемь Forms controls по 120×10, panel 300×513,
  Canvas CSS 1280×720/backing 2560×1440; focus и 25→26→25 возвращают exact
  inputs/panels, picker docks в `bgColorHsbSlot`. Forms screenshot не является
  byte baseline из-за продолжающейся simulation, поэтому rollback опирается на
  state/panel/canvas contract и clean mode restore;
- Keyboarder: три HSB ranges по 244×10, Colors 300×453 с picker 260×161;
  gradients и docking между color rows работают. Ручной HSB round-trip
  существующе нормализует achromatic `#aaaaaa` в `#ababab`; clean reload
  возвращает exact 133 295-character SVG и исходный `#aaaaaa`.

App suites, isolation и Gate G4 проходят. Отсутствие Sparky production diff
сохраняет принятые 390×844/430×932 mobile baselines; их behavior покрыт полной
196-test suite.

### Результат UPG-054m

Wander Bender завершён с нулевым visual/runtime diff. Из frozen skin удалены
ordinary base/thumb/track/hover/focus declarations; остался 6 px top-margin
bridge над universal reset. `wander-bender.css` по-прежнему владеет disabled
pair: range opacity 1/pointer/white thumb, display 0.3/`not-allowed`.

На 1280×720 совпали normal capture `47dacdc3…`, все 19 ranges с 260×10 rect,
48 controls и panel 300×605.703. Radial/Random/Flow captures
`47dacdc3…`/`69223381…`/`4f141f60…` и SVG lengths 1 838/12 261/26 292
совпадают побайтно. Auto off/on, Max off/on и width 30 дают те же stroke 25,
corner max/value 15 и disabled states; reload возвращает width 25, source
Auto/Max state и exact Radial SVG. Десять tests проходят.

### Результат UPG-054n

Pizza Boxer переведён на shared ordinary range presentation с нулевым
visual/runtime diff. Из `styles/controls.css` удалены только ordinary
base/thumb/track/hover/focus declarations; сохранён 6 px top-margin bridge над
unlayered universal reset. Private `.hsb-control-group` block, 8 px HSB thumb,
dynamic gradients, `SliderController` и `SliderHistoryController` не менялись.
Reproducible build снова содержит ровно 15 public assets.

На 1280×720 old cached runtime и новый runtime побайтно совпадают в default
`7e902c4c…`, hover `d3518732…`, focus `13cb4e1e…` и открытом HSB picker
`d3332fc7…`. Совпадают все 29 range states, 113 form states, panel/surface
geometry и SVG 94 374/hash `4abbde0d…`. При одинаковой раскладке панелей
Graphics 300×451 и Paragraph 300×680 также дают byte-identical captures,
одинаковые editor inputs/ranges/panels и exact 94 384-character SVG.

Live 5→6→5 state одинаков до/после; clean reload возвращает baseline. Pointer
drag нельзя надёжно синтезировать текущим browser driver, поэтому transaction
contract подтверждён специализированными tests: один history action на mouse
gesture, commit на document `mouseup` вне slider и независимые focus/blur
keyboard transactions. Полная Pizza suite проходит 167/167.

### Результат UPG-054o

HSB boundary закрыт verification-only: production CSS/runtime/HTML не менялись.
Sparky, Wordplayer и Keyboarder создают по три ranges из одного shared
`ColorPicker`; все девять имеют 244×10 rect, 12 px thumb, transparent track и
shared focus/hover. Pizza оставляет три private 260×10 ranges, 8 px thumb и
app-owned 10 px dynamic track styles. Framework unit test теперь отдельно
фиксирует integer HSB values, gradients, silent HEX sync и callback lifecycle.

Browser acceptance подтверждает shared picker 260×164 в Sparky и 260×161 в
Wordplayer/Keyboarder, rainbow Hue и зависимые Saturation/Brightness gradients.
Saturation 0→100 обновляет HEX `#ffffff`→`#ff0000` в Sparky/Wordplayer и
`#1e1e1e`→`#1f0000` в Keyboarder; SVG меняется и clean reload возвращает exact
Sparky 26 806-character и Keyboarder 133 295-character markup. Один picker
корректно docks head→eyes→head, ink→background→ink и cap→guide→cap.

Pizza при 213/40/85 открывает private picker 260×135.5, меняет saturation
40→50 и HEX `#82A9D9`→`#6c9dd9`, создавая scoped 10 px track/8 px thumb styles;
возврат через control к 40 и HEX `#82A9D9` восстанавливает exact 94 380-character
SVG. Существующая integer HSB quantization (`#336699`→`#326699`) явно
закреплена как color behavior, не range regression. Framework 36/36 и Pizza
167/167 tests проходят.

### Результат UPG-054p

Два исключения закрыты без production diff. Dither сохраняет все 13 ranges как
private raster-safe variant: десять ordinary и три HSB, 1 px track, 10 px thumb
с `-4.5px` centering и hover `scale(1.3)`. Boundary test фиксирует 16 ms
debounce для шести raster-processing controls, immediate transform/rotation
paths, private formatting и cache invalidation. Ранее принятые byte-identical
default/Bayer/Pixel Size 4 Canvas baselines остаются применимы, поскольку после
UPG-054h production sources Dither не менялись. Suite проходит 11/11.

Sticky Fingers подтверждён как zero-range boundary: 39 static + один dynamic
native number input и ноль active ranges/value displays. Dormant legacy range
CSS намеренно не удаляется в component rollout и теперь отмечен тестом до
отдельного dead-CSS cleanup. Normal/edit/editor/SVG evidence UPG-054i остаётся
точным; Google Sheets по-прежнему единственное user-initiated network
исключение. Suite проходит 5/5.

### Результат UPG-054q

Range component gate закрыт. Новый `npm run check:ranges` включён первым шагом
в `gate:g4:static` и проверяет одновременно DOM inventory и CSS ownership:
97 shared ordinary + 9 shared HSB + 16 private = 122; Sticky Fingers = 0
active. Shared-ordinary приложения не могут незаметно вернуть private
thumb/track selectors, а Pizza/Dither/Sticky variants имеют явные assertions.

Полный Gate G4 проходит: source manifest, 11 shared assets и три pinned
downloads, framework provenance, storage isolation, 434-file runtime boundary,
36 framework tests и все восемь app suites, включая Pizza public 15-asset
runtime, Sparky 196, Pizza 167 и Dither 11. `git diff --check` clean. Range
rollout завершён; toggle/segmented controls начинаются только отдельной matrix.

## 7. Acceptance checklist

Для каждого приложения до и после изменения фиксируются:

1. normal screenshot, все input values/checked/disabled/min/max/step;
2. rect range, связанного display, label, panel и SVG/Canvas surface;
3. hover thumb state без изменения value/history;
4. keyboard focus ring и отсутствие outer outline;
5. pointer click/drag, live update и release/commit;
6. native range Arrow step и display Arrow/Shift+Arrow, Enter, blur, Escape;
7. collapsed/hidden mode restoration;
8. generated SVG/Canvas hash или byte-equivalent export invariant;
9. app tests, `npm run check:isolation`, `git diff --check`;
10. при shared CSS change — полный `npm run gate:g4:static` и Sparky desktop/
    390×844/430×932 acceptance.

Дополнительно:

- Pizza: ровно один history action на drag, document mouseup commit, undo/redo,
  Paragraph/Graphics editor state и 15-asset reproducible build.
- Wander: startup disabled pair, Auto off/on, Max off/on, width-driven dynamic
  max и Radial/Random/Flow SVG.
- HSB: hue/saturation/brightness gradients до/после, picker open/close/dock,
  hex sync и output color.
- Dither: default, Bayer, Pixel Size 4, modal state, exact Canvas bytes и PNG
  path; любой raster diff означает rollback.
- Sparky: desktop плюс обе согласованные mobile widths.

## 8. Rollback criteria

Изменение немедленно откатывается внутри `upgrade`, если обнаружено хотя бы
одно из следующего:

- unexplained thumb/track/focus/disabled visual difference;
- изменение range/display/panel/surface rect;
- новое или потерянное event срабатывание;
- другой `min`/`max`/`step`, clamp, format или restored value;
- разрыв Pizza transaction/undo, Wander Auto/Max или Sparky placement state;
- другой SVG/Canvas/export результат;
- Dither raster hash отличается даже при совпадающем DOM;
- новый network/storage/path boundary или изменение вне `upgrade`.

После UPG-054q можно начинать отдельную toggle matrix. Range rollout не даёт
разрешения попутно унифицировать toggle или segmented controls.
