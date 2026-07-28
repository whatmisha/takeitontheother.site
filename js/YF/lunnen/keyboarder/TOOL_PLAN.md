# Keyboarder — план реализации

Браузерный инструмент для верстки раскладок клавиатур. Автоматизирует пайплайн, описанный
в [PIPELINE.md](./PIPELINE.md): вместо ручной работы в Illustrator — декларативная модель раскладки
плюс генератор геометрии, охранных полей, легенд и оптической компенсации.

Документ описывает архитектуру и этапы от беты до про-версии. Он парный к `PIPELINE.md`:
`PIPELINE.md` фиксирует **что** мы делаем руками и какие законы этим управляют, `TOOL_PLAN.md` —
**как** это превращается в софт.

---

## 1. Физические единицы — зафиксировано

Замер по точному чертежу закрыл единственный открытый вопрос из § 15 `PIPELINE.md`:

```
10000 px = 3527.778 мм   →   1 px = 0.3527778 мм = 25.4/72 мм
```

Это ровно **72 dpi**, то есть 1 px SVG = 1 pt = 1/72 дюйма. Контрольная сверка на пробеле:
254.8513 px × 0.3527778 = **89.9059 мм** против измеренных вами **89.906**. Совпадение до
десятитысячных, коэффициент подтверждён.

Отсюда весь макет пересчитывается в физические размеры без допущений:

| Величина | px | мм |
|---|---|---|
| шаг по X | 53.8610 | **19.0010** |
| ширина 1U | 46.4941 | **16.4021** |
| зазор по X | 7.3669 | **2.5989** |
| радиус скругления | 3.3449 | **1.1800** |
| шаг по Y | 53.5120 | 18.8778 |
| высота клавиши | 46.1885 | 16.2943 |
| инсет охранного поля | 6.6085 | 2.3313 |
| основной кегль | 15.1999 | 5.3622 |
| интерлиньяж | 13.5279 | 4.7723 |
| весь макет | 1169.18 × 328.69 | 412.462 × 115.954 |

Инструмент считает **в px как во внутренней единице** (совпадает с SVG и с pt), а в интерфейсе
показывает только пользовательские единицы: **размеры сетки и габариты — в мм, кегли — в pt**.
Двойного вывода «px / мм» в UI нет. Экспорт в PDF получает физически точный размер страницы
бесплатно: `SVGExporter.exportToPDF` умеет `unit: 'mm'`, и наш px переводится в мм ровно.

**Открытый вопрос (см. § 9, вопрос 1):** по X всё круглое — 19 / 16.4 / 2.6 / 1.18 мм, а по Y нет.
`H/W = 0.99343` и `Py/Px = 0.99352` — одно и то же число, то есть макет **сжат по вертикали на
0.648 %**. Клавиша не квадратная: 16.40 × 16.29 мм. Нужно решить, воспроизводить это или нормировать.

---

## 2. Разбор фреймворка

### 2.1. Что берём как есть

`ui-framework` — движок v3: инструмент описывается одним объектом конфигурации, `defineTool()`
разворачивает весь интерфейс. Для нас это закрывает почти всю инфраструктуру:

| Подсистема | Файл | Что даёт нашему инструменту |
|---|---|---|
| Движок | `core/ApplicationShell.js` (1041 стр.) | пайплайн инициализации, координация всех подсистем, RAF-склейка рендеров |
| Декларативный вход | `core/defineTool.js` | `defineTool({ settings, controls, panels, render })` |
| Состояние | `core/Settings.js` | реактивное хранилище, proxy, dirty-tracking, JSON in/out |
| История | `history/HistoryManager.js`, `HistoryBridge.js` | undo/redo снапшотами, debounce, транзакции на драг слайдера |
| Пресеты | `preset/PresetStore.js`, `PresetSession.js` | localStorage CRUD, сид из `presets/manifest.json`, история на пресет |
| Шаринг | `preset/ShareCodec.js` | diff → deflate → base64url в URL `#p=` |
| Зум/пан | `ui/ZoomPanManager.js`, `render/SvgTarget.js` | векторный зум через viewBox, fit-to-screen, индикатор |
| Экспорт | `export/SVGExporter.js` | SVG, **PDF в мм через jsPDF+svg2pdf**, PNG-растеризация, JSON |
| Текст в кривые | `export/TextToPath.js` | обёртка над **opentype.js** — ровно то, что нам нужно |
| Контролы | `ui/SliderController.js`, `RangeSliderController.js`, `PanelManager.js`, `UnifiedColorPicker.js`, `DicePanel.js`, `DialogHost.js`, `TooltipService.js` | слайдеры с shift-шагом, двуручечные диапазоны, перетаскиваемые сворачиваемые панели, HSB-пикеры, нативные диалоги, тултипы |
| Дизайн-система | `css/othersite-styles.css` (4388 стр.), `css/tokens.css` | тёмная тема, все компоненты, токены |

Обязательный минимум разметки — `#canvasContainer`; плюс по умолчанию ищутся `#zoomIndicator`,
`#presetDropdown` / `#presetDropdownToggle` / `#presetDropdownMenu`, `#savePresetBtn`,
`#presetToolbarShareBtn`, `#dialog` с потрохами, `#convertToOutlinesCheckbox`.

Порядок инициализации: настройки → DOM → рендер-таргет → контролы → панели → пикеры → тултипы →
диалог → экспортёр → история и пресеты → шаринг → шорткаты → отслеживание изменений → `onInit` →
первый рендер → зум → бутстрап пресетов → `onReady`.

Готовые шорткаты: `mod+z`, `mod+shift+z`, `mod+e`.

### 2.2. Главная находка: `TextToPath` уже на opentype.js

`export/TextToPath.js` подгружает opentype.js с CDN и умеет переопределять карту шрифтов через
`options.fontPaths`. Это ключ ко всему проекту: **opentype.js в браузере даёт ровно те же данные,
на которых построен весь анализ в `analysis/`** — `unitsPerEm`, `glyph.advanceWidth`,
`glyph.getBoundingBox()` (ink-бокс), `glyph.getPath()` (контур), таблицу `OS/2` с `sCapHeight`
и `sxHeight`, кернинг через `font.getKerningValue()`.

То есть порт Python-модулей `font.py`, `optics.py` и `model.py` в JS — механический, без потери
точности и без придумывания замен. Это снимает главный технический риск проекта.

Что придётся дописать самим (в `TextToPath` этого нет):
- ink-бокс строки целиком с учётом трекинга (у нас есть в `analysis/font.py`);
- профили контура по сканлайнам для признаков `noncontact` / `recess` (`analysis/optics.py`);
- обход составных глифов — opentype.js разворачивает композиты в `getPath()` сам, так что
  грабли из § 15 `PIPELINE.md` (`DecomposingRecordingPen`) в браузере не воспроизводятся.

### 2.3. Замечания по фреймворку

| Наблюдение | Следствие для нас |
|---|---|
| UI-шрифт — **CoFo Sans**, подключается c `https://mishaivanov.ru/fonts/` в `tokens.css` | папка `ui-framework/fonts` (TT Commons, Lunnen Display) в CSS **не используется** вообще — она осталась от другого инструмента. Требование «сохранить те же шрифты интерфейса, файлы из `ui-framework/fonts` не использовать» выполняется само: копируем CSS как есть, CoFo Sans тянется с CDN |
| `--font-mono` используется в CSS **5 раз, но нигде не определён** | латентный баг: браузер подставит `font-family: ` невалидным и упадёт на дефолт. Определим токен в своём оверрайде |
| `TextToPath.fontPaths` по умолчанию смотрит в `fonts/` от корня страницы | наш `index.html` в корне, так что путь до шрифта задаём явно через `options.fontPaths` |
| `presets.basePath` — путь **относительно URL страницы**, не модуля | `index.html` в корне → `presets/` в корне |
| PDF/outline-экспорт грузит jsPDF, svg2pdf, opentype.js с CDN при первом вызове | офлайн-работа частично сломана. Для про-версии — положить библиотеки локально |
| ES-модули требуют HTTP | `python3 -m http.server`, `file://` не работает |
| `normalizeSvgForExport` требует числовые `width`/`height` на корневом `<svg>` | `SvgTarget.beginFrame` их ставит — но наш артборд размерами зависит от раскладки, поэтому обязателен хук `size(settings)` |
| Пресет = плоский JSON-блоб настроек | наша модель раскладки вложенная (ряды, блоки, легенды). Нужны свои `collectPreset` / `applyPreset` |

---

## 3. Структура проекта

Требование: `ui-framework` можно удалить в любой момент, проект не должен пострадать. Значит
фреймворк **копируется** в `vendor/`, и ни один рабочий файл на `ui-framework/` не ссылается.

