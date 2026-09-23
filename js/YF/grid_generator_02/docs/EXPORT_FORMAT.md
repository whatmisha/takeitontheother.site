# Формат JSON-пресета 1.2

`Export Setup` сохраняет полное редактируемое состояние документа. При импорте
поддерживается только версия `1.2`; это намеренное удаление legacy-веток.
Единственный контракт находится в `schemas/preset-1.2.schema.json`. Ajv
генерирует из него автономную runtime-проверку командой
`npm --prefix tools run schema`.

## Верхний уровень

```json
{
  "presetName": "Airis 14\" Back",
  "version": "1.2",
  "timestamp": "2026-08-12T00:00:00.000Z",
  "dimensions": {},
  "surfaces": {},
  "texts": [],
  "grid": {},
  "colors": {},
  "typography": {},
  "display": {},
  "graphics": {}
}
```

- `dimensions` — width, height, thickness в миллиметрах.
- `surfaces` — видимость, ориентация и собственная сетка каждой боковой грани.
- `texts` — контент, стиль, позиция, поверхность, размеры, выравнивание,
  видимость, блокировка, слой `layer` и индивидуальные font features.
- `grid` — модуль, поля и их единицы, колонки, строки, row height, link mode,
  locks и видимость слоёв сетки.
- `colors` — фон документа.
- `typography` — единицы и полные стили Headline, Text, Caption и
  Lunnen Display: size, lineHeight, tracking, метрика и weight, где применимо.
- `display` — dimensions, labels, sides и objects.
- `graphics` — пользовательские блоки и встроенные `icons`/`claim`/`claim2026` со всеми
  поверхностными, размерными, позиционными настройками и слоем `layer`.

`layer` — общий целочисленный порядок для текста и графики: меньшее значение
рисуется раньше, большее оказывается ближе к зрителю. Поле необязательно для
старых 1.2-файлов; при импорте редактор присваивает совместимый порядок и
добавляет его при следующем Export Setup.

SVG пользовательской графики хранится внутри JSON. На импорте он проходит
санитайзер: исполняемые элементы, event handlers и внешние ссылки удаляются.

IndexedDB-черновик не является частью формата пресета и не заменяет JSON. Он
хранится только в браузере для аварийного Restore/Discard и удаляется после
успешного Export Setup или явного Discard.

## Источник истины и код

- Сериализация: `src/preset/PresetDocumentSerializer.js`.
- Валидация: `schemas/preset-1.2.schema.json`; тонкий адаптер ошибок —
  `src/preset/PresetSchemaValidator.js`.
- Десериализация: `src/preset/PresetDocumentDeserializer.js`.
- Файловый codec: `src/svg/PresetFileCodec.js`.
- Применение к документу: `src/preset/PresetApplicationController.js`.

Добавление нового редактируемого параметра требует явного обновления
serializer, schema, deserializer, генерации валидатора и round-trip теста. Автоматического
экспорта произвольных полей `Settings` нет — это защищает формат от случайного
изменения внутренней модели.

## Ручное редактирование

Копирайтеру безопаснее менять только `texts[].content`. При изменении сетки,
типографики, SVG или объектов обязательно выполнить импорт в редактор,
повторный экспорт и `npm --prefix tools test`.
