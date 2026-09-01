# План централизации Lunnen Tools

Этот документ — исполнимый план создания автономной экспериментальной среды в `/upgrade` для восьми инструментов Lunnen на одном общем framework.

Главные ограничения:

- никакие файлы вне `/upgrade` не изменяются;
- сначала сохраняется текущее поведение, затем выполняется унификация;
- Sparky имеет наивысший приоритет и становится обязательным compatibility-sentinel;
- полноценная мобильная поддержка обязательна только для Sparky;
- все runtime-зависимости находятся внутри `/upgrade`, кроме явно запущенного пользователем импорта Google Sheets в Sticky Fingers;
- оригинальные `localStorage` и IndexedDB не читаются и не изменяются.

## 1. Зафиксированные решения

1. Копируется только активный код, необходимые assets, пресеты, vendor-библиотеки и полезные тесты.
2. Не копируются `.DS_Store`, `node_modules`, `_backup`, временные результаты и заведомо исторические снимки.
3. Верхний `grid_generator` — источник текущего поведения Pizza Boxer. Вложенный `v2` — только donor будущих улучшений.
4. Основной Wander Bender сохраняет Radial, Random и Flow Field. `pattern/` — donor реализации v3.
5. В `/upgrade` создаётся общий Node/Vite workspace.
6. Сначала достигается точный функциональный и визуальный паритет. Унификация выполняется отдельной фазой.
7. Полноценная мобильная поддержка обязательна только для Sparky.
8. Все runtime-зависимости размещаются внутри `/upgrade`.
9. Google Sheets остаётся единственным разрешённым внешним функциональным сервисом.
10. Все browser-storage пространства получают новые имена. Автоматического чтения и миграции данных оригинальных инструментов не будет.
11. URL: `/upgrade/`, `/upgrade/sparky/`, `/upgrade/grid_generator/` и так далее.
12. Первая очередь: Sparky, Pizza Boxer, Sticky Fingers, Keyboarder, Wordplayer. Второстепенные инструменты не мигрируются до прохождения общего gate первой очереди.

## 2. Целевая структура

```text
upgrade/
├── index.html
├── package.json
├── SOURCE_MANIFEST.json
├── .gitignore
├── docs/
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── MIGRATION_STATUS.md
│   └── PLAN.md
├── framework/
│   ├── README.md
│   ├── src/
│   │   ├── core/
│   │   ├── render/
│   │   ├── ui/
│   │   ├── history/
│   │   ├── preset/
│   │   ├── share/
│   │   ├── export/
│   │   ├── effects/
│   │   ├── geometry/
│   │   └── utils/
│   ├── css/
│   ├── fonts/
│   ├── vendor/
│   └── tests/
├── sparky/
├── grid_generator/
├── label_generator/
├── keyboarder/
├── wordplayer/
├── dither/
├── wander_bender/
├── pulsar_coder/
├── scripts/
├── tests/
└── baselines/
```

Приложения импортируют общий код только из `../framework/`. Framework не импортирует код приложений.

## 3. Контракт изоляции

### 3.1. Файловая система

Разрешены изменения только в `js/YF/upgrade/**`.

Запрещены изменения:

- `js/YF/lunnen/**`;
- `js/othersite-ui-framework/**`;
- `mishaivanov.ru/void/**`;
- `js/YF/index.html`;
- любых других файлов репозитория.

Перед каждой задачей выполняется `git status --short`. После задачи выполняются `git diff --name-only` и `git status --short -- js/YF/upgrade`. Уже существующие изменения `.DS_Store` нельзя исправлять, удалять или включать в коммиты.

### 3.2. Runtime-пути

Внутри `/upgrade` запрещаются:

- импорты, покидающие `/upgrade`;
- обращения к `/js/YF/lunnen/` и `/js/othersite-ui-framework/`;
- абсолютные ссылки `/js/YF/`;
- symlink, чей `realpath` находится вне `/upgrade`;
- загрузка шрифтов или библиотек с CDN;
- fallback на GitHub API;
- неявные зависимости от соседних проектов.

Разрешены запросы к Google Sheets только при явном действии пользователя в Sticky Fingers. SVG namespace `http://www.w3.org/2000/svg` не является сетевой зависимостью.

### 3.3. Browser storage

Формат ключей:

```text
upgrade:<tool>:<subsystem>:v<schema>
```

Примеры:

```text
upgrade:sparky:presets:v1
upgrade:sparky:ui:v1
upgrade:keyboarder:presets:v1
upgrade:keyboarder:svg-export-mode:v1
upgrade:wordplayer:presets:v1
upgrade:grid-generator:drafts:v1
```

IndexedDB Pizza Boxer: `upgrade-pizza-boxer-v1`.

Запрещается автоматически читать, изменять или удалять старые ключи и базы. Возможный импорт старых данных — отдельная будущая функция с предпросмотром и подтверждением.

## 4. Общая стратегия

Работа разделяется на четыре типа изменений, которые нельзя смешивать в одной задаче:

1. Копирование и изоляция.
2. Достижение паритета.
3. Подключение общего framework.
4. Улучшение и унификация.

Одна задача должна иметь один небольшой результат и один логический commit.

## 5. Фаза 0 — эталоны и происхождение файлов

### UPG-000. Документация решений

Создать `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/MIGRATION_STATUS.md` и `SOURCE_MANIFEST.json`.

Зафиксировать:

- v3 как основу framework;
- верхний Pizza Boxer как текущий baseline;
- Grid v2 и Wander Pattern как donors;
- Void как donor общих решений, но не источник для копирования приложения;
- запрет runtime-зависимостей вне `/upgrade`;
- приоритет и особый gate Sparky.

### UPG-001. Manifest исходников

Для активных файлов записать инструмент, исходный и целевой путь, размер, SHA-256, категорию и решение `copy`, `exclude` или `donor-only`.

Явные исключения: `.DS_Store`, `node_modules`, `_backup`, coverage, caches, временные результаты и вложенный `grid_generator/v2`.

Собранный runtime верхнего Pizza Boxer переносится вместе с source tree, потому что именно его использует текущий `index.html`.

### UPG-002. Тестовый baseline

Зафиксированный исходный baseline:

- верхний Pizza Boxer: 165/165;
- Grid v2 donor: 221/222, один test-environment failure из-за отсутствия `requestAnimationFrame`;
- Sparky: 195/195;
- Wordplayer: оба worker-набора проходят.

Для проектов без полного test suite создаются ручные сценарии.

### UPG-003. Визуальный baseline

Для всех инструментов: viewport 1440×900, ожидание `document.fonts.ready`, screenshot, console messages, сетевые запросы, 404, размеры canvas/SVG и панелей.

Для Sparky дополнительно: 390×844 и 430×932, mobile showcase, touch interactions, export, safe areas и отсутствие горизонтального scroll.

Существующие особенности, включая mobile overflow второстепенных инструментов и исходные console warnings, фиксируются и не исправляются на паритетной фазе.

Gate G0: manifest и baselines готовы, исходные тесты воспроизводимы, оригинальные проекты не изменены.

## 6. Фаза 1 — чистое копирование и первичная изоляция

### UPG-010. Скопировать восемь активных проектов

Копировать активные runtime/source/assets/presets/vendor/tests без `.DS_Store`, `node_modules`, `_backup` и Grid v2. Локальные framework-копии v3-инструментов временно сохраняются до доказанного переключения на общий framework.

Wander Pattern можно временно сохранить как `donor-only`; он не показывается в индексе и не используется основным runtime.

### UPG-011. Исправить только relocation-пути

Разрешены только изменения путей: ссылка назад `../`, assets, workers, fonts, presets и built runtime. DOM, CSS-классы, размеры и алгоритмы не изменяются.

### UPG-012. Создать индекс

Восемь ссылок в порядке:

1. Sparky
2. Pizza Boxer
3. Sticky Fingers
4. Keyboarder
5. Wordplayer
6. Dither Wizard
7. Wander Bender
8. Pulsar Coder

### UPG-013. Локализовать зависимости

Разместить внутри framework vendor Paper.js, jsPDF, svg2pdf, OpenType и лицензии. Локализовать UI-шрифты.

### UPG-014. Изолировать storage

Переименовать все localStorage keys, seed markers, debug flags и IndexedDB. Создать тест с sentinel-значениями оригинальных ключей.

### UPG-015. Boundary scanner

Проверять статические import-графы, `realpath`, абсолютные пути, внешние URL, workers, fonts, dynamic scripts и symlinks. Allowlist содержит только Google Sheets.

Gate G1: восемь копий запускаются, индекс работает, runtime не выходит наружу, оригинальные данные не изменяются, визуальные отличия объяснимы только relocation/local fonts.

