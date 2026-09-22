# G13 UI repair and zoom contract

Дата: 2026-09-05.

G13 исправляет обнаруженные после G12 расхождения, не меняя генеративные
алгоритмы, форматы документов и export output. Изменения остаются внутри
`js/YF/upgrade/**`.

## UPG-098 — zoom, shortcuts и Pizza Boxer

Статус: **Complete**.

- В пяти инструментах с pan/zoom (`Pizza Boxer`, `Keyboarder`, `Wordplayer`,
  `Pulsar Coder`, `Wander Bender`) процент на hover заменяется на `Fit` и после
  ухода курсора возвращает актуальное значение.
- Shared controller удерживает `Fit`, даже если Canvas owner обновляет процент
  во время hover.
- `⌘0` и `⌘1` удалены из активных SVG/Canvas/private zoom handlers и из меню
  шоткатов; browser zoom больше не перехватывается.
- Кнопка preset dropdown Pizza Boxer не меняет ширину при открытии.
- `Surface` в text/graphics object editors расположен над select через общий
  semantic class `stacked-select-label`.

## UPG-099 — Sticky Fingers controls

Статус: **Complete**.

- Background и Content color pickers получили по три настоящих HSB range с
  редактируемыми value displays, двусторонней синхронизацией и private dynamic
  gradients.
- Custom columns создают slider для каждой колонки. `auto/fixed`, размеры в mm,
  settings и перерасчёт сетки остаются private логикой Sticky Fingers.
- Data Import получил отдельные строки URL, test links, helper и Load Data с
  стабильными вертикальными интервалами.
- Основная Layout & Grid panel ограничена высотой viewport и прокручивается:
  нижние color controls больше не оказываются недоступными за границей окна.

## UPG-100 — Wander Bender и повторный audit

Статус: **Complete**.

- `Shape` и `Distribution` оформлены двумя визуальными секциями с тем же
  разделительным принципом, что Light/Dark groups Wordplayer.
- `auto` и `max` находятся рядом с названием параметра в `unit-buttons` и
  используют тот же presentation, что `mod/mm` Pizza Boxer.
- Интервал строк shortcut help увеличен с 7 до 9 px.
- Повторный browser audit всех восьми инструментов выявил ещё одно расхождение:
  Sticky/Pulsar/Wander показывали яркий широкий scrollbar. Общий UI contract
  теперь задаёт 6 px dark scrollbar всем panel contents.
- Новых app-specific font, toggle, action-dock или range presentation
  расхождений, требующих немедленной правки, после audit не найдено.

## Граница унификации

Framework владеет только hover/presentation и общими semantic classes. Он не
знает о Sticky color/settings model, Wander mode calculations или Pizza preset
documents. Старые документы в `grid_generator/docs/archive/legacy` могут
упоминать `⌘0`; это архив, а не активный runtime.