```
/
├── index.html                 ← точка входа, в корне
├── PIPELINE.md                ← законы предметной области
├── TOOL_PLAN.md               ← этот файл
│
├── app/                       ← наш инструмент
│   ├── tool.js                ← defineTool({...}), тонкий слой
│   ├── theme.css              ← оверрайд токенов + стили наших панелей
│   └── kb/                    ← предметные модули, чистые функции
│       ├── units.js           ← px ↔ мм, константы сетки
│       ├── grid.js            ← ряды → прямоугольники клавиш (§ 5 PIPELINE)
│       ├── guides.js          ← инсет охранного поля (§ 7)
│       ├── typography.js      ← opentype.js: метрики, ink-бокс, advance (§ 8.3)
│       ├── fontprobe.js       ← полный съём метрик любой гарнитуры → автокомпенсация (этап 8)
│       ├── optics.js          ← профили контура, noncontact / recess (§ 10.2)
│       ├── compensate.js      ← модель компенсации + таблица знаков (§ 10.5)
│       ├── slots.js           ← слот → координаты пера (§ 9, § 14)
│       ├── templates.js       ← шаблоны легенд (§ 11.2)
│       ├── icons.js           ← библиотека пиктограмм
│       ├── layouts.js         ← встроенные раскладки
│       └── verify.js           ← сверка с эталоном (этап 3)
│
├── vendor/framework/          ← КОПИЯ ui-framework, не трогаем
│   ├── css/othersite-styles.css
│   └── src/…
│
├── presets/                   ← manifest.json + *.json
├── Fonts/YS Text/             ← YS Text-Regular.ttf, читается opentype.js напрямую
│
├── analysis/                  ← Python, источник истины по числам (не меняется)
├── docs/                      ← диагностические рендеры
├── LCAKB23.svg                ← эталон
├── LCAKB23.layout.json        ← выгрузка анализа, вход для верификации
└── ui-framework/              ← удаляемая песочница
```

Принцип разделения: `app/kb/*` — **чистые функции без DOM**, `app/tool.js` — только конфигурация
и `render(ctx)`. Так предметная логика тестируется отдельно от интерфейса, а её же можно прогнать
в Node и сверить с Python построчно.

---

## 4. Модель данных

Развитие модели из § 14 `PIPELINE.md`. Три независимых слоя — геометрия, шаблон, содержимое —
чтобы смена языка, форм-фактора и стиля нанесения не задевали друг друга.

```js
{
  meta:  { name: 'LCAKB23', unit: 'px', mmPerPx: 0.3527778 },

  grid: {
    colPitch: 53.8610, rowPitch: 53.5120,
    keyWidth1U: 46.4941, keyHeight: 46.1885,
    cornerRadius: 3.3449, guideInset: 6.6085,
    origin: { x: 5.1014, y: 5.9146 }
  },

  type: {
    family: 'YS Text', weight: 400,
    sizes: { glyph: 15.1999, numpad: 13.1732, secondary: 12.0745, word: 9.1199 },
    leading: 13.5279,
    tracking: { word: -0.020024, wide: 0.020024 },
    optical: { mode: 'model', eps: 32, w: 300,
               coef: { noncontact: 41.34, recess: -42.60 },
               table: { '~': 31.5, '@': 31.3, '№': 50.8 } }
  },

  blocks: [ { id: 'main', x: 5.1014, right: 777.0155 },
            { id: 'nav', x: 788.8979 }, { id: 'numpad', x: 954.9964 } ],

  rows: [ { main: [{ w: 71.7216 }, { u: 1, repeat: 13 }],
            nav:  [{ u: 1, repeat: 3 }],
            numpad: [{ u: 1, repeat: 4 }] }, … ],

  keys: [ { at: [2, 1], tpl: 'alpha-dual', data: { TL: 'Q', BR: 'Й' } },
          { at: [0, 1], tpl: 'fkey-icon+label',
            data: { FC: { icon: 'brightness-down' }, BC: 'F1' } },
          { at: [4, 8], tpl: 'word-2line', data: { UC: '0', BC: 'insert' } } ]
}
```

Разрешение слота в координаты пера — чистая функция от кода слота, поля, кегля и метрик:

| Слот | y пера | x пера |
|---|---|---|
| `T` | `gy0 + capHeight·size` | — |
| `B` | `gy1` | — |
| `M` | `gcy + xHeight·size/2` | — |
| `U` | `gy1 − leading` | — |
| `F` | центр иконки = `(gy0 + capline)/2` | — |
| `C` | — | `gcx − advanceWidth/2` |
| `L` | — | `gx0 − inkLeft − compensation` |
| `R` | — | `gx1 − inkRight + compensation` |

Для `C` компенсация тождественно нулевая — это измеренный факт (§ 9.2), а не упрощение.

---

## 5. Этапы

Статус: **этапы 0–5 сделаны по коду**. Этап 6 имеет рабочий importable draft slice и остаётся
открыт для дальнейшей production-полировки imported/custom layouts. Этап 7 закрыт по основным
кодовым пунктам: послойный SVG, PDF в мм, локальные export libs, text/outlines mode,
compensation table editor и batch SVG. Этап 8 закрыт по основным кодовым пунктам: font registry,
UI-загрузка нескольких сессионных шрифтов, variable axes/instances, per-element `fontId`,
автопараметры компенсации для активной гарнитуры, статус probe/invariants, control sheet и
расширенный Node harness по нескольким локальным весам. Остаётся ручной production QA скачанных
SVG/PDF в Illustrator/PDF viewer и возможный будущий upgrade font engine для настоящего `gvar`
outline instancing.

### Этап 0 — каркас ✅ сделано

- скопировать `ui-framework/css` и `ui-framework/src` в `vendor/framework/`;
- `index.html` в корне: разметка-скелет фреймворка + наши панели;
- `app/theme.css`: определить недостающий `--font-mono`, добавить стили инспектора клавиши;
- `app/tool.js` с пустым `render` и `size(settings)`;
- проверка: `python3 -m http.server`, страница поднимается, зум работает, пресеты не падают,
  `ui-framework/` можно переименовать и ничего не сломается.

**Критерий готовности:** `mv ui-framework _tmp` — инструмент работает. Выполнено: 35 файлов
в `vendor/framework`, ни одной ссылки на `ui-framework` в рабочем коде.

### Этап 1 — бета, геометрия ✅ сделано

Порт § 5 и § 7 `PIPELINE.md`.

- `units.js`, `grid.js`, `guides.js`: ряды → прямоугольники, чейнинг по сетке,
  `u` / `w` / `close` / `fillToColumn` / `rowSpan` / `skip`, охранные поля инсетом;
- рендер `caps` + `guides` скруглёнными прямоугольниками;
- панель **Grid**: шаг X, шаг Y, ширина 1U, высота, радиус, инсет — шесть **независимых**
  слайдеров (решение 1), значения только в мм;
- панель **Layers**: тумблеры `caps` / `guides` / сетка / метки;
- цвета через `UnifiedColorPicker`: заливка клавиши, обводка поля, фон;
- артборд считается из раскладки хуком `size(settings)`;
- экспорт SVG, пресеты, история, шаринг — из коробки.

**Критерий готовности:** 110 клавиш и 110 полей совпадают с `LCAKB23.svg` покоординатно
с допуском 0.01 px. Достигнуто: максимальная невязка **0.00009 px** по `x`, `y`, ширине и высоте;
артборд 1169.1846855 × 328.6893243 совпадает с эталоном.

Побочный результат этапа — правило `flex` вместо `close` и `fillToColumn`: одна помеченная
клавиша в ряду забирает остаток ширины блока. Проверено, что все шесть рядов `main` заполняют
блок ровно (невязка 0.0002 px), так что двух отдельных правил не требуется. `PIPELINE.md` § 14
обновлён.

### Этап 2 — бета, легенды ✅ сделано

Порт § 8–10 `PIPELINE.md` — самая содержательная часть.

- `typography.js`: загрузка `YS Text-Regular.ttf` через opentype.js, метрики, ink-бокс строки
  с трекингом, advance;
- `optics.js`: развёртка контура, профили по сканлайнам, признаки `noncontact` / `recess`;
- `compensate.js`: модель `41.34·noncontact − 42.60·recess`, таблица для знаков препинания,
  кэш по кодовой точке. Коэффициенты и параметры окна вынести в объект параметров гарнитуры,
  а не зашивать в код — на этапе 8 они станут вычисляемыми, и переписывать модуль не придётся;
- `slots.js`: разрешение всех 7 вертикальных и 5 горизонтальных якорей;
- `templates.js`: 15 шаблонов;
- `icons.js`: пиктограммы как параметрические пути — стрелки (квадрат 4.431), win (7.430),
  длинные стрелки `tab` / `backspace` (21.668 × 5.08), 13 f-иконок;
