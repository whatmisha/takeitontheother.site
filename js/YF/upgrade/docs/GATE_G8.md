# Gate G8 — единый UI-контракт

Дата: 2026-09-05. Статус: **Passed**.

G8 закрывает UPG-081—UPG-085 поверх полностью сохранённого G7.

## Проверяемый контракт

- восемь entrypoints подключают `ui-contract.css` и общий auto-init;
- UI использует системный стек без Arial/TT Commons и только веса 400/500;
- одинаковые навигация, ActionDock, shortcut help, collapse и export feedback;
- свёрнутые панели имеют фиксированные 47 px и однострочные умные сводки;
- About/инструкции удалены, частные renderer/export/import/storage остаются у
  приложений;
- все G0—G7 isolation, domain, artifact, round-trip, persistence, keyboard и
  resilience проверки продолжают проходить.

## Команда

```sh
npm run gate:g8:static
```

Живая desktop/mobile проверка записана в `G8_UI_ACCEPTANCE.md`.