## 7. Фаза 2 — общий framework

### UPG-020. Перенести ядро v3

Перенести Settings, DOMCache, ApplicationShell, defineTool, ShortcutRouter, SVG/Canvas targets, UI controls, panels, color picker, dice, dialogs, tooltips, zoom/pan, history, presets, sharing, exporters, effects и utilities. `framework/src/index.js` становится публичной точкой импорта.

### UPG-021. Публичные контракты

Документировать config, lifecycle, render context, storage namespace, preset/export hooks, CSS overrides, optional capabilities и backward compatibility. В framework запрещены условия по имени приложения.

### UPG-022. Универсальные улучшения Keyboarder

Перенести local vendor loaders, configurable text-to-outline, editable/outlined SVG, SVG/XML serialization, PDF font embedding, `suggestSaveName` и timeout preset fetch.

### UPG-023. Универсальные улучшения Sparky

Перенести preset migration hook, `forceSeed`, shortcut `space`, `SvgTarget.interactive`, `data-export-exclude`, fit по artboard, collapse/restore всех панелей и transient slider display value.

### UPG-024. Общие идеи Void

Добавить deterministic RNG, per-preset history, shared temporary preset, unsaved guard, short/full share URL, export-without-reroll и optional mobile bootstrap. Не переносить Void-specific glyph/domain code, аналитику и внешние ссылки.

### UPG-025. CSS compatibility

База — v3/Void CSS. Framework CSS подключается раньше app CSS. DOM ID/class не переименовываются. Mobile framework включается только capability-конфигурацией. Массовые изменения глобальных selectors запрещены.

### UPG-026. Framework conformance suite

Проверить SVG/Canvas, controls, history, presets, migrations, share, storage, vendor loading, export exclusions, deterministic render, zoom, panels, listener disposal и отсутствие сетевых/app dependencies.

Gate G2: framework самодостаточен, SVG/Canvas demos проходят, API документирован, CDN отсутствуют.

## 8. Фаза 3 — пять основных инструментов

Технический порядок: Wordplayer, Keyboarder, Sparky, Pizza Boxer, Sticky Fingers. Второстепенные приложения запрещены до общего Gate G3.

### 8.1. Wordplayer

- заменить локальные foundation imports общими;
- сохранить HTML, Canvas renderer, fit padding, workers, caches и собственный export;
- не менять Dither/Forms algorithms;
- проверить modes, text/fonts, assets, undo/redo, presets, share, exports, worker tests, screenshots, console и network.

После приёмки Wordplayer становится Canvas-canary.

### 8.2. Keyboarder

- заменить framework imports, сохранив domain-код;
- изолировать presets, UI mode, SVG text mode и performance flag;
- проверить регистр font paths на Linux;
- проверить layouts, custom SVG, simple/advanced, legends, fonts, editable/outlined SVG, PDF, JSON/model, share и presets;
- проверить геометрию artboard/caps/legends и отсутствие внешних запросов.

После приёмки Keyboarder становится SVG/export-canary.

### 8.3. Sparky — protected track

- до переключения зафиксировать 195 тестов, desktop/mobile, modes, focus editor, SVG import, exports, animation samples, presets и share;
- заменить только framework imports, не меняя формулы и timing;
- отключить автоматическое чтение `lunnenSparkyGeneratorV1/V2`;
- проверить mobile на 390×844 и 430×932, отсутствие desktop flash, safe areas, touch и export;
- проверить deterministic frames, animation timings, focus, eyes, blur, static SVG, path import и все текущие форматы;
- после приёмки сделать Sparky обязательным sentinel для любого изменения framework.

Обязательный набор после каждого framework-коммита: framework, Wordplayer, Keyboarder и Sparky tests, desktop/mobile Sparky visual и isolation check.

### 8.4. Pizza Boxer

- верхняя версия остаётся baseline: schema 1.2, 19 presets, 101 runtime modules, 15 hashed assets, 165 tests;
- root workspace вызывает существующий Vite tooling;
- использовать framework adapters, не переписывать Grid Application на defineTool;
- Grid document, placement, surfaces, objects, typography и render pipeline остаются domain code;
- IndexedDB переименовать в `upgrade-pizza-boxer-v1`;
- проверить presets, grid/sides, rotation, zoom, text, graphics, layers, clipboard, drag, history, recovery, JSON/SVG/PDF и runtime reproducibility.

