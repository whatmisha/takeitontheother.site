# G8 UI acceptance

Дата: 2026-09-05.

Проверены восемь live entrypoints на локальном сервере и Sparky в мобильном
viewport 390×844. Ошибок загрузки модулей и горизонтального overflow нет.

## Общие результаты

- вычисленный UI font-family во всех инструментах: `-apple-system, system-ui,
  Inter, "Segoe UI", Roboto, sans-serif`;
- видимые UI-тексты используют только веса 400 и 500;
- фон `Upgrade Tools` во всех инструментах — `rgb(210, 210, 210)`;
- центр каждого ActionDock совпадает с центром viewport; desktop bottom offset
  20 px, mobile Sparky — 12 px;
- в каждом ActionDock ровно одна кнопка `?`; About, How it Works и инструкции
  отсутствуют;
- `⌘/Ctrl+\\` сворачивает только обычные панели до фиксированных 47 px и
  восстанавливает только ранее раскрытые;
- длинная сводка не меняет высоту или ширину панели: единицы и подписи
  сокращаются по смыслу, остаток ограничен одной строкой с ellipsis;
- быстрый экспорт получает мягкое неблокирующее подтверждение, долгий экспорт
  сохраняет состояние выполнения до завершения владельцем инструмента.

## Сводки

Сводки добавлены в Sparky, Pizza Boxer, Sticky Fingers, Keyboarder, Wordplayer,
Pulsar Coder и Wander Bender. Нативные сводки Dither сохранены. В Pizza Boxer и
Sticky Fingers редакторы `Paragraph Settings`/`Add Graphics` остаются
close-only и не участвуют в глобальном collapse.

## Sparky mobile sentinel

При 390×844: SVG занимает 390×844, ActionDock центрирован, горизонтальный
overflow равен нулю, desktop-панели скрыты. Специфические Play/Guides команды
остались в capability-based меню хоткеев.

Известное исходное предупреждение Sticky Fingers о checksum EAN-13 сохранено и
не является ошибкой G8.