- панель **Type**: кегли по ролям **в pt**, интерлиньяж, трекинг, режим компенсации
  (`выкл` / `модель` / `ручная таблица`);
- панель **Legend**: readonly-инспектор выбранной клавиши — шаблон, содержимое слотов,
  вычисленная компенсация по знакам. Ручной оверрайд относится к этапу 4;
- диагностический оверлей: охранное поле, ink-бокс, cap-бокс, базовая линия, x-высота — тот же
  набор, что в `analysis/zoom.py`.

**Критерий готовности:** легенды отрисованы для всех 110 клавиш, оверлей визуально совпадает
с `docs/slots-*.png`.

Достигнуто: 110/110 клавиш получили содержимое, 176 текстовых строк и 28 иконок рендерятся
в SVG, Type-панель управляет кеглями/leading/tracking/режимом компенсации, Legend-панель
показывает readonly-инспектор выбранной клавиши. `node analysis/verify-legends.mjs` проходит:
204 элемента, 408 координат, RMSE формульной компенсации 0.1099 px при лимите 0.12 px.

### Этап 3 — бета, верификация ✅ сделано

Это ответ на вопрос «как справился анализ». Инструмент должен сам себя проверить.

- `verify.js`: грузит `LCAKB23.layout.json` и эталонные координаты из `LCAKB23.svg`,
  сопоставляет с тем, что сгенерировал инструмент;
- режим **Diff**: эталон подложкой, сгенерированное поверх, невязки цветом;
- таблица невязок: по клавишам, по слотам, по знакам — медиана, максимум, худшие 10;
- пороги приёмки из `PIPELINE.md`: геометрия 0.01 px, вертикаль слотов 0.05 px,
  горизонталь после компенсации 0.15 px (RMSE модели 0.098 px, предел руки 0.047 px);
- экспорт отчёта в JSON.

**Критерий готовности:** отчёт зелёный по геометрии и вертикали; по горизонтали видно, что
расхождения не превышают заявленной точности модели.

Достигнуто: `Verify` строит HTML-отчёт по геометрии и легендам, диалог умеет скачать компактный
JSON-отчёт, слой **Diff** в панели Layers рисует эталон и сгенерированную геометрию поверх
клавиш с цветом по величине невязки. `compare()` сначала матчится по точному `row+x`, а при
изменённой сетке переходит на стабильный порядок внутри `row/block`, поэтому Diff показывает
численные расхождения вместо ложных `missing` / `extra`. На эталонных настройках геометрия
проходит с худшей невязкой 0.0000876 px, легенды проходят с RMSE формульной компенсации
0.1099 px при лимите 0.12 px.

### Этап 4 — RC, редактирование ✅ сделано по коду (2–3 дня)

Бета генерирует; RC даёт менять.

- клик по клавише — выбор, инспектор, `shift`-клик — мультивыбор;
- смена шаблона у выбранных клавиш пачкой (главный смысл типизации: одна операция вместо 26);
- правка содержимого слотов;
- изменение ширины клавиши с автопересчётом ряда — из условия «сумма ряда = ширина блока»
  (§ 11.1: ширины **не кратны U**, поэтому пересчёт обязателен);
- добавление и удаление клавиш и рядов;
- ручной оверрайд компенсации на знак с сохранением в модель;
- клавиатурная навигация по клавишам.

Достигнуто: стартовый пресет теперь явно `LCAKB23`; выбор клавиш уже живёт как UI-состояние
вне `settings`, поэтому клики не помечают пресет изменённым. Работают клик по клавише,
автораскрытие Legend-панели при клике по клавише, `Shift`/`Cmd`/`Ctrl`-клик для мультивыбора,
синхронизация с Legend inspector, навигация
стрелками, `Shift+Arrow` для расширения выбора и `Escape` для очистки. Рабочий оверлей
`#selection` временно скрывается на время SVG/PNG-экспорта и возвращается после него. Поверх
сгенерированного `LCAKB23` добавлены пресетные `contentEdits`: активную клавишу можно править
по слотам/значениям/размерам, а выбранный template-вариант применяется пачкой ко всем выделенным
клавишам. Можно добавлять `Text`/`Icon` elements к активной клавише и удалять существующие строки
элементов, после чего `Apply` сохраняет новый массив elements в `contentEdits`. Для текстовых
L/R-слотов есть ручной `Comp` в px: заполненное значение заменяет формулу/таблицу компенсации и
сохраняется как `compOverride`. Добавлен первый слой геометрических оверрайдов `layoutEdits`: в
Legend-панели у активной клавиши можно задать `Width` в мм, правка сохраняется по стабильному
`row:block:ordinal`, а ряд пересчитывается через flex-логику. Если правится обычная клавиша,
остаток забирает существующая flex-клавиша; если правится исходная flex-клавиша, она становится
явной шириной, а временная flex-роль переходит к соседней клавише справа или, для конца ряда,
слева. Первое удаление клавиш тоже живёт в `layoutEdits`: `Delete key` ставит `deleted: true`,
ряд пересобирается без этой клавиши, а стабильные `editId` прокидываются через `grid.js`, чтобы
контент и overrides не сдвигались у клавиш справа. `Restore key` снимает последний deleted-флаг.
Первое добавление клавиш тоже готово: `Add before` / `Add after` вставляют пустую 1U-клавишу рядом
с активной исходной клавишей в рядах с flex-абсорбером, хранят её в `layoutEdits` как ключ
`add:row:block:n` с `{ added: true, before }` или `{ added: true, after }`, сразу выбирают новую
клавишу и оставляют её без легенд, пока пользователь не добавит `Text`/`Icon` через Legend editor.
Перед включением кнопок и перед записью edit выполняется пробная сборка `buildLayout()`, чтобы не
создавать ряд, который не помещается или сжимает клавишу ниже `MIN_KEY_WIDTH_MM`. Соседние легенды
не сдвигаются, потому что content attachment теперь сначала сопоставляет клавиши по `editId`;
`Reference grid` дополнительно чистит осиротевшие `contentEdits` добавленных клавиш. Перестановка
клавиш внутри row/block тоже готова: `Move left` / `Move right` меняют активную клавишу местами с
видимым соседом и сохраняют порядок как `layoutEdits["order:row:block"].order` из стабильных
`editId`, поэтому легенды, ширины и content overrides едут вместе с клавишей. Удаление и
восстановление рядов тоже готово для валидных случаев: `Delete row` пишет
`layoutEdits["row:N"].deleted = true`, убирает исходный ряд и компактирует ряды ниже вверх, а
`grid.js` прокидывает `sourceRow`, чтобы display row мог измениться без потери `editId`.
Перед включением удаления используется fit guard с проверкой пересечений прямоугольников, поэтому
ряды, которые конфликтуют с `rowSpan` numpad-клавиш, не удаляются. `Restore row` снимает последний
row delete-флаг и выбирает первую клавишу восстановленного ряда. Добавление рядов тоже есть в
первой безопасной версии: `Add row` клонирует структуру активного исходного ряда ниже него,
создаёт пустую строку без легенд, хранит операцию как
`layoutEdits["rowadd:N"] = { rowAdded: true, afterRow, templateRow }` и выдаёт строке synthetic
source-row, чтобы её клавиши получали стабильные `editId` вроде `6:main:0`. Добавленная строка
проходит тот же fit/overlap guard, её клавиши можно редактировать теми же content/layout edits,
а delete/restore строки работает через обычный `layoutEdits["row:N"].deleted`. `Reference grid`
теперь чистит `contentEdits` не только для `add:*`-клавиш, но и для synthetic rows.
`Reset` удаляет overrides выбранных клавиш/активной ширины и возвращает контент или геометрию из
генератора. Первый явный JSON-формат editable keyboard тоже добавлен: нижняя кнопка `JSON`
скачивает `keyboarder-lcakb23-model.json` со схемой `keyboarder.model.v1`, полным normalized
`settings` для точного round-trip и читаемой секцией `keyboard` (`grid`, `type`, `appearance`,
`edits`). Кнопка `Import` принимает этот формат и старые плоские preset blobs, открывая результат
как shared preset, который можно дальше сохранить штатной preset-кнопкой. Для v1 решено оставить
дублирование `settings` + `keyboard`: `settings` нужен для lossless app round-trip, `keyboard` —
для читаемой domain-модели. Helpers для этого вынесены в чистый `app/kb/model-io.js`, а
`analysis/model-io.mjs` проверяет round-trip, text-parse путь file import, legacy preset import,
domain-only import и sanitizer edge cases без браузера.

Этап 4 закрыт по коду. Остаётся только ручной smoke системного file picker, потому что Browser
automation не выбирает локальные файлы; parse/validate/normalize путь за picker уже покрыт.

