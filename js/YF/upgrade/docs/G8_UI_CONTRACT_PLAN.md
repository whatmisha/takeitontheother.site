# G8 — Единый UI-контракт

Дата начала: 2026-09-05.

## Цель

Унифицировать интерфейс восьми инструментов, не меняя их renderer, форматы
документов и частную логику. Sparky остаётся визуальным и поведенческим
эталоном; изменения разрешены только внутри `upgrade/**`.

## Контракт

- UI использует стек `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif`;
- допустимы только веса 400 и 500; Arial и TT Commons в UI запрещены;
- основной цвет текста и светлых кнопок — `#d2d2d2`;
- нижний ActionDock всегда центрирован; `?`, JSON-действия и опции находятся в нём;
- `?` показывает только актуальные хоткеи, без About и инструкций;
- `⌘/Ctrl+E` — основной экспорт, `J` — JSON extras, `⌘/Ctrl+J` — JSON export,
  `⇧⌘/Ctrl+J` — JSON import, `⌘/Ctrl+\\` — collapse/restore панелей;
- быстрый экспорт получает мягкое подтверждение без блокировки повторного клика;
- сводка свернутой панели занимает одну строку, сначала сокращается по смыслу,
  затем обрезается многоточием и никогда не меняет габариты панели;
- `Paragraph Settings` и `Add Graphics` в Pizza/Sticky остаются close-only.

## Этапы

### UPG-081 — Typography and color contract

Статус: **Complete**.

- общий финальный CSS-слой для всех восьми entrypoints;
- одинаковые кегли идентичных элементов, веса 400/500 и `#d2d2d2`;
- отдельные UI-токены, не меняющие цвета и шрифты генерируемой графики.

### UPG-082 — Shared interaction controller

Статус: **Complete**.

- единое меню хоткеев;
- общий collapse/restore по `⌘/Ctrl+\\`;
- единое неблокирующее export feedback;
- capability-based список: показывать только действия конкретного инструмента.

### UPG-083 — Compact panel summaries

Статус: **Complete**.

- добавить полезные сводки в панели без них;
- фиксировать collapsed geometry;
- проверить обновление на `input`, `change` и динамической подмене DOM.

### UPG-084 — Integration and cleanup

Статус: **Complete**.

- подключить общий слой во все восемь приложений;
- удалить/отключить About и How it Works surfaces;
- пересобрать Pizza Boxer из source fragments.

### UPG-085 — Gate G8

Статус: **Complete**.

- статическая проверка UI-токенов, весов, Arial, entrypoint wiring и shortcut contract;
- unit tests общих контроллеров;
- desktop-приёмка всех восьми инструментов и mobile-приёмка Sparky;
- полный `gate:g7:static` остаётся зелёным.

## Результат

Общий финальный CSS-контракт и `UnifiedUiController` подключены ко всем восьми
entrypoints. Частные renderer, форматы экспорта, JSON-схемы, загрузчики и
Google Sheets интеграция не переносились и не менялись. Приёмочные измерения
зафиксированы в `G8_UI_ACCEPTANCE.md`, машинная граница — в `GATE_G8.md`.