Результат UPG-033 — выполнено: modular vanilla-JS Grid Application сохранён, общий `ColorUtils` подключён через единственный façade, production entry импортирует public barrel непосредственно из `/upgrade/framework`, 165 исходных и один boundary-test проходят, 15-file runtime воспроизводим, desktop DOM/CSS/SVG geometry совпадает с baseline.

Grid v2 переносится только после паритета отдельными feature-коммитами. Перед этим donor suite должен проходить 222/222, schema migration и golden geometry обязательны.

### 8.5. Sticky Fingers

- `presets/manifest.json` становится единственным источником списка presets;
- удалить directory listing и GitHub API runtime fallback;
- локализовать PDF/OpenType/fonts;
- вводить framework через небольшие façade-модули, не переписывать большой `script.js` одним заданием;
- сохранить Google Sheets как единственную внешнюю функцию;
- проверить presets, data import, edit mode, grid, barcodes, text styles, objects, colors, SVG/PDF и исходное checksum behavior.

Результат UPG-034 — выполнено: legacy GridGenerator сохранён, общий `ColorUtils` подключён через façade, TT Commons централизован без изменения байтов, manifest стал единственным источником трёх presets, Google Sheets и PDF проверены в браузере, исходное EAN-13 warning сохранено, normal/edit geometry совпадает с baseline.

Gate G3 — пройден: пять основных инструментов используют общий framework, проходят acceptance, не имеют локальных framework-копий, Sparky не регрессировал, `test:tier1`, storage и boundary checks проходят.

## 9. Фаза 4 — второстепенные инструменты

### Pulsar Coder

Первый secondary legacy-adapter. Сохранить SVG renderer, presets, encoding, visual parameters, zoom и export. После паритета заменить v1 UI-компоненты.

Результат UPG-040 — выполнено: общие `PanelManager` и `SliderController` подключены через единственный façade, локальные копии удалены, shared CSS загружается нижним cascade layer под замороженным skin, codec/SVG/presets/private zoom сохранены, восемь тестов и browser parity проходят. Существующий дефект `verifyPulsar()` (несовпадающий порядок split/reconstruction) записан отдельно и не исправлялся в миграционном изменении.

### Dither

Оставить алгоритмический монолит нетронутым. Подключать общий panel/control/history/export shell отдельно от image transforms, overlay и dithering. Mobile overflow не исправлять в этой миграции.

Результат UPG-041 — выполнено: общий `ColorUtils` и `PanelManager` подключены через единственный façade, прежний 118-строчный panel-drag удалён, а два исходных правила Dither (z-index меняется только при drag и координаты не ограничиваются viewport) сохранены в совместимом подклассе. Shared CSS активен нижним cascade layer под замороженным skin. Алгоритмы, Canvas/overlay, transforms и PNG export остались частными. Девять тестов проходят; default, Bayer и Pixel Size 4 имеют побайтово одинаковые source/upgrade screenshots; исходный desktop/mobile overflow намеренно не менялся.

### Wander Bender

Подключать режимы Radial, Random и Flow Field по одному. Paper.js локализуется, Paper geometry остаётся domain code. Pattern Bender используется как donor deterministic RNG, ranges, physical-size export и preset/share, но не заменяет основной инструмент.

Результат UPG-042 — выполнено: общие `PanelManager` и `SliderController` подключены через единственный façade, локальные дубликаты удалены, Paper.js загружается из shared local vendor. Radial, Random, Flow Field, Paper geometry, extraction, SVG export и отличающийся zoom остались частными. Shared CSS активен нижним cascade layer; исходные длинные панели и disabled-control appearance сохранены parity bridge. Десять тестов проходят; три режима, Rays 3→6, collapse, extraction и reset совпадают с исходником в browser acceptance. `pattern/` остаётся только donor и не входит в runtime.

Gate G4 — пройден: восемь ссылок работают, восемь приложений используют общий framework, desktop сохранён, CDN отсутствуют, `gate:g4:static` и boundaries проходят. Отличия исходных back links от `←Upgrade Tools` являются согласованной relocation-правкой.

## 10. Фаза 5 — унификация после паритета

Последовательно унифицировать tokens, top navigation, preset toolbar, panel headers, controls, dialogs/tooltips, errors и export UI. Один framework-компонент — один commit и один visual-review набор.

