# G9 — Control rhythm correction

Дата: 2026-09-05.

## Причина

G8 проверял общую типографику, панели и ActionDock, но не зафиксировал
вычисленную геометрию каждой стопки контролов. Локальный cascade оставлял
разные вертикальные ритмы: эталонные группы Sparky/Wordplayer имели высоту
47 px, а Pizza/Pulsar/Wander — около 39–40 px; Dither сохранял 1 px input box
и увеличенный отрыв подписи.

Дополнительно обнаружены разные top padding панелей, белый вместо `#d2d2d2`,
13,6 px заголовки секций и segmented-кнопки высотой 30/34/49 px.

## UPG-086 — Shared control rhythm

Статус: **Complete**.

- обычные slider stacks: label-to-slider 8 px, range box 10 px, margins
  6/12 px, group margin 12 px;
- panel content: `0 20px 20px`;
- section heading: 14,4 px и 8 px снизу;
- segmented label: ровно 30 px, единый border-box и однострочный текст;
- текст общих панелей и выбранные светлые сегменты: `#d2d2d2`;
- уникальные multi-range, HSB gradients, renderers и domain logic сохранены.

## UPG-087 — Navigation and hub naming

Статус: **Complete**.

- back link во всех восьми приложениях: `← Upgrade Tools`;
- hub переименован в `YF Tools`, основной раздел — `Lunnen`;
- добавлен раздел `Muted`;
- будущие Lunnen/Muted инструменты показаны полупрозрачным текстом без ссылок.

## UPG-088 — Gate G9

Статус: **Complete**.

Все восемь desktop entrypoints и Sparky 390×844 приняты в браузере. Полный
`gate:g8:static` и новый машинный контракт G9 остаются зелёными.
