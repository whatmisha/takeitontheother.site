# G13 UI acceptance

Дата: 2026-09-05.

## Browser checks, 1280×720

- Все восемь entrypoints открыты через локальный `/upgrade/` server.
- В пяти zoom-инструментах click/hover показывает `Fit`; Wordplayer не
  перезаписывает label обратно в `100%` во время hover.
- Pizza Boxer: открытый preset menu сохраняет ширину trigger; `Surface` стоит
  отдельной строкой над `Front` select.
- Sticky Fingers: Data Import имеет раздельные URL/test-link строки; custom
  column переключается `auto → fixed`, slider меняет `30.00 → 35.00` и value
  display синхронизируется.
- Wander Bender: видны отдельные `Shape`/`Distribution`; `auto/max` совпадают с
  compact unit buttons.
- Shortcut popup не содержит `Fit / actual size` и `⌘0 / ⌘1`.
- Sparky, Keyboarder, Wordplayer, Dither и Pulsar Coder повторно осмотрены:
  panels, sliders, pills, action docks и primary canvas остаются рабочими.

## Automated checks

- framework: 70/70;
- Pizza Boxer: 172/172 и reproducible 14-asset runtime;
- Sticky Fingers: 10/10;
- Wander Bender: 12/12;
- `check:ui-contract`, `check:ranges`, `check:toggles` проходят.

Полный cumulative regression выполняет `npm run gate:g13:static`.
