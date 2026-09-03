# Post-G6 release-readiness audit

Дата: 2026-09-03.

## Scope

После закрытия Gate G6 все восемь автономных entrypoints повторно проверены на
`http://127.0.0.1:8010/upgrade/`. Проверка выполнялась на чистой загрузке страниц
и не изменяла production source, storage namespaces или network boundary.

## Общий ActionDock

- все 8/8 dock отображаются и центрированы относительно окна с `centerDelta = 0`;
- нижний отступ всех dock равен 20 px;
- горизонтальный overflow отсутствует во всех восьми инструментах;
- у всех восьми primary export доступен и подписан как `SVG ⌘E`, `PDF ⌘E`
    или `PNG ⌘E` в зависимости от основного формата инструмента;
- дополнительные действия остаются внутри того же dock;
- browser/module errors: 0 во всех восьми entrypoints.

## JSON actions и shortcuts

JSON actions существуют только там, где инструмент поддерживает соответствующий
private format:

| Инструмент | Скрыто при загрузке | После `J` | После повторного `J` |
|---|---:|---:|---:|
| Sparky | 1 | 1 visible | 1 hidden |
| Pizza Boxer | 2 | 2 visible | 2 hidden |
| Sticky Fingers | 2 | 2 visible | 2 hidden |
| Keyboarder | 2 | 2 visible | 2 hidden |

Маршрутизация `⌘/Ctrl+E`, `⌘/Ctrl+J` и `⇧⌘/Ctrl+J`, игнорирование editable
targets и предотвращение двойной обработки закреплены тестом
`framework/tests/action-dock.test.mjs`. Wordplayer, Dither, Wander Bender и
Pulsar Coder не получают искусственных JSON actions.

## Живой output smoke

- Sparky, Pizza Boxer, Sticky Fingers, Keyboarder, Wander Bender и Pulsar Coder
  показывают непустой SVG output;
- Wordplayer показывает непустой Canvas output;
- Dither показывает оба рабочих Canvas surface;
- все страницы достигли `document.readyState = complete`;
- видимые primary actions: Sparky/Keyboarder/Wordplayer/Wander/Pulsar/Pizza —
  SVG, Sticky — PDF, Dither — PNG.

## Verdict

UPG-070 принят. Пост-G6 desktop regression не выявил новых дефектов. Gate G6
остаётся release boundary; дальнейшие продуктовые изменения должны начинаться
с отдельного G7-плана и не менять принятые output/storage/isolation контракты
неявно.
