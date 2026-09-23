# G12 OpenType feature controls

Дата: 2026-09-05.

G12 закрывает отложенное в G11 решение UPG-094. Меняются только подпись и
визуальные метрики контролов; OpenType tags, ids, состояние текстовых блоков,
рендеринг и export остаются частной логикой Pizza Boxer и Sticky Fingers.

## Где находятся контролы

### Pizza Boxer

Короткий путь: `Objects → text object → Lunnen Display → OpenType`.

1. Раскрыть панель `Objects`.
2. Выбрать текстовый объект.
3. В открывшемся редакторе выбрать стиль `Lunnen Display`.
4. Прокрутить редактор до секции `Lunnen Display`.

Секция скрыта для `Headline`, `Text` и `Caption`. В стартовом документе все три
текста используют `Text` или `Headline`, поэтому OpenType-контролы не видны до
смены стиля одного из объектов на `Lunnen Display`.

### Sticky Fingers

1. Включить `Edit Mode`.
2. В панели `Objects` выбрать текстовый объект.
3. Выбрать стиль `Lunnen Display`.
4. Прокрутить редактор до секции `Lunnen Display`.

## UPG-094 — общий presentation contract

Статус: **Complete**.

- Все 12 контролов имеют общий класс `feature-chip` поверх сохранённого
  семантического семейства `toggle-chip`.
- Общие метрики: `12.8 px`, weight `500`, min-height `24 px`, padding `4×10 px`.
- Checked state использует общий `#d2d2d2`; технические имена `salt`, `aalt`,
  `ss01`, `ss02`, `tnum`, `dlig` не переименованы.
- Локальный override Sticky Fingers удалён; источник presentation теперь один —
  `framework/css/ui-contract.css`.

## UPG-096 — discoverability

Статус: **Complete**.

- В обоих инструментах над тегами появилась явная подпись `OpenType`.
- Условный путь появления секции зафиксирован выше: свойства относятся к
  выбранному текстовому объекту и показываются только для `Lunnen Display`.

## Граница унификации

Framework знает только presentation-класс `feature-chip`. Он не знает названий
OpenType tags и не меняет glyph substitution. Контроллеры, сериализация,
перерисовка и export остаются внутри каждого приложения.

## Изоляция

Изменения ограничены `js/YF/upgrade/**`. Runtime Pizza Boxer воспроизводимо
пересобран из локального source. Исходные `lunnen`, внешний framework, Void и
`lunnen/sparky/stages` не менялись.