### Этап 5 — RC, библиотека раскладок ✅ сделано по коду (1–2 дня)

- встроенные раскладки: ANSI 96 % (наш LCAKB23), ANSI TKL, ISO, 65 %, 60 %;
- языковые слои: латиница, кириллица, и переключение раскладки без смены геометрии;
- пресеты из `presets/` как сид;
- вывод: сколько клавиш, габарит в мм, предупреждения о нестандартных ширинах.

Первый срез Stage 5 готов: `app/kb/layouts.js` теперь экспортирует `LAYOUTS` /
`LAYOUT_OPTIONS`, в библиотеке есть `LCAKB23`, `ANSI_TKL`, `ISO_TKL`, `ANSI_65` и `ANSI_60`.
В Grid-панели появился `Layout` select. Рендер, block/column overlays, layout edits, rowadd
sanitizer, `Reference grid`, JSON export/import и filename теперь смотрят на активный
`layoutName`, а не на жёстко зашитый `LCAKB23`. При переключении layout очищаются
`layoutEdits` / `contentEdits`, потому что стабильные ids у разных форм-факторов пока не
считаются совместимыми. Для не-LCA раскладок `Reference` и `Diff` disabled, а `Verify` честно
отказывается сравнивать их с LCAKB23-эталоном. В readout добавлена строка `Warnings`: сейчас она
показывает нестандартные ширины и клавиши без attached generated content.

Проверенный browser smoke: `LCAKB23` даёт 110 клавиш, `ANSI_TKL` 87, `ISO_TKL` 88, `ANSI_65` 63,
`ANSI_60` 58; переключение обратно на `LCAKB23` возвращает 110 клавиш и generated legends.

Второй срез Stage 5 тоже готов: в Layers-панели появился `Language` select (`Latin + Cyrillic`,
`Latin`, `Cyrillic`). Он фильтрует только generated text legends, не меняя геометрию и не трогая
icons; `languageLayer` сохраняется в settings/model JSON. Smoke на LCAKB23: dual даёт 176 text
legends, `Latin` — 143, `Cyrillic` — 150, возврат в dual снова даёт 176, при этом key count и
artboard остаются прежними.

Третий срез Stage 5 готов: `app/kb/content/generated-layouts.js` генерирует generic legend
content для non-LCA раскладок по стабильному `row/block/ordinal` адресу. Это пока не
designer-measured контент, а честные подписи клавиш, но они проходят тот же attach/render путь,
что и LCAKB23. Browser smoke: `ANSI_TKL` даёт 87 strings, `ISO_TKL` — 88, `ANSI_65` — 63,
`ANSI_60` — 58; warnings после attach отсутствуют. Node-проверка `analysis/layout-content.mjs`
проверяет, что каждая клавиша получает content и не появляются orphan entries.

Четвёртый срез Stage 5 готов: shipped seed presets теперь покрывают layout-library workflows.
В `presets/manifest.json` добавлены `ANSI TKL`, `ISO TKL`, `ANSI 65%`, `ANSI 60%`, а существующие
LCA seed presets явно получили `layoutName: "LCAKB23"` и `languageLayer: "dual"`. Fresh-origin
browser smoke на `http://127.0.0.1:8007/` увидел новые пункты меню; применение `ANSI TKL`
переключило layout на `ANSI_TKL`, 87 keys, 87 strings, warnings none. Node-проверка
`analysis/presets.mjs` валидирует manifest, JSON-файлы и имена раскладок.

Stage 5 закрыт по коду. Caveat: если origin уже был засиден старой версией preset manifest,
пользователю может понадобиться restore-default presets или fresh origin, чтобы увидеть новые
shipped presets. Non-LCA legends остаются generic generated labels, а не вымеренным дизайнерским
контентом.

### Этап 6 — про, импорт чертежа 🚧 рабочий importable draft slice (3–4 дня)

Порт § 2–4 `PIPELINE.md` — статистическое распознавание.

- drag-and-drop SVG-чертежа;
- снятие приватного блока Illustrator `<i:aipgf>` (§ 12.1);
- корзины горизонтальных и вертикальных отрезков, отброс диагоналей;
- калибровка `d` по эталонным клавишам, нарисованным пользователем;
- пары кромок с одинаковым пролётом, верификация боковыми, снятие вложенности;
- предпросмотр распознанного с подсветкой сомнительных клавиш;
- автовывод состава ряда (`u` / `w` / `close` / `skip`) — то, что сейчас делается руками.

Первый срез Stage 6 готов: добавлен чистый модуль `app/kb/svg-blueprint.js` и UI-панель
`Drawing`. Модуль снимает Illustrator private payload (`<metadata>/<i:aipgf>`), вытаскивает
группы `blueprint` / `caps`, парсит `<line>`, раскладывает отрезки в корзины horizontal /
vertical / diagonal, считает SVG primitives, группирует horizontal spans и калибрует базовые
константы по rect'ам `caps`. Следующий кусок распознавания тоже уже внутри этого среза:
оценивается corner offset `d`, горизонтальные кромки спариваются по rounded span, кандидаты
проверяются боковыми vertical segments, вложенные фаски снимаются по площади. Diagnostics
отделяет warning-level suspicious keys от harmless notes: warning keys подсвечиваются красным
пунктиром, нормальные recognized keys остаются жёлтыми. `layoutDraftFromRecognized()` переводит
detected rectangles в `keyboarder.layoutDraft.v1`: row/block JSON, который уже рендерится
существующим `buildLayout()` с drift < 0.03 px к detected bounds.
`analysis/blueprint-import.mjs` проверяет synthetic SVG и реальный `LCAKB23.svg`: 1658 H,
1388 V, 884 diagonal, 866 paths, 487 horizontal span groups, 110 caps, `d = 3.3779`,
220 raw candidates, 110 final recognized keys, из них 2 double-height; worst drift до designer
caps < 0.03 px; diagnostics на нём даёт 0 warnings, 4 notes, 0 suspicious; draft даёт
3 blocks, 6 rows, 110 keys. Первоначальный debug-UI в браузере
`Browse SVG` / drag-and-drop кладут анализ во временное UI-state, показывают summary и рисуют
preview layer `#imported-blueprint` из 3930 lines плюс `#imported-candidates` из 110 rects;
на LCAKB23 все 110 rects жёлтые, red suspicious = 0. Кнопка `Draft JSON` disabled до импорта и
enabled после; она скачивает layout draft. `Use Draft` disabled при warning-level diagnostics и
enabled на clean import; на LCAKB23 он переключает Grid layout на `IMPORTED_SVG`, добавляет
`IMPORTED_SVG · custom` в selector, рендерит 110 keys и 110 generic text legends, выключает
`Reference` / `Diff` и кладёт layout в settings как `customLayout`. `keyboarder.model.v1`
сохраняет `customLayout` в settings и дублирует его в `keyboard.customLayout` на export.
Этот панельный preview был промежуточным debug-UI; в текущем UX сохраняется только результат
распознавания как `customLayout`, а сам SVG/preview не входят в preset/model. Draft теперь
компактируется для ручной доработки: подряд идущие одинаковые
unit-клавиши записываются через `repeat`, служебные `r123` IDs не попадают в layout JSON, а
generic legends для imported/custom layouts показывают позиционные подписи вроде `main 1`
вместо технических идентификаторов.

Следующий polish-срез Stage 6/7 зафиксирован по новому рабочему файлу
`/Users/mishaivanov/Desktop/test_layout.svg`. Этот файл меняет контракт импорта: слой `caps`
может быть **не полным набором клавиш**, а sparse-калибратором из 1-2 пользовательских образцов;
остальные клавиши инструмент обязан восстановить сам из `blueprint`. План этого среза:

- считать `caps` калибровочным слоем; mismatch `caps.length !== detectedKeys.length` становится
  warning только когда `caps` явно выглядит как полный слой и расходится с распознаванием;
- если `caps` не даёт `colPitch` / `rowPitch`, восстанавливать шаги сетки по detected keys:
  брать mode обычных межклавишных зазоров и row clusters, а не падать в `0`;
- дополнить line-based detector path-corner recovery: Illustrator хранит скруглённые углы как
  cubic `<path>`, и по четырём углам можно распознать split-клавиши, которые не имеют цельных
  боковых vertical segments;
- добавить в модель импортированной раскладки stacked cell: одна 1U-ячейка может содержать две
  физические клавиши с собственными `yOffset` / `h`. Для текущего файла это ↑/↓, скомпонованные
  в footprint одной обычной клавиши между ← и →;
- генерировать осмысленные `id` / labels для ANSI-like compact import: `esc`, `f1…f13`,
  `backspace`, `tab`, `caps`, `enter`, `lshift`, `space`, `left`, `up`, `down`, `right` и т.д.,
  чтобы после `Use Draft` пользователь получал не `main 1`, а редактируемую раскладку с
  человеческими именами;
