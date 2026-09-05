# G10 UI variance audit

Дата: 2026-09-05.

Цель прохода — отличить случайные расхождения старых копий framework от
осмысленной частной специфики инструментов. Добавление новых разделителей и
компонентов не является самоцелью.

## Исправлено в G10

### UPG-089 — control regressions

Статус: **Complete**.

- Wordplayer: общий G9-сброс больше не уничтожает частный верхний отступ
  `.pixel-toggle-row`. Между группой Dark pixels и линией остаётся 20 px, между
  линией и pills — 24 px.
- Keyboarder: pills панели Layers снова имеют ширину по содержимому и свободно
  переносятся; локальный `flex: 1 1 auto` удалён.
- Pizza Boxer и Sticky Fingers: одинаковые `Columns / Rows / Baseline`
  используют общий `pill-toggle`, без eye icons и обводки.
- Checked/hover-состояние pills во всех приложениях использует `#d2d2d2`, а не
  частное значение `--color-text` конкретного проекта.
- Общий spacing-контракт получил явный атрибут `data-ui-custom-spacing` для
  редких составных групп. Это предотвращает повторение конфликта Wordplayer.

### UPG-090 — semantic variance audit

Статус: **Complete**.

Проверены восемь entrypoints, 115 native checkbox/radio controls, panel shells,
range stacks, pills, legacy chips, checkbox-label, color triggers, numeric
editors, select controls и panel actions.

## Следующая унификация: рекомендуется

### 1. Оставшиеся boolean chips Pizza Boxer

`Visible`, `Own Grid`, `Sides` и `Objects` всё ещё используют старый
`toggle-chip`; у трёх из них остаётся eye icon и тонкая обводка. Это обычные
boolean-настройки, поэтому их логично перевести в `pill-toggle`. При этом
surface orientation select и lock buttons должны остаться частными.

### 2. Цветовые триггеры

Sparky, Keyboarder и Wordplayer используют 18 px `.color-dot`; Pizza Boxer,
Sticky Fingers и Dither — 30 px `.color-preview`. Функция одинакова, различие
историческое. Рекомендуемый общий компонент: видимая точка 18 px внутри hit
area 30 px. Так сохраняются компактность эталонных инструментов и удобство
нажатия.

### 3. OpenType feature chips

Одинаковые `salt / aalt / ss01 / ss02 / tnum / dlig` в Pizza Boxer имеют
12 px type и padding 4×8 px, а в Sticky Fingers — 13.6 px и 4×12 px. Сами
feature tags стоит оставить отдельным семейством, но их метрики нужно вынести в
общий `feature-chip`.

### 4. Exclusive Width / Height в Pizza Boxer

Graphics editor оформляет взаимоисключающий выбор Width/Height как два
растянутых `toggle-chip`. Семантически это `segmented-control`; рекомендуется
мигрировать без изменения size-mode логики.

### 5. Dither Reset

Reset в Texture Transform — единственный обычный `.btn-secondary` с высотой
35 px и собственной обводкой; общий вариант имеет 36 px и без обводки.
Рекомендуется удалить старый локальный border/height delta.

## Различия, которые пока следует сохранить

- Keyboarder numeric editors остаются boxed-полями 26 px: в нём нет обычных
  range-контролов и точный числовой ввод является основным сценарием.
- Keyboarder Legend шириной 430 px остаётся шире обычной панели: это плотный
  составной редактор, а не обычный controls stack.
- `checkbox-label` остаётся для одиночных объяснимых booleans в Dither, Pulsar,
  Pizza Boxer и Sticky Fingers; кластерные booleans используют pills.
- OpenType feature tags не следует превращать в обычные pills: их короткие
  технические имена образуют отдельный тип данных.
- Разные file-intake surfaces сохраняют частные parsers и контекст: Google
  Sheets в Sticky, images/forms в Wordplayer, TTF/SVG в Keyboarder и graphics
  SVG в Pizza. Унифицируется оболочка и feedback, не процесс обработки.
- Pizza lock buttons, Wander Auto/Max и Sparky path editing остаются частными
  state buttons, потому что они встроены в специализированные контролы.

## Где полезны дополнительные смысловые группы

1. **Keyboarder / Layers:** `Content` для Keys, Legends, Icons и
   `Guides & diagnostics` для Guides, Columns, Index, Ink boxes, Slots,
   Reference, Diff, Blocks. Это самый полезный следующий кандидат.
2. **Sparky / Eyes:** `Geometry` для Size/Distance и `Expression` для
   Cute/Angry. Разделение улучшит чтение двух независимых пар.
3. **Dither / Texture Settings:** короткие группы `Tone`, `Pattern & raster` и
   `Display`. Делать только заголовки уже существующих sections, не добавляя
   новых контейнеров.
4. **Sticky Fingers / Barcode Styles:** `Code` и `Caption & quiet zone` —
   полезно, но менее приоритетно из-за небольшой длины панели.

Не рекомендуется добавлять новые группы в Wordplayer Forms (там уже есть Form
boundary, Letter flow и Gravity), Wander Bender, Pulsar Coder, Pizza Grid,
Sparky General и Sparky Colors: текущая структура там уже читается без
дополнительного визуального шума.

## Sparky Manual / Follow cursor

`Manual` не является лишней внутренней логикой: это состояние
`followCursor = false`, в котором показывается и перетаскивается постоянная
focus point, а Angle/Distance сохраняются в preset. Но отдельная pill `Manual`
действительно избыточна.

Просто удалить её нельзя: оставшийся radio `Follow cursor` невозможно снять
повторным нажатием. Безопасная замена — один checkbox/pill `Follow cursor`:

- checked: transient focus следует за курсором и не загрязняет history/preset;
- unchecked: включается manual focus и видимая drag handle;
- изменение Angle или Distance, как и сейчас, автоматически снимает Follow
  cursor и фиксирует положение.

При такой миграции функциональность не теряется; потребуются обновление
`bindManualFocusControls`, ARIA-семантики и теста complementary state.