Нельзя автоматически обновлять visual baselines в том же задании, которое изменяет UI. Каждое отличие классифицируется как ожидаемое улучшение, rasterization difference, regression или изменение, требующее решения владельца.

Исполнимая разбивка UPG-050—UPG-059, compatibility matrix, порядок rollout и acceptance template находятся в [G5_UNIFICATION_PLAN.md](./G5_UNIFICATION_PLAN.md). Первый runtime-шаг — нижнеслойное подключение shared CSS к Pizza Boxer, затем отдельной задачей к Sticky Fingers, без изменения внешнего вида.

Текущий статус: UPG-050—UPG-059 завершены, Gate G5 пройден. Все восемь приложений используют
shared component boundaries; пять frozen universal resets и 21 временный
`all: revert-layer` promotion удалены до 0/0 без изменения активной геометрии,
domain output или dialog lifecycle. Финальный cleanup/smoke gate и отдельная
машинная команда `gate:g5:static` зелёные; обязательных миграционных этапов не
осталось.

## 11. Матрица проверок

| Проверка | Все | Sparky | Pizza Boxer | Sticky Fingers |
|---|---:|---:|---:|---:|
| Desktop screenshot | Да | Да | Да | Да |
| Mobile screenshot | Нет | Да | Нет | Нет |
| Console/404 | Да | Да | Да | Да |
| Storage isolation | Да | Да | IndexedDB | Да |
| Offline runtime | Да | Да | Да | Кроме Sheets |
| Presets/share/history | Где есть | Да | Да | Presets |
| Export | По возможностям | Все текущие | SVG/PDF/JSON | SVG/PDF |
| Determinism | Генеративные | Обязательно | Golden geometry | Print geometry |
| Build reproducibility | Да | Да | Обязательно | Да |

## 12. Корневые команды

Постепенно реализовать:

```text
npm run dev
npm run build
npm run build:all
npm run test
npm run test:framework
npm run test:tier1
npm run test:all
npm run test:sparky
npm run test:pizza-boxer
npm run test:keyboarder
npm run test:wordplayer
npm run test:sticky-fingers
npm run test:visual
npm run test:visual:sparky
npm run check:isolation
npm run gate:g5:static
npm run check:storage
npm run check:network
npm run check:assets
npm run check:source-integrity
```

## 13. Шаблон задачи для быстрой модели

```text
Цель:
[один конкретный результат]

Разрешённые файлы:
js/YF/upgrade/...

Запрещённые файлы:
всё вне js/YF/upgrade

Прочитать:
- upgrade/docs/PLAN.md
- upgrade/docs/ARCHITECTURE.md
- upgrade/docs/MIGRATION_STATUS.md
- перечисленные source files

Требуемые изменения:
1. ...
2. ...

Не делать:
- не менять domain algorithms;
- не обновлять visual baselines;
- не читать старые storage keys;
- не добавлять внешние зависимости;
- не редактировать оригиналы.

Проверка:
- npm run ...
- npm run check:isolation
- git diff --name-only

Остановиться при:
- изменении вне upgrade;
- необъяснимом visual diff;
- падении исходного теста;
- необходимости изменить framework API;
- неизвестном источнике истины.

Отчёт:
- изменённые файлы;
- тесты;
- отличия;
- риски следующего шага.
```

## 14. Стоп-условия

Работа останавливается, если изменился файл вне `/upgrade`, появился runtime-import наружу, изменились оригинальные storage/IndexedDB, появился незадокументированный внешний запрос, изменился export без объяснения, baseline обновлён автоматически, app-name condition добавлен в framework, Grid v2 заменил baseline до паритета, Wander потерял режим или Sparky перестал проходить desktop/mobile gate.

## 15. Definition of Done

- `/upgrade/index.html` содержит восемь рабочих ссылок;
- runtime целиком внутри `/upgrade`;
- существует один общий framework без полных локальных копий;
- app-specific код остаётся в приложениях;
- Google Sheets работает только в Sticky Fingers;
- остальной runtime работает без сети;
- storage оригиналов не читается и не изменяется;
- desktop-поведение восьми инструментов сохранено;
- mobile Sparky сохранён;
- exports сохранены;
- root-команды воспроизводят проверки и сборку;
- пять основных инструментов имеют формальные acceptance suites;
- framework-изменения автоматически проверяют основные приложения;
- `git diff` не содержит изменений вне `/upgrade`.

Первый практический этап — UPG-000–UPG-003. Копирование начинается только после Gate G0.