- Stage 7 polish после этого: проверить, что импортированная stacked-раскладка корректно уходит
  в SVG/PDF/JSON, clean production export не содержит drawing preview, а text/outlines modes
  одинаково обрабатывают новые key ids и split-клавиши.

Этот polish-срез выполнен по коду. `test_layout.svg` теперь импортируется clean: 2 `caps` rects
используются как calibration samples, pitch восстанавливается по detected-key gaps, найдено
78 физических клавиш, включая 1 stacked cell для ↑/↓, diagnostics даёт 0 warnings и `Use Draft`
enabled. Draft собирается обратно через `buildLayout()` с nearest drift < 0.03 px, генерирует
осмысленные labels и сохраняет stacked custom layout через `keyboarder.model.v1`. Browser smoke
на `http://127.0.0.1:8015/?stage6split=20260728b` подтвердил 78 rendered caps, две половинные
клавиши высотой ~22.53 px, 78 SVG `<text>` labels в Text mode, наличие `up`/`down` и отсутствие
console errors.

Дополнительный UX-срез после пользовательского фидбэка: постоянная `Drawing` panel снята из
рабочего интерфейса. Загрузка SVG теперь является не слоем поверх открытого пресета, а входом в
создание новой раскладки: верхняя кнопка `New layout` открывает SVG, анализирует файл, при чистой
диагностике сразу создаёт `customLayout` с именем из файла (например `test_layout.svg` →
`TEST_LAYOUT`), переводит сессию в `Unsaved*`, синхронизирует Grid и очищает временный чертёж.
`showDrawing` оставлен только как совместимое поле старых JSON/ссылок и при нормализации
сбрасывается в `false`; импортированный SVG не рисуется поверх текущей клавиатуры и не
сохраняется в preset/model. Если диагностика содержит warnings, layout не создаётся и вместо
панельной статистики показывается короткий modal report.

Следующий polish-пункт по naming/saving custom layouts выполнен: `New layout` теперь проверяет
имена сохранённых presets и встроенных layouts, поэтому повторный импорт `test_layout.svg` после
сохранения `TEST_LAYOUT` получит `TEST_LAYOUT_2`, затем `TEST_LAYOUT_3` и т.д. Framework получил
опциональный hook `presets.suggestSaveName`; Keyboarder подставляет в `Save preset` имя текущего
custom layout через app-level `installSuggestedPresetSave()`, так что новый SVG-проект можно
сохранить без ручного перепечатывания имени файла.

Richer suspected-key review тоже вынесен в новый pipeline без возвращения `Drawing` panel:
warning-level import теперь открывает modal report с summary, warnings/notes и координатами
проблемных key candidates. Кнопка `Report JSON` скачивает компактный отчёт
`keyboarder-<svg-name>-import-report.json` с groups/elements, calibration, estimated grid,
recognized counts, diagnostics и draft stats; сырой SVG и line buckets туда не попадают.
Modal report также показывает visual `Key Review`: мини-карту detected keys, где warning keys
подсвечены красным, notes — жёлтым, а проблемные key candidates подписаны номерами.

Полировка hand-editable draft завершила следующий кусок Stage 6: SVG import теперь умеет
компактно хранить семантические имена внутри повторяющихся рядов через
`{ u: 1, repeat: N, ids: [...] }`. Поэтому ANSI-like custom layout не разворачивается в десятки
одинаковых элементов ради `esc/f1/...`, но `buildLayout()`, Legend editor и generic labels всё
равно получают уникальные key IDs после expansion. Добавлены Node-проверки для компактного
семантического SVG и для standalone `repeat + ids` layout.

Ещё один polish-срез для imported ANSI-like content: если custom layout содержит semantic ids
`q/w/e/...`, generic content создаёт для этих букв не single `generated-label`, а
`tpl: "alpha-dual"` с латиницей в `TL` и кириллицей ЙЦУКЕН в `BR`. `New layout` также сбрасывает
`Language` в `Latin + Cyrillic`, чтобы свежий импорт сразу открывался двуязычным. Проверка на
`/Users/mishaivanov/Desktop/test_layout_S.svg`: 78 keys, 78 content entries, 26 `alpha-dual`;
первые пары `Q/Й`, `W/Ц`, `E/У`.

#### Stage 6 QA: `test_layout_S.svg` / `test_layout_M.svg` import quality

2026-07-28 ручная оценка по исходникам
`/Users/mishaivanov/Desktop/test_layout_S.svg`, `/Users/mishaivanov/Desktop/test_layout_M.svg`
и экспортам из Downloads:

- `S`: geometry import справился хорошо. Найдено 78 keys, 1 block, 6 rows, 1 stacked cell для
  `up/down`, 0 warnings, 5 notes. Форма клавиатуры, широкие модификаторы, пробел и split arrows
  собираются обратно корректно.
- `S`: content import теперь частично production-useful: alpha keys получают `alpha-dual` с
  латиницей в `TL` и кириллицей в `BR`. Но генерация всё ещё неполная: bracket / semicolon /
  quote / comma / period / slash / number row остаются single labels, без `Х/Ъ/Ж/Э/Б/Ю` и без
  shifted-symbol corners; F-row пока текстовый, без icon profile.
- `M`: geometry import тоже справился: 89 keys, 2 blocks (`main` + `nav`), 6 rows, 0 warnings,
  5 notes. Main/nav spacing, wide keys и отдельный nav block распознаны.
- `M`: semantic/content import пока провален: форма не попадает в текущий one-block
  `ANSI_COMPACT_IDS` matcher, поэтому все 89 labels становятся placeholder text:
  `main 1`, `main 2`, `nav 1`, etc. Это не должно считаться готовой раскладкой.

Root cause: SVG-чертёж сейчас несёт в основном геометрию, а не готовый semantic legend layer.
Значит Keyboarder обязан определять layout profile по форме рядов/блоков и назначать ids +
content heuristics. Сейчас есть только первый узкий matcher для компактного one-block S layout.

План исправления:

1. Ввести `layoutProfile` у `layoutDraftFromRecognized()`: shape matcher по row/block counts,
   width pattern, nav presence, stack cells и skip pattern. Не завязываться на имя файла.
2. Оформить текущую S-эвристику как профиль `ANSI_COMPACT_78`: 6 rows, 1 main block,
   row lengths `14/14/14/13/12/10`, last-row stacked `up/down`.
3. Добавить профиль для M, условно `ANSI_NAV_89`: 6 rows, `main + nav`, main row lengths
   `14/14/14/13/12/9`, nav pattern `3/3/3/0/skip+up/3`. Он должен назначать ids:
   `esc/f1...f13`, number row, `tab/q...backslash`, `caps/a...enter`,
   `lshift/z...rshift`, bottom modifiers, nav `print/scroll/pause`,
   `insert/home/pgup`, `delete/end/pgdn`, `up`, `left/down/right`.
4. Расширить generic semantic content:
   - alpha ids -> `alpha-dual` (`TL` Latin, `BR` Cyrillic);
   - bracket / semicolon / quote / comma / period / slash ids -> `legend-corners` with Latin
     shifted/unshifted symbols and Cyrillic `Х/Ъ/Ж/Э/Б/Ю` in `BR`;
   - number row -> corner template with shifted symbols (`! @ # ...`) plus bottom numerals;
   - modifier/nav word keys -> stable word templates, not generic `main N`;
   - F-row icons can stay a later profile layer, but the plan should keep a slot for them.
5. Add import semantic coverage diagnostics: after SVG import, report profile name,
   semantic-id coverage, alpha-dual count, punctuation-dual count, and placeholder count.
   If placeholder count is high, show a note/warning in the import report or success toast so
   `main 1` does not silently look like a finished layout.
6. Add repeatable tests with synthetic S/M fixtures in `analysis/blueprint-import.mjs` or a new
   `analysis/import-fixtures.mjs`: assert geometry count, block count, assigned ids, `alpha-dual`
   count, punctuation templates, nav labels, and zero orphan content.
7. Re-run manual QA on fresh exports:
   - `result_test_layout_S`: no `main N`, no missing Cyrillic on alpha/punctuation keys, arrows
     still stacked correctly;
   - `result_test_layout_M`: no placeholder labels, nav block named, alpha and punctuation keys
     use the same templates as S, geometry unchanged.

### Этап 7 — про, производство ✅ основные кодовые пункты сделаны (2–3 дня)

- экспорт SVG послойно, именами групп как в эталоне (`caps`, `guides`, `glyphs`, `icons`,
  `f-icons`) — чтобы файл открывался в Illustrator привычным;
