# G9 UI acceptance

Дата: 2026-09-05.

## Desktop 8/8

Для всех восьми приложений подтверждены:

- `← Upgrade Tools` с пробелом после стрелки;
- отсутствие горизонтального overflow и console errors;
- panel content `0 20px 20px` и цвет `rgb(210, 210, 210)`;
- все видимые обычные range inputs: высота 10 px, margins `6px/12px`;
- все видимые segmented labels: высота 30 px;
- Pizza Boxer пересобран из source fragments.

Количество проверенных видимых обычных ranges: Sparky 11, Pizza Boxer 20,
Wordplayer 11, Dither 10, Wander Bender 7, Pulsar Coder 8. Sticky Fingers
сохраняет нулевую range-boundary, Keyboarder — частный color picker без
видимых обычных range stacks.

## Sparky mobile

Viewport 390×844: horizontal overflow отсутствует, панели скрыты, ActionDock
центрирован с bottom offset 12 px, back link обновлён.

## Hub

Заголовок страницы — `YF Tools`; разделы — `Lunnen` и `Muted`. В Lunnen
активными ссылками остаются ровно восемь принятых инструментов. Hyperspace,
Pattern 01, Pattern 02, Random Lines, Rays Pattern, Asterisk Pattern, Calendar
Randomizer и Chladni Sound Pattern представлены disabled-текстом без `href`.
