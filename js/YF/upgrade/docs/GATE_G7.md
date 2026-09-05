# Gate G7 — release hardening acceptance
Status: **Complete** (2026-09-05).

Gate G7 принимает этапы UPG-071—UPG-079 и сохраняет Gate G6 как обязательную
регрессионную границу. Изменения ограничены `upgrade/**`.

## Automated evidence

`npm run gate:g7:static` завершился с кодом 0 и включает:

- полный `gate:g6:static`, включая filesystem/network/storage isolation;
- 64/64 framework, 200/200 Sparky и 172/172 Pizza Boxer tests;
- все Wordplayer, Keyboarder, Sticky Fingers, Dither, Pulsar Coder и Wander
  Bender suites;
- export acceptance и artifact suites всех восьми инструментов;
- bidirectional JSON round-trip, explicit Sparky export-only contract и asset
  intake;
- persistence/recovery rollback, keyboard/accessibility и runtime resilience;
- 12 balanced Blob URL owners и шесть lifecycle proofs.

## Live evidence

- 24/24 desktop cold/warm loads и 6/6 Sparky mobile loads;
- 5 priority + 3 secondary workflows приняты;
- console errors, resource 404, horizontal overflow и stuck busy states: 0;
- Sparky 390×844/430×932 сохраняет centered ActionDock и private mobile
  showcase;
- Pizza Boxer repeated JSON import теперь реально применяет нормализованный
  документ без второго deserialize и сходится к стабильному output;
- Sticky EAN-13 warning и Pulsar legacy verifier mismatch остаются явно
  документированными исходными особенностями.

## Release boundary

G7 не переносит private renderer/schema/parser/history в framework, не меняет
оригинальные Lunnen namespaces и не добавляет runtime-зависимости за пределами
Upgrade. Google Sheets остаётся единственным внешним runtime и вызывается только
явным действием пользователя в Sticky Fingers.