- текст на выбор: `<text>` с реальным шрифтом или кривые;
- **PDF в мм** физически точного размера — на 72 dpi перевод ровный;
- локальные jsPDF / svg2pdf / opentype.js вместо CDN — офлайн;
- экспорт и импорт JSON-модели, круговой цикл;
- редактор таблицы компенсации знаков препинания;
- обычный production export активного языкового слоя; пакетная генерация снята из рабочего UI,
  потому что в реальном процессе она не нужна.

Первый срез Stage 7 готов: экспортная структура легенд начала совпадать с эталоном по группам.
`analysis/export_tool.py` теперь сохраняет исходную группу каждой иконки (`icons` / `f-icons`) в
`app/kb/content/lcakb23.js`; sanitizer JSON-модели и Legend editor это поле не выкидывают, а
ручные новые иконки по умолчанию идут в `icons`. Renderer разделяет icon legends на два SVG-слоя:
`#icons` для обычных пиктограмм и `#f-icons` для функциональных. Заодно исправлен скрытый runtime
баг редактора: в `app/tool.js` появился wrapper `cleanElement()`, без которого `Add text` /
`Add icon` могли падать, хотя `node --check` этого не видел. Browser smoke на свежем origin:
110 keys, 176 glyph paths, 15 `#icons`, 13 `#f-icons`, console clean; `Add icon` после выбора
клавиши добавляет строку редактора без ошибок.

Второй срез Stage 7 готов: в нижней панели появилась кнопка `PDF`. Она вызывает существующий
`SVGExporter.exportToPDF()` из framework, но теперь с явным `unit: "mm"` и page format,
посчитанным из текущего SVG artboard через подтверждённый коэффициент `25.4 / 72`. Для LCAKB23
это даёт физический размер страницы `412.462 × 115.954 mm`. Clean-export wrapper теперь
обслуживает PDF вместе с SVG/PNG, поэтому selection overlay не попадает в production export.
Filename строится по активной раскладке:
`keyboarder-lcakb23.pdf`, `keyboarder-ansi-tkl.pdf`, и т.д. Browser smoke на fresh origin
подтвердил enabled `PDF` button, 110 keys, 15 `#icons`, 13 `#f-icons`, нужный mm-размер и чистую
консоль; сам click/download путь сознательно не запускался, потому что текущий PDF exporter ещё
тянет `jsPDF` / `svg2pdf` с CDN, а локализация этих библиотек — следующий production пункт.

Третий срез Stage 7 готов: production export больше не зависит от CDN для экспортных библиотек.
`jsPDF` и `svg2pdf` лежат локально в `vendor/lib/` и подключаются статическими script tags в
`index.html`; `SVGExporter` также умеет лениво добрать эти же локальные файлы, если статическая
загрузка была изменена или удалена. `TextToPath` теперь импортирует локальный
`vendor/lib/opentype.module.js`, так что outline-конвертация тоже не ходит на jsDelivr.
Инициализация custom UI wiring перенесена в `onInit`, до seed preset bootstrap, а `PresetStore`
получил короткий timeout на manifest/preset fetch: если локальный сервер или origin ведёт себя
странно, кнопки экспорта и редакторские handlers всё равно не зависают за пресетами. Browser QA
после локализации подтвердил, что страница загружается со статическими локальными export libs,
клик по клавише по-прежнему раскрывает свернутый Legend panel, а консоль не показывает новых
runtime errors. Ограничение проверки: Browser plugin не отдал `download` event ни для `PDF`, ни
для уже существующего blob-based `JSON` export, поэтому сам факт сохранения файла проверен только
косвенно через доступность локальных библиотек, отсутствие ошибок и существующий export path.

Четвёртый срез Stage 7 готов: добавлен режим legend text output. В Type panel появился
segmented control `Outlines` / `Text`; дефолт остаётся `Outlines`, поэтому существующий точный
рендер кривыми и verification не меняются. В режиме `Text` слой `#glyphs` рендерится настоящими
SVG `<text>` с теми же baseline-координатами, `letter-spacing` в em, `font-family: "YS Text"` и
локальным `@font-face` из `Fonts/YS Text/YS Text-Regular.ttf`. Новый `legendTextMode` сохраняется
в presets/model JSON и попадает в `keyboard.type`. Browser smoke подтвердил: на дефолте
`#glyphs` содержит 176 `<path>` и 0 `<text>`, после переключения `Text` — 0 `<path>` и
176 `<text>`, первый текст `esc`, шрифт `YS Text`, 110 keys, 15 `#icons`, 13 `#f-icons`,
console clean.

Пятый срез Stage 7 готов: добавлен редактор таблицы оптической компенсации знаков препинания.
В Type panel появился компактный `Comp char` editor: выбор знака из базовой таблицы, числовые
поля `L` / `R` с шагом 0.01 em-units, `Apply`, `Reset char`, `Reset table` и статус
`reference` / `edited`. Правки хранятся не как копия всей таблицы, а как `compensationTableEdits`
поверх сгенерированной `YS_TEXT_REGULAR.table`; `null` у стороны означает удалить её из
эффективной таблицы, числовые значения округляются до сотых. `compFor()` теперь кэшируется по
режиму компенсации и JSON-подписи table edits, а `typeSigFrom()` включает эти edits, поэтому
изменение таблицы сразу пересчитывает позиции легенд. `Reference type` очищает table edits.
Поле сохраняется в presets/model JSON и попадает в `keyboard.type`; `analysis/model-io.mjs`
проверяет round-trip, округление и `null`. Browser smoke: 31 table character, выбор `~`,
изменение `L` на `20.25`, статус `edited · L 20.25 · R -`, активные reset buttons; затем
`Reset char` возвращает `reference · L 11.8 · R -`, reset buttons disabled, 110 keys,
176 glyph paths, console clean.

Шестой срез Stage 7 был реализован как пакетная генерация SVG по языковым слоям, но после
проверки реального процесса снят из UI и активного кода. Кнопка `Batch SVG` оказалась
непонятной и создавала артефакты, которые пользователь не использует; рабочим production-путём
остаётся выбор `Language` и обычный экспорт `SVG` текущего состояния.

### Этап 8 — про, автоматическая оптическая компенсация любой гарнитуры ✅ основные кодовые пункты сделаны (4–5 дней)

Сейчас модель компенсации привязана к `YS Text Regular`: коэффициенты 41.34 / −42.60 и параметры
окна `eps = 32`, `w = 300` получены МНК на 69 знаках именно этого шрифта. На бете это нормально
(решение 5), но для прода ограничение «только текущий шрифт» снимается.

**Цель этапа:** автоматическая оптическая компенсация **любой** загруженной гарнитуры, а не
только YS Text. Пайплайн: шрифтовой файл → полный съём метрик и контуров → самокалибровка
параметров модели → выравнивание легенд у кромки поля. Ручная таблица и ручной оверрайд остаются
как опция, но для произвольного TTF/OTF/WOFF2 они не обязательны: компенсация должна считаться
из самого файла.

#### 8.1. Полный съём метрик из файла

`kb/fontprobe.js` — разбор **всех** величин, от которых зависит выравнивание, с честными
фолбэками. Многие шрифты врут в `OS/2`, поэтому геометрическое измерение всегда приоритетнее
объявленного. Результат съёма — один объект параметров гарнитуры, который подставляется в
`compensate.js` вместо зашитого `YS_TEXT_REGULAR`.

| Величина | Откуда | Фолбэк, если таблица врёт или пуста |
|---|---|---|
| `unitsPerEm` | `head.unitsPerEm` | — |
| cap-height | `OS/2.sCapHeight` | верх ink-бокса `H`, при отсутствии — `E`, `Н` |
| x-height | `OS/2.sxHeight` | верх ink-бокса `x`, затем `o`, `н` |
| ascender / descender | `OS/2.sTypoAscender/Descender` | `hhea.ascent/descent` |
| наклон | `post.italicAngle` | регрессия по осевой линии штамба `I` |
| класс насыщенности | `OS/2.usWeightClass` | измеренная толщина штамба ÷ cap-height |
| класс ширины | `OS/2.usWidthClass` | advance `H` ÷ cap-height |
| толщина штамба | измеряется: горизонтальная толщина `I` на половине cap-height | толщина левого штамба `H` |
| полуапроши | `lsb` / `rsb` каждого глифа | из ink-бокса и advance |
| кернинг | `GPOS`, затем `kern` | нули |
| контрастность | отношение толщины штамба к толщине горизонтали `H` | 1.0 |

Отдельно: **вариативные шрифты**. `fvar` даёт оси; метрики и контуры надо снимать для конкретного
инстанса, а не для дефолта. Инструмент должен показать список осей и позволить выбрать точку,
после чего весь съём повторяется. Это же закрывает связанную боль из § 12 `PIPELINE.md` — там
вариативность ломала экспорт из Illustrator, а здесь она перестаёт быть проблемой, потому что
контуры мы берём сами.

