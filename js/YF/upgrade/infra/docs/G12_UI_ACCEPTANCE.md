# G12 UI acceptance

Дата: 2026-09-05.

## Live checks

- Pizza Boxer: при стартовых стилях `Text / Text / Headline` секция OpenType
  скрыта; после `Objects → text → Lunnen Display` показана как `display: block`.
- Pizza Boxer: видны подпись `OpenType` и шесть тегов `salt / aalt / ss01 /
  ss02 / tnum / dlig`.
- Sticky Fingers: после `Edit Mode → Objects → text → Lunnen Display` видны та
  же подпись и те же шесть тегов.
- Оба инструмента используют одинаковую компактную геометрию и общий checked
  state; нажатия остаются checkbox-действиями приложения.
- Pizza Boxer не получает OpenType-контролы в общей панели `Text Styles`: это
  свойства конкретного текстового объекта, а не глобального стиля.

## Static and domain checks

- `check:ui-contract` фиксирует общую подпись, метрики и checked state.
- `check:toggles` фиксирует ровно 12 `feature-chip` и отсутствие локального
  Sticky Fingers override.
- Pizza Boxer: 172/172 tests; source/public 14-asset runtime совпадает.
- Sticky Fingers: 10/10 tests.
- Полный cumulative regression фиксируется `npm run gate:g12:static`.
