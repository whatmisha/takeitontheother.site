# G11 UI acceptance

Дата: 2026-09-05.

## Live checks

- Sparky: `Manual` отсутствует; `Follow cursor` true → false → true.
- Sparky: unchecked показывает одну focus drag handle, checked скрывает её.
- Sparky summary: `Static · Follow` → `Static · Fixed` → `Static · Follow`.
- Pizza Boxer: `Visible`, `Own Grid`, `Sides`, `Objects` — `pill-toggle`, border
  0; checked background `rgb(210, 210, 210)`; eye icon count 0.
- Pizza Boxer: `Width / Height` — общий segment, labels 30 px, padding 6×8 px,
  14.4 px type; radio exclusivity сохранена.
- Dither: Reset 36 px, border 0, weight 500 и нейтральный focus ring; введённый
  Position X 25 после нажатия Reset возвращается в 0.
- Dither: нажатие color trigger продолжает открывать HSB picker.
- Все 13 color triggers шести color-enabled tools: 30×30 px, padding 6 px,
  `background-clip: content-box`, border 0.
- У всех проверенных entrypoints `data-module-error` пуст и horizontal overflow 0.

## Static and domain checks

- `check:ui-contract` и `check:toggles` фиксируют новый общий контракт.
- Sparky: 200/200 tests.
- Framework: 69/69 tests.
- Pizza Boxer: source/public runtime sync и domain suite проходят.
- Dither: 14/14 tests; private raster/export code не менялся.
- Полный cumulative regression фиксируется командой `npm run gate:g11:static`.
