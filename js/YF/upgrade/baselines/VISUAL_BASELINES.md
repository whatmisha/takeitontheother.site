# Visual Baselines

Исходная проверка выполнена через локальный HTTP server и browser viewport. Runtime-файлы при проверке не изменялись.

Машинно-читаемые размеры, panel geometry и console warnings находятся в [BROWSER_CAPTURE.json](./BROWSER_CAPTURE.json). Исходные изображения находятся в [`screenshots/`](./screenshots/): восемь desktop-снимков 1440×900 и два mobile-снимка Sparky.

## Общий desktop профиль

- viewport: 1440×900;
- ждать `document.fonts.ready`;
- ждать завершения initial render;
- фиксировать screenshot, console, network и размеры surface/panels.

## Исходные наблюдения

| Инструмент | Desktop baseline |
|---|---|
| Dither | Canvas и обе панели отображаются; document выше viewport и вертикально прокручивается |
| Pizza Boxer | Заполняет viewport; панели Dimensions, Grid, Sides, Text Styles и Objects доступны |
| Keyboarder | Рабочая область и панели General, Layers, Type, Colors отображаются стабильно |
| Sticky Fingers | В default mode видна Data Import; Edit Mode раскрывает дополнительные панели; существует EAN-13 checksum warning |
| Pulsar Coder | SVG и панели Main/Encoding/Visual отображаются |
| Sparky | Четыре панели и сцена отображаются без исходных console errors |
| Wander Bender | Одна control panel, три режима; Paper.js загружается извне |
| Wordplayer | Canvas и панели отображаются; DPR-aware surface; исходных console errors нет |

## Sparky mobile baseline

Обязательные viewport:

- 390×844;
- 430×932.

Обязательные states:

- initial mobile showcase;
- default preset;
- каждый основной mode;
- focus editor, если доступен в mobile flow;
- export entry point;
- orientation/resize;
- возврат после background;
- отсутствие горизонтального overflow.

## Не являющиеся задачей текущей миграции mobile-наблюдения

- Dither: значительный горизонтальный overflow и большой overlay;
- Sticky Fingers: небольшое превышение viewport width;
- Pizza Boxer, Keyboarder, Pulsar Coder и Wander Bender: панели перекрывают surface;
- Wordplayer: панели остаются desktop-oriented.

Эти особенности фиксируются как baseline и не исправляются до отдельной mobile-фазы, которая сейчас предусмотрена только для Sparky.

## Правило visual changes

Новый screenshot baseline нельзя принять автоматически. Любое отличие должно быть просмотрено и классифицировано. Паритетная миграция не должна менять DOM structure, panel geometry, typography или initial artboard без отдельного решения.

Текущий набор изображений считается immutable для Gate G1–G4. Новые состояния можно добавлять отдельными файлами, но существующие изображения нельзя перезаписывать в задаче, которая меняет UI.