#### 8.2. Самокалибровка модели

Признаки `noncontact` и `recess` безразмерные, но коэффициенты — нет: они переводят «форму края»
в доли кегля, и у более насыщенной или более контрастной гарнитуры этот перевод другой. Две
гипотезы, обе проверяемые без ручной выкладки:

**H1 — коэффициенты переносятся как есть.** Проверяется инвариантом плоского штамба: у знаков
с плоской вертикалью на прижимаемой стороне модель обязана давать ноль. Для `YS Text` это
подтверждено: среднее −0.010 px, σ = 0.047 px по 22 знакам (§ 10.3). Инвариант не требует эталона
и работает на любом шрифте, так что это дешёвый и надёжный тест.

**H2 — коэффициенты масштабируются самим шрифтом.** Идея: оптическую компенсацию **уже сделал
шрифтовой дизайнер**, заложив её в полуапроши. Разница между полуапрошем плоского знака и круглого
внутри одной гарнитуры — это её собственная мера того, насколько сильно здесь принято выпускать
круглое за линию. Отсюда безразмерный множитель:

```
k = (sb_круглый − sb_плоский)ₜₑₖ / (sb_круглый − sb_плоский)YS Text
```

где `sb_плоский` берётся по `H I П Ш`, `sb_круглый` — по `O О С`. Коэффициенты умножаются на `k`.
Для `YS Text` `k = 1` по построению, то есть текущая калибровка остаётся частным случаем.

Что важно не перепутать: наивная модель «компенсация = k · разница полуапрошей» уже проверена
и работает плохо (R² = 0.32, § 10.1) — полуапрош не видит, где по высоте находится просвет.
Здесь полуапроши используются иначе: не как предсказание для конкретного знака, а как **одно
число на всю гарнитуру**, задающее её оптическую «строгость». Это принципиально другая роль,
и слабость наивной модели против неё не аргумент.

Параметры окна тоже привязаны к шрифту: `eps` — порог «контур считается прижатым к вертикали»,
и он должен масштабироваться толщиной штамба, а не оставаться константой 32 em-units. Предлагаемая
нормировка: `eps = 0.32 · толщина_штамба`, что для `YS Text` даёт текущее значение.

#### 8.3. Знаки препинания без ручной таблицы

Слабое место: на пунктуации модель не работает (R² = 0.18, § 10.4), и для `YS Text` мы закрываем
это таблицей на ~40 знаков, выверенной глазом. Для произвольной гарнитуры такой таблицы нет.

Замена — использовать полуапроши самого шрифта как оценку: у пунктуации дизайнер задаёт их
осмысленно, потому что эти знаки почти всегда стоят внутри строки, а не прижимаются к краю.
Предлагаемое правило: `компенсация = sb(знак) − sb(плоский штамб)`, обрезанная снизу нулём.
Оно грубее ручной таблицы, но не требует ручной работы и заведомо лучше нуля. Ручная таблица при
этом остаётся: если она есть для данной гарнитуры, она приоритетнее формулы.

#### 8.4. Как проверять без эталона

Ручная выкладка есть только для одной гарнитуры, поэтому набор автоматических проверок:

1. **Инвариант плоского штамба** — компенсация плоских знаков равна нулю, σ не хуже 0.05 px.
   Жёсткий тест: он падает при любой ошибке в съёме метрик или в нормировке `eps`.
2. **Монотонность** — чем круглее и открытее знак, тем больше вылет. Проверяется порядком
   `H < S < O < A < W` без обращения к абсолютным величинам.
3. **Симметрия** — у симметричных знаков (`O`, `H`, `X`, `Ж`) компенсация слева и справа обязана
   совпадать. Расхождение означает ошибку в профилировании контура.
4. **Контрольный лист** — генерация страницы со всеми знаками, прижатыми к линии, для просмотра
   глазом. Это не автотест, но именно так дизайнер проверяет результат за минуту.
5. **Регрессия на `YS Text`** — при любой правке модели коэффициенты на нашей гарнитуре обязаны
   воспроизводить R² = 0.753 и RMSE = 0.098 px. Защита от того, чтобы обобщение сломало частный
   случай.

#### 8.5. Что даёт этап

- загрузка любого TTF / OTF / WOFF2 перетаскиванием, включая вариативные;
- **автокомпенсация без эталонной выкладки**: метрики файла → параметры окна и коэффициенты →
  вылет знака за кромку, тот же API `Compensator`, что на YS Text;
- выбор нескольких гарнитур в одном макете (знак одной, слова другой) — у каждой свой съём
  и своя калибровка;
- кэш профилей на гарнитуру и инстанс, чтобы live-рендер не тормозил;
- отчёт по гарнитуре: что удалось снять, где сработал фолбэк, прошли ли инварианты. Это же
  диагностика для случая «шрифт странный, результат неожиданный».

**Критерий готовности:** после дропа чужого шрифта (без ручной таблицы) легенды прижимаются
к полю с компенсацией, посчитанной только из метрик и контуров этого файла; на YS Text
регрессия § 8.4 п. 5 не ломается; инварианты 1–3 проходят хотя бы на гротеске, антикве,
узкой и жирной гарнитуре из контрольного набора.

Первый срез Stage 8 готов: добавлен чистый `app/kb/fontprobe.js` и Node harness
`analysis/fontprobe.mjs`. Модуль принимает уже распарсенный `Typeface` из `typography.js` и
снимает: names, `unitsPerEm`, cap-height и x-height с геометрическим приоритетом (`glyph:H`,
`glyph:x` на YS Text), ascender/descender с OS/2→hhea fallback, italic angle, weight/width class,
измеренный вертикальный stem (`glyph:I`), средние flat/round sidebearings, variation axes и
named instances из `fvar`. `autoCompensationParams()` строит объект того же формата, что
`YS_TEXT_REGULAR`: `eps`/`w` масштабируются от измеренного stem, коэффициенты — от
flat/round sidebearing delta, punctuation table грубо генерируется из sidebearings для случая,
когда ручной таблицы у гарнитуры нет. Для YS Text Regular регрессия возвращает ровно текущие
`eps=32`, `w=300` и исходные coefficients. `runCompensationInvariants()` проверяет flat-stem,
monotonic `H < S < O < A < W` и symmetry (`O`, `H`, `X`, `Ж`) без эталонной выкладки.
`analysis/fontprobe.mjs` проверяет YS Text Regular и YS Text Variable: variable font exposes
`wght` / `wdth` axes with defaults `400` / `100`, named instances are visible, and invariants pass.

Второй срез Stage 8 готов: Type panel получил `Drop font file`, `Browse Font` и `Reference font`.
Файл TTF/OTF/WOFF/WOFF2 разбирается через тот же `parseFont()`; после успешного импорта активный
`TYPEFACE` меняется, layout cache и `Compensator` cache инвалидируются, `buildLegends()` начинает
рисовать live contours из новой гарнитуры, а `compFor()` строится от `autoCompensationParams()`
этой гарнитуры. Статус показывает имя гарнитуры, файл/размер, UPM, cap/x-height, stem, оси
вариативного шрифта, параметры компенсации и результат invariants. Импортированный font file
остаётся **сессионным**: он не сохраняется в presets/model JSON, чтобы JSON не начинал таскать
бинарники и не ломал переносимость. Browser smoke на `YS Text-Bold.ttf` подтвердил переключение
статуса, 176 outline paths, включение `Reference font`, установку custom `@font-face`, чистую
консоль и корректный сброс обратно на `YS Text Regular`.

Финальный срез Stage 8 готов: одиночный `FONT_IMPORT` заменён на session font registry.
`Active font` выбирает дефолтную гарнитуру макета, `Apply selected` записывает `fontId` во все
текстовые элементы выбранных клавиш, а Legend editor получил per-element `Font` select для
точечной смеси гарнитур в одном макете. `fontId` проходит через `model-io` sanitizer и
`keyboarder.model.v1`; это только ссылка на session profile, не бинарник. `slots.js` теперь
получает `typefaceFor(el)` и `compForElement(el)`, поэтому baseline, ink boxes и edge
compensation считаются по фактической гарнитуре каждого элемента. Для variable fonts UI показывает
named instances и axis controls; координаты входят в cache signature и SVG `<text>` получает
`font-variation-settings`. В `Text` mode session font faces встраиваются в SVG `<defs>` как data
URL, чтобы экспорт был самодостаточным; JSON при этом остаётся лёгким. `Control sheet` генерирует
SVG с контрольными знаками по всем загруженным профилям, прижатыми к edge line с их текущей
моделью компенсации. `analysis/fontprobe.mjs` расширен на несколько локальных YS Text weights:
проверяет рост `eps` вместе с весом, стабильность flat-stem invariant и допускает diagnostic
`check` на тяжёлых весах, где строгий порядок `H < S < O < A < W` может честно флагнуть модель.

