# Формат JSON-пресета 2.0

`Export Setup` сохраняет полное редактируемое состояние документа. Текущий
формат — `2.0`; он описывает развёртку как произвольный набор плоскостей.
Файлы версии `1.2` по-прежнему читаются: они валидируются по своему контракту,
затем автоматически поднимаются до `2.0`. Записывается всегда только `2.0`.

Контракты лежат в `schemas/preset-2.0.schema.json` и
`schemas/preset-1.2.schema.json`. Ajv генерирует из них автономные
runtime-проверки командой `npm --prefix tools run schema`.

## Верхний уровень

```json
{
  "presetName": "Airis 14\" Back",
  "version": "2.0",
  "timestamp": "2026-08-12T00:00:00.000Z",
  "dimensions": {},
  "net": {},
  "texts": [],
  "grid": {},
  "colors": {},
  "typography": {},
  "display": {},
  "graphics": {}
}
```

- `dimensions` — width, height, thickness в миллиметрах. Это же переменные
  `W`, `H` и `D`, на которые ссылаются плоскости.
- `net` — развёртка: корневая плоскость, переменные и список плоскостей.
- `texts` — контент, стиль, позиция, плоскость `plane`, размеры, выравнивание,
  видимость, блокировка, слой `layer` и индивидуальные font features.
- `grid` — мастер-сетка: модуль, поля и их единицы, колонки, строки, row height,
  link mode, locks и видимость слоёв сетки.
- `colors` — фон документа.
- `typography` — единицы и полные стили Headline, Text, Caption и
  Lunnen Display: size, lineHeight, tracking, метрика и weight, где применимо.
- `display` — dimensions, labels, sides и objects.
- `graphics` — пользовательские блоки и встроенные `icons`/`claim`/`claim2026`
  со всеми настройками плоскости, размера, позиции и слоем `layer`.

## Развёртка (`net`)

```json
{
  "rootId": "front",
  "variables": { "flapDepth": 12 },
  "planes": [
    {
      "id": "front",
      "name": "Front",
      "kind": "panel",
      "size": { "width": "W", "height": "H" },
      "attach": null,
      "contentRotation": 0,
      "grid": { "mode": "inherit", "own": {} },
      "visible": true
    },
    {
      "id": "left",
      "name": "Left",
      "kind": "panel",
      "size": { "width": "D", "height": "fit" },
      "attach": { "to": "front", "edge": "left", "align": "start", "offset": 0 },
      "contentRotation": 90,
      "grid": { "mode": "inherit", "own": {} },
      "visible": true
    }
  ]
}
```

- `rootId` — плоскость без привязки; с неё начинается раскладка.
- `variables` — именованные размеры документа. `W`, `H` и `D` зарезервированы и
  читаются из `dimensions`, поэтому в `variables` попадают только собственные.
- `size.width` / `size.height` — миллиметры, имя переменной или `fit`
  («по длине родительского ребра»).
- `attach` — к какой плоскости, за какое ребро, с каким выравниванием и
  смещением примыкает плоскость. У корня всегда `null`.
- `contentRotation` — поворот содержимого плоскости: 0, 90, 180 или 270.
- `grid.mode` — `inherit` (сетка выводится из мастер-сетки по размеру
  плоскости) или `own` (используется `grid.own`).
- `kind` — `panel`, `flap` или `glue`; влияет на подписи и назначение, но не на
  геометрию.
- Порядок плоскостей в массиве задаёт порядок отрисовки и приоритет попадания
  курсора: последняя плоскость рисуется поверх и перехватывает клик первой.

Количество плоскостей не ограничено пятёркой: коробка «крест» — это просто
документ по умолчанию.

## Миграция 1.2 → 2.0

Пять фиксированных граней превращаются в тот же крест: `front` становится
корнем, остальные примыкают к его рёбрам с размерами `D`/`fit`. Видимость,
`rotation` → `contentRotation` и собственные сетки переносятся один к одному,
`gridMode: "main"` становится `grid.mode: "inherit"`. Поле объекта `surface`
переименовывается в `plane`. Выключенный `display.sidePanels` раскладывается в
`visible: false` на каждой неосновной плоскости.

Пресеты в репозитории приводятся к текущей версии командой
`npm --prefix tools run presets:migrate`; `presets:format` проверяет, что все
файлы уже на `2.0`, и входит в `source:check`.

## Прочее

`layer` — общий целочисленный порядок для текста и графики: меньшее значение
рисуется раньше, большее оказывается ближе к зрителю. Поле необязательно; при
импорте редактор присваивает совместимый порядок и добавляет его при следующем
Export Setup.

SVG пользовательской графики хранится внутри JSON. На импорте он проходит
санитайзер: исполняемые элементы, event handlers и внешние ссылки удаляются.

IndexedDB-черновик не является частью формата пресета и не заменяет JSON. Он
хранится только в браузере для аварийного Restore/Discard и удаляется после
успешного Export Setup или явного Discard. Черновик — это снимок `Settings` и
документа объектов, поэтому развёртка попадает в него целиком через
`settings.planeDocument`.

## Источник истины и код

- Сериализация: `src/preset/PresetDocumentSerializer.js`.
- Валидация: `schemas/preset-2.0.schema.json` и `schemas/preset-1.2.schema.json`;
  тонкий адаптер ошибок — `src/preset/PresetSchemaValidator.js`.
- Миграция: `src/preset/PresetMigrations.js`.
- Десериализация: `src/preset/PresetDocumentDeserializer.js`.
- Порядок «валидация → миграция → валидация → документ»:
  `src/preset/PresetFormatAdapter.js`.
- Файловый codec: `src/svg/PresetFileCodec.js`.
- Применение к документу: `src/preset/PresetApplicationController.js`.
- Модель развёртки: `src/surfaces/PlaneDefinition.js`,
  `src/surfaces/PlaneDocumentStore.js`, `src/surfaces/NetLayoutEngine.js`.

Добавление нового редактируемого параметра требует явного обновления
serializer, schema, deserializer, генерации валидатора и round-trip теста.
Автоматического экспорта произвольных полей `Settings` нет — это защищает формат
от случайного изменения внутренней модели.

## Ручное редактирование

Копирайтеру безопаснее менять только `texts[].content`. При изменении сетки,
типографики, SVG, развёртки или объектов обязательно выполнить импорт в
редактор, повторный экспорт и `npm --prefix tools test`.
