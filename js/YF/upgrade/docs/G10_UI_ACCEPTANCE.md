# G10 UI acceptance

Дата: 2026-09-05.

## Live checks

- Wordplayer Pixels: 20 px от Dark pixels до separator и 24 px от separator до
  первой строки pills; наложения нет.
- Keyboarder Layers: pills имеют `flex: 0 1 auto`, ширина зависит от текста,
  перенос сохраняется внутри 260 px content width.
- Pizza Boxer и Sticky Fingers: `Columns / Rows / Baseline` — общий
  `pill-toggle`, padding 5×12 px, без SVG/icon и border.
- Pizza checked toggle и Sticky toggle переключают исходные settings без
  module errors.
- Checked/hover pills имеют `rgb(210, 210, 210)`; inactive pills — тёмные.
- Все 8 desktop entrypoints: horizontal overflow 0, range overflow 0,
  `data-module-error` пуст.

## Regression

Пройдены `check:ui-contract`, `check:toggles`, Wordplayer, Keyboarder, Pizza
Boxer и Sticky Fingers suites. Полный результат фиксируется Gate G10.