Caveat: текущий локальный `opentype.js` читает `fvar`, но не применяет `gvar`-дельты к outline
contours. Поэтому variable axes/instances уже работают как UI/profile/cache/CSS-text workflow,
а outline preview/export остаётся на контурах default instance до будущей замены или расширения
font engine. Это явно показывается в font status.

---

## 6. Порядок портирования Python → JS

Чтобы не растерять точность, порт идёт с покомпонентной сверкой. Для каждого модуля пишется
крошечный харнесс, который прогоняет один и тот же вход через Python и через JS и сравнивает.

| Python | JS | Что сверяем |
|---|---|---|
| `font.py` | `kb/typography.js` | UPM, capHeight, xHeight, ink-бокс и advance для всех 176 строк макета |
| `optics.py` | `kb/optics.js` | профили и признаки `noncontact` / `recess` для 69 букв и цифр |
| `model.py` | `kb/compensate.js` | предсказанная компенсация, до 1e-6 |
| `types_.py` | `kb/grid.js` | ширины в U, разбиение на блоки |
| `final.py` | `kb/slots.js` + `templates.js` | код слота и имя шаблона для всех 110 клавиш |

`analysis/` остаётся источником истины: Python считает медленнее, но он уже проверен на макете.

---

## 7. Технические риски

| Риск | Оценка | Что делаем |
|---|---|---|
| opentype.js даст метрики, отличные от fontTools | низкий | сверка на этапе 6 порядка; расхождения ожидаются только в округлении |
| Профили контура по сканлайнам тормозят live-рендер | средний | признаки зависят только от гарнитуры → считать один раз при загрузке шрифта, кэшировать по кодовой точке. 176 строк × 24 сканлайна — единицы миллисекунд |
| Вложенная модель против плоских пресетов фреймворка | средний | свои `collectPreset` / `applyPreset` / `snapshot` / `restore`; `ShareCodec` получит `heavyKeys` для массива клавиш |
| Ссылки на CDN (CoFo Sans, экспортные библиотеки) | низкий | `opentype.js`, `jsPDF` и `svg2pdf` уже локализованы в `vendor/lib`; UI-шрифт CoFo Sans всё ещё внешний и может фолбэкнуться |
| `ui-framework` удалят до того, как скопируем | низкий | копирование — самый первый шаг этапа 0 |
| Шрифт YS Text под лицензией с `fsType=4` | требует решения | см. вопрос 6 |
| Коэффициенты компенсации не переносятся на другие гарнитуры | **высокий** | этап 8: самокалибровка по полуапрошам гарнитуры плюс четыре инварианта, которые не требуют эталона (§ 8.4). Риск нельзя закрыть заранее — только измерением на нескольких шрифтах |
| Шрифты врут в `OS/2` (cap-height, x-height) | средний | всегда мерить геометрически по ink-боксу `H` и `x`, объявленные значения только как подсказку (§ 8.1) |
| Вариативные шрифты: метрики дефолтного инстанса не равны выбранному | средний | снимать метрики и контуры после применения координат по осям, кэшировать на инстанс |

---

## 8. Оценка

| Этап | Объём |
|---|---|
| 0. Каркас | 0.5 дня |
| 1. Бета: геометрия | 1–2 дня |
| 2. Бета: легенды | 2–3 дня |
| 3. Бета: верификация | 1 день |
| **Бета целиком** | **5–7 дней** |
| 4. RC: редактирование | 2–3 дня |
| 5. RC: библиотека раскладок | 1–2 дня |
| 6. Про: импорт чертежа | 3–4 дня |
| 7. Про: производство | 2–3 дня |
| 8. Про: автокомпенсация любой гарнитуры по метрикам файла | 4–5 дней |
| **Про целиком** | **17–24 дня** |

Этап 8 — самый дорогой не из-за объёма кода, а из-за измерений: обобщение модели придётся
проверять на нескольких непохожих гарнитурах (гротеск, антиква, узкая, жирная), и часть времени
уйдёт на подбор нормировок, а не на реализацию. Именно здесь компенсация перестаёт быть
«калибровкой под YS Text» и становится функцией от шрифтового файла.

---

## 9. Принятые решения

| № | Вопрос | Решение |
|---|---|---|
| 1 | Вертикальное сжатие 0.648 % | **Воспроизводить как есть** — это данность чертежа. Шаг Y и высота клавиши задаются независимо от X, никакого «квадратим клавишу» |
| 2 | Текст в превью и экспорте | **Превью кривыми** через opentype.js, **экспорт на выбор**: живой `<text>` или кривые |
| 3 | Объём беты | **Генерация из модели + верификация**, без редактирования мышью. Клик-редактирование — этап 4 |
| 4 | Эталон верификации | **`LCAKB23.svg` как есть**, включая ручную компенсацию. Любое расхождение — ошибка модели, а не улучшение |
| 5 | Шрифты (бета) | **Не копировать**, читать `Fonts/YS Text/YS Text-Regular.ttf` напрямую. Только Regular |
| 6 | Шрифты (про, этап 8) | **Любой файл**: полный съём метрик → автокалибровка компенсации. YS Text остаётся регрессионным эталоном, не единственным поддерживаемым шрифтом |
| 7 | Единицы в UI | **Размеры — только мм, кегли — только pt.** Внутри по-прежнему px (= pt). Двойного вывода px/мм в панелях нет |
| 8 | Название | **Keyboarder.** `storageKey` пресетов — `keyboarder`, экспорт — `keyboarder.svg` |
| 9 | Стартовый пресет | **`LCAKB23` загружается по умолчанию.** Шары/URL-параметры могут переопределить старт, но обычный заход открывает эталон |

Следствия, которые надо держать в голове при реализации:

- **Решение 1** означает, что в модели `grid` нет единого «размера юнита»: `colPitch` / `rowPitch`
  и `keyWidth1U` / `keyHeight` — четыре независимых числа. Слайдеры в панели Grid тоже
  раздельные, без связывания.
- **Решение 2** делает `render()` независимым от того, установлен ли YS Text в системе
  пользователя: рисуем контурами из TTF, `@font-face` для превью не нужен вообще.
- **Решение 4** задаёт жёсткий критерий приёмки этапа 3 и запрещает соблазн «подкрутить эталон
  под модель». Худшие знаки (`Т` справа, 0.286 px) останутся в отчёте красными — так и надо,
  это честный индикатор незакрытого признака «где по высоте расположен просвет».
- **Решение 5**: путь содержит пробелы, значит в `fontPaths` он должен быть
  URL-энкоден — `Fonts/YS%20Text/YS%20Text-Regular.ttf`. На регистр тоже внимание: папка
  называется `Fonts` с большой буквы, а веб-сервер регистрозависим.
- **Решение 6**: `compensate.js` уже принимает `params` снаружи — на этапе 8 достаточно
  собрать тот же объект из `fontprobe`, не меняя формулу. Бета остаётся на `YS_TEXT_REGULAR`.
- **Решение 7**: настройки сетки в `settings` хранятся в мм, в `buildLayout` уходят через `toPx`.
  Кегли в Type-панели — в pt; поскольку 1 px = 1 pt, в типографику они идут как есть.

## 10. Открытые вопросы

Не блокируют бету, но понадобятся к этапам 5–7.

**1. Иконки.** 28 пиктограмм в макете. Вытащить из `LCAKB23.svg` как готовые пути и сложить
в библиотеку, или сделать параметрическими (стрелка строится по размеру)? Параметрические гибче
при смене размера клавиши, но 13 f-иконок так не опишешь — они рисованные. Предлагаю гибрид:
стрелки и `tab` / `backspace` параметрические, f-иконки — путями.

**2. Цвета.** Эталон — `#e6e7e8` по `#1c1f22`. Делать настраиваемыми (тогда инструмент годится
и для светлых накаток), или это константы бренда?

**3. Разрывы между блоками.** Сейчас 11.88 px (1.61 обычного зазора) между `main` / `nav` /
`numpad`. Это подгонка под конкретный корпус или параметр, который пользователь должен менять?

**4. Лицензия шрифта.** У вариативной версии `fsType=4` (Preview & Print). Для локальной работы
вопрос не стоит; если инструмент когда-нибудь выложим в сеть, TTF будет качаться браузером
в открытом виде.

**5. Набор раскладок для этапа 5.** Какие форм-факторы нужны кроме нашего 96 % — TKL, ISO,
65 %, 60 %? И нужны ли языки помимо латиницы и кириллицы?
