# План выделения переносимого UI Garage

Статус: **Complete — UI Garage 1.0.0 released**
Дата фиксации: 2026-09-06
Область текущего source of truth: `upgrade/**`
Изолированный extraction workspace: `upgrade/extracted/ui-garage/**`

## 1. Как пользоваться этим документом в новом чате

Этот файл должен быть достаточен для продолжения работы без истории текущего
чата.

В начале нового чата:

1. прочитать этот документ целиком;
2. прочитать `MIGRATION_STATUS.md`, последний gate-документ,
   `framework/CONTRACT.md` и этот файл;
3. проверить `git status` и не затирать чужие незакоммиченные изменения;
4. выполнить актуальный baseline gate из раздела Preconditions;
5. начинать с первой незавершённой фазы;
6. после каждой принятой фазы обновлять раздел `Execution status` этого файла
   и прикладывать команды, результаты и ссылки на evidence;
7. не объединять две фазы в одно изменение, если у них разные rollback
   conditions.

Extraction уже начат в изолированной папке. Текущие приложения запрещено
переключать на неё на любой фазе. Их imports, HTML, CSS, production runtime,
build и storage остаются независимыми от portable copy. Папку `ui-garage/`
должно быть можно переместить или удалить без каких-либо последствий для восьми
существующих инструментов.

## 2. Зафиксированное намерение владельца проекта

Нужен автономный framework, который можно использовать так:

1. скопировать одну папку framework в другой репозиторий;
2. описать задачу на новый генератор графики;
3. получить инструмент с тем же визуальным языком и полным общим набором
   возможностей: controls, panels, shortcuts, history, presets, persistence,
   import/export, dialogs, file intake, zoom, mobile support и локальные assets;
4. не переносить в новый репозиторий существующие восемь инструментов;
5. не связывать существующие восемь инструментов с выделенной папкой: они
   продолжают работать на собственной текущей кодовой базе, а `ui-garage/`
   служит только чистой основой для новых инструментов.

Дополнительные решения владельца:

- одинаковые по функции компоненты должны выглядеть и вести себя одинаково во
  всех восьми текущих инструментах;
- общий shortcut contract обязателен, включая collapse/restore всех панелей;
- в переносимую папку входят JS, CSS, fonts, vendor libraries, presets/history,
  share, export/PDF, file intake и mobile layer;
- Pizza Boxer — главный эталон глубины и полноты desktop workflow;
- Sparky — эталон наиболее свежего declarative integration, responsive/mobile
  behavior и нового framework API.

## 3. Целевой результат

Работа считается завершённой, когда существуют:

1. одна каноническая, versioned, self-contained папка framework;
2. доказанная нулевая связь между этой папкой и восемью текущими инструментами:
   нет imports, asset paths, symlinks, build steps, storage dependencies или
   runtime loading ни в одну сторону;
3. два актуальных starter-приложения — SVG и Canvas;
4. один созданный с нуля clean-room test tool в отдельном чистом fixture/repo,
   сделанный из скопированной папки без доступа к исходникам существующих apps;
5. единый Component Lab и visual/keyboard/accessibility contract;
6. команды, которые доказывают автономность папки, полноту assets, отсутствие
   внешних runtime-зависимостей и отсутствие imports за её пределы;
7. release manifest с версией, hashes, browser support, public API и migration
   policy.

Runtime нового инструмента не должен требовать npm, Vite или другой сборщик.
Он должен работать как static same-origin application через обычный HTTP
server. Node.js допустим только как необязательный инструмент для tests,
verification и scaffolding.

## 4. Что означает «умеет всё, что есть в существующих инструментах»

Framework должен быть superset общих продуктовых возможностей, но не должен
поглощать предметную логику отдельных генераторов.

### 4.1. Обязательные framework capabilities

- SVG и Canvas render targets;
- settings schema/store и control synchronization;
- single-value sliders, range controls, native number inputs и choice controls;
- color picker и unified color rows;
- floating panels, drag/stack, individual collapse, collapse-all/restore;
- единые top navigation и ActionDock;
- ShortcutRouter и каноническая карта команд;
- history/undo/redo и transaction boundaries;
- presets: bundled, user-created, save/rename/delete/restore;
- share links и URL payload lifecycle;
- namespaced localStorage и IndexedDB adapters;
- optional draft/autosave/recovery infrastructure;
- JSON import/export и schema/rollback hooks;
- SVG, PNG и PDF export infrastructure;
- text-to-path и editable/outlined PDF support;
- file picker/dropzone/status/error/reselect lifecycle;
- dialogs, overlays, tooltip, status/progress/busy presentation;
- zoom, pan, fit and actual-size commands;
- mobile viewport coordination;
- deterministic random utilities and export guards;
- local fonts, local vendor libraries and license inventory;
- complete init/destroy/re-init lifecycle.

### 4.2. Что остаётся в приложениях

- генеративные алгоритмы и предметная геометрия;
- Pizza box document model, object editors и конкретная preset schema;
- Sparky character/animation geometry и конкретные codecs;
- Sticky labels, barcode и Google Sheets domain flow;
- Dither algorithms и конкретный raster pipeline;
- Keyboarder layout/font domain model;
- Wander Paper geometry и distribution modes;
- Pulsar codec/verifier semantics;
- app-specific filenames, validation text, presets and business rules.

Если уникальная возможность нужна как платформа, она выделяется в generic
capability или documented recipe. Предметный код нельзя переносить во framework
только ради заявления о feature parity.

## 5. Неподвижные архитектурные правила

Разрешённое направление зависимостей:

```text
tool -> framework public API
tool -> tool domain modules
framework public API -> framework internals
framework -> bundled framework assets/vendor
```

Запрещено:

```text
framework -> any current tool
tool A -> tool B
portable framework -> files outside copied framework folder
new project -> source files of the eight current tools
runtime -> CDN or remote font/vendor fallback
```

Все различия инструментов выражаются public config, hooks, adapters, tokens или
named modifiers. Проверки имени приложения внутри framework запрещены.

## 6. Preconditions — baseline принят 2026-09-05

- [x] завершены UPG-076—UPG-101;
- [x] полный `npm run gate:g13:static` проходит из чистой рабочей копии;
- [x] все восемь live entrypoints приняты без browser errors и 404;
- [x] Pizza public runtime соответствует source fingerprint (14 assets);
- [x] одинаковые component families и control rhythm сведены к общему contract;
- [x] общий collapse shortcut `⌘/Ctrl+\\` реализован во всех применимых tools;
- [x] desktop evidence восьми инструментов и mobile evidence Sparky актуальны;
- [x] Dither raster/output invariants зелёные;
- [x] lifecycle/re-init, export, round-trip и persistence gates зелёные;
- [x] исходная рабочая копия чистая; baseline commit:
      `5700146f4eff56d8d8ece8092dc5d85475c483b1`.

Проверенные extraction gaps не являются причиной снова откладывать работу: они
становятся задачами FX-01—FX-04. В частности, рабочий
`framework/src/ui/UnifiedUiController.js` пока содержит имена, DOM selectors и
summary logic текущих apps, а HTML entrypoints напрямую подключают внутренние
auto-init modules. Эти зависимости нельзя переносить в release как stable API.

### 6.1. Граница первой итерации

Первая итерация ограничена 30 минутами и обязана:

1. зафиксировать baseline и обновить этот план;
2. создать `upgrade/extracted/ui-garage/` как единственную папку новых
   framework-файлов;
3. скопировать туда runtime source, CSS, fonts, vendor, licenses и tests;
4. добавить status/version/baseline metadata и автономную проверку границ;
5. начать удаление app-specific knowledge только внутри isolated copy;
6. повторно проверить текущий G13 и isolated framework tests;
7. не менять imports, HTML, CSS или runtime восьми существующих tools.

Итерация не объявляет `1.0.0`, не связывает текущие приложения с candidate и не
обещает готовые starters. Следующая итерация начинается с первой незакрытой записи в
`upgrade/docs/UI_GARAGE_EXTRACTION_STATUS.md`.

Результат итерации 1: isolated candidate `0.1.0-dev.1` содержит 103 файла и 47
source modules; его 73/73 tests и boundary verifier проходят как на месте, так
и после копирования во вложенный путь с пробелами и Unicode.

Следующий выполненный пункт: папка переименована в `ui-garage`, project-specific
evidence вынесен наружу, legacy compatibility vendor удалён, branding и font
inventory очищены. Текущий результат — 92 manifested files, 47 source modules и
74/74 tests. В portable folder остаются только CoFo Sans Regular/Medium; обе
outline-версии проверены bundled OpenType parser.

FX-03 завершён в candidate `0.1.0-dev.2`: stable/optional API и ownership всех
модулей зафиксированы машинно-проверяемыми snapshots; shell/controllers получили
симметричный teardown, re-init и async cancellation; side-effect auto-init
entrypoints удалены. Текущий результат — 89 manifested files, 43 source modules
и 85/85 tests.

FX-04 завершён в portable candidate `0.1.0-dev.3`: 96 manifested files, 43
source modules и 88/88 tests. Browser smoke прошёл как на месте, так и после
копирования в чистый путь с пробелами и Unicode: без внешних requests и 404,
с валидными SVG/PNG/PDF/JSON artifacts. `create-tool.mjs` из скопированной папки
создал и запустил чистые SVG и Canvas tools, импортирующие только public barrel.

FX-06 завершён в candidate `0.1.0-dev.5`: полные `starters/svg-full` и
`starters/canvas-full` используют только public API и демонстрируют общий UI,
lifecycle, controls, panels, history, presets/share, validated JSON, file intake,
responsive mode и exports. Canvas starter дополнительно покрывает deterministic
DPR-aware raster, zoom/pan, session asset и pixel-safe PNG 1×/2× с optional SVG
hook. Оба starter прошли tests и browser acceptance; конфликтующего старого
demo внутри portable folder нет.

## 7. Целевой формат переносимой папки

Рабочее имя артефакта в этом репозитории:
`upgrade/extracted/ui-garage/`. При переносе копируется сама папка
`ui-garage/`; её runtime не должен зависеть от родительского каталога.

```text
ui-garage/
├── VERSION.json
├── README.md
├── START_HERE.md
├── CONTRACT.md
├── CHANGELOG.md
├── LICENSES.md
├── framework-manifest.json
├── src/
│   ├── index.js
│   ├── optional.js
│   └── ...
├── css/
│   ├── framework.css
│   ├── tokens.css
│   └── ...
├── fonts/
├── vendor/
├── starters/
│   ├── svg-full/
│   └── canvas-full/
├── recipes/
│   ├── persistence-and-drafts/
│   ├── json-round-trip/
│   ├── export-svg-png-pdf/
│   ├── cancellable-export-progress/
│   └── mobile/
├── component-lab/
├── tests/
└── scripts/
    ├── verify-portable.mjs
    └── create-tool.mjs
```

Требования к папке:

- её можно копировать без соседних каталогов;
- runtime imports и asset URLs остаются корректными после копирования;
- starter можно скопировать рядом и переименовать без ручного изменения
  framework source;
- `create-tool.mjs` — удобство, а не обязательное условие использования;
- release не содержит старые apps, baselines и migration-only upstream snapshot;
- tests/docs могут входить в папку, но production runtime должен иметь явно
  перечисленный минимальный набор файлов;
- все third-party версии и лицензии зафиксированы;
- отсутствуют stage cachebusters вида `?v=g5-*`, `?v=g6-*`, `?v=g7-*`;
  cache identity задаётся версией release.

## 8. Публичный контракт нового инструмента

Каждый новый tool обязан явно задать минимум:

```js
defineTool({
  id: 'unique-tool-id',
  title: 'Tool name',
  renderer: 'svg', // либо canvas
  settings: {},
  storage: { namespace: 'unique-tool-id', version: 1 },
  panels: [],
  controls: {},
  exports: {},
  shortcuts: {},
  render(context) {}
});
```

Точные поля определяются в фазе API freeze. Важен принцип: новый tool не должен
знать внутренние пути framework или самостоятельно повторять generic lifecycle.

Публичные entrypoints должны быть ограничены и зафиксированы:

- `src/index.js` — stable API;
- `src/optional.js` — bundled optional capabilities;
- `css/framework.css` — полный канонический внешний вид;
- `css/tokens.css` — документированная theming surface;
- named subpath допускается только как публично протестированный contract.

## 9. Канонический shortcut contract

Минимальная единая карта:

| Shortcut | Поведение |
|---|---|
| `⌘/Ctrl+Z` | Undo |
| `⇧⌘/Ctrl+Z` | Redo |
| `⌘/Ctrl+E` | Primary export |
| `⌘/Ctrl+J` | JSON/settings export, если capability существует |
| `⇧⌘/Ctrl+J` | JSON/settings import, если capability существует |
| `J` | Show/hide optional JSON actions, если они существуют |
| `⌘/Ctrl+\` | Collapse all expanded panels / restore exactly the previous set |
| `⌘/Ctrl++` | Zoom in |
| `⌘/Ctrl+-` | Zoom out |
| `Escape` | Закрыть верхний активный transient surface и вернуть focus |
| `Enter` / `Space` | Активировать focused button/collapse control |

Правила маршрутизации:

- одна команда обрабатывается не более одного раза;
- повторная инициализация не создаёт второй listener;
- tool-specific shortcuts регистрируются через тот же router;
- editable targets блокируют команды, которые могут испортить ввод;
- исключения для editable targets перечисляются явно и тестируются;
- Escape использует приоритет: dialog/overlay → popup/preset → ActionDock extras;
- collapse-all не превращает hidden/mode-specific panels в visible;
- инструмент без соответствующей capability не получает фиктивное действие;
- shortcut labels в UI генерируются или проверяются из той же карты.
- `⌘/Ctrl+0` и `⌘/Ctrl+1` не перехватываются: это browser-level shortcuts;
  Fit доступен через zoom indicator, actual size — только через явно
  сконфигурированную app-команду без захвата системной комбинации.

## 10. Визуальный contract

Одинаковая функция и одинаковое состояние должны иметь один framework owner.
Приложения не могут переопределять base presentation таких компонентов:

- panel shell/header/collapse/summary;
- ordinary range и value display;
- HSB controls;
- pill/chip/checkbox/switch/segmented controls;
- preset dropdown shell;
- top navigation;
- ActionDock and button variants;
- dialogs, overlays, tooltips and status states;
- file intake;
- zoom indicator.

Различие разрешено только если:

1. оно отражает отличающуюся функцию или domain state;
2. оформлено public named modifier/token;
3. присутствует в Component Lab;
4. имеет owner, reason и removal/review condition;
5. не маскирует старый app-specific duplicate.

Component Lab становится визуальным источником истины для normal, hover,
focus, active, selected, disabled, readonly, loading, success, warning, error,
open, closed, collapsed, mobile и reduced-motion states.

## 11. Фазы выполнения

### FX-00 — Подтвердить baseline

Задачи:

- выполнить все Preconditions;
- сохранить commit SHA и версии browser/runtime;
- записать восемь entrypoints, screenshots, output hashes и storage sentinels;
- подтвердить отсутствие незакоммиченных конфликтующих работ.

Acceptance:

- Gate G7 green;
- отдельный `docs/UI_GARAGE_EXTRACTION_BASELINE.json` содержит source commit и
  проверяемые evidence;
- production source не менялся.

Rollback: отсутствует — фаза read-only.

### FX-01 — Полный capability и ownership audit

Задачи:

- построить machine-readable matrix всех восьми apps;
- для каждой возможности указать `framework`, `public adapter`, `recipe` или
  `domain-private`;
- отдельно разобрать сложные workflows Pizza Boxer и свежие contracts Sparky;
- найти duplicate controllers, direct internal imports, magic DOM discovery,
  app-name checks и paths за границу framework;
- сопоставить каждый public export хотя бы с одним test, fixture или явно
  обоснованным optional use case.

Особое внимание:

- Pizza: document/history transactions, JSON schema, draft recovery,
  SVG/PDF, fragments and reproducible public runtime;
- Sparky: declarative shell, export progress/cancel, mobile, animation lifecycle,
  preset migration and full state extraction;
- Canvas: Wordplayer and Dither output/pixel invariants;
- specialized adapters: Sticky, Keyboarder, Pulsar, Wander.

Acceptance:

- нет capability без owner;
- нет public module без test, fixture или обоснованного optional status;
- список domain-private функций явно не обещается framework API.

### FX-02 — Завершить UI и shortcut contract внутри UI Garage

Задачи:

- удалить оставшиеся визуальные различия одинаковых компонентов внутри
  Component Lab и обоих starters;
- преобразовать настоящие варианты в named framework modifiers;
- подключить общий shortcut contract к обоим starters;
- добавить публичный collapse-all adapter для новых tool implementations;
- исключить двойную обработку ActionDock и tool listeners;
- синхронизировать shortcut help/copy в Component Lab и starters;
- расширить Component Lab и visual tests.

Acceptance:

- computed component styles совпадают между Component Lab и starters для
  одинаковых states;
- `⌘/Ctrl+\` работает в обоих starters с collapsible panels;
- keyboard walkthrough проходит в обоих starters без использования мыши;
- существующие восемь инструментов в этой фазе не изменяются и не используются
  как runtime consumers UI Garage.

Rollback:

- откат только текущей component family;
- baseline нельзя обновлять в том же изменении, если diff не был заранее
  объявлен как intentional и одобрен владельцем.

### FX-03 — Harden lifecycle и public API

Задачи:

- сделать `init()` и `destroy()` симметричными для всех controllers;
- снимать slider/toggle/panel/document listeners, subscriptions, timers,
  MutationObservers, RAF, workers и Blob URLs;
- гарантировать re-init без дублирования;
- удалить из isolated package внутренние side-effect auto-init entrypoints;
- запуск новых инструментов выполнять только через public API или
  декларативную часть `defineTool`;
- убрать stage query strings из внутренних imports;
- формализовать errors, async cancellation, busy state and cleanup;
- отделить stable API от optional API;
- добавить versioning и breaking-change policy.

Acceptance:

- init → destroy → init даёт по одному listener/controller;
- double export/import и aborted export завершаются чисто;
- leaked Blob URLs, hanging promises и busy states отсутствуют;
- public API snapshot и contract tests проходят;
- framework source graph остаётся application-agnostic.

### FX-04 — Собрать self-contained portable folder

Задачи:

- создать целевую структуру из раздела 7;
- перенести только runtime, public docs, tests and licenses; starters и recipes
  добавляются поверх этой автономной основы в FX-06;
- сделать все paths location-independent внутри папки;
- добавить `VERSION.json` и `framework-manifest.json`;
- добавить hashes обязательных fonts/vendor/runtime files;
- определить browser support и static-server instructions;
- написать `verify-portable.mjs`;
- написать необязательный `create-tool.mjs`;
- проверить folder names и paths с пробелами, Unicode и вложенной директорией.

`verify-portable.mjs` обязан проверять:

- imports не выходят из папки;
- assets существуют и совпадают по hashes;
- CDN/network fallback отсутствует;
- public entrypoints импортируются;
- browser-smoke использует только public entrypoint и локальные assets;
- все third-party licenses присутствуют;
- ни одно из имён восьми apps не влияет на runtime behavior.

Acceptance:

- папка копируется во временный чистый каталог;
- framework tests проходят там без исходного monorepo;
- browser-smoke открывается через static HTTP server без 404/errors и внешних
  runtime requests;
- SVG, PNG, PDF и JSON artifact smoke проходят в изоляции.

Проверка public-only imports и уникальных storage namespaces обоих starters
добавляется в portable gate вместе с самими starters в FX-06.

### FX-05 — Доказать невмешательство в исходный проект

Задачи:

- не менять imports, HTML, CSS, runtime, build или storage восьми текущих
  инструментов;
- проверить, что ни один файл текущих инструментов не импортирует, не загружает,
  не копирует и не резолвит `upgrade/extracted/ui-garage/`;
- проверить, что внутри `ui-garage/` нет imports, symlinks, asset paths, build
  aliases или runtime requests к файлам исходного проекта;
- зафиксировать scoped diff/hash для файлов текущих инструментов и подтвердить,
  что extraction их не изменил;
- выполнить baseline-проверки текущего проекта только как доказательство
  невмешательства, а не как consumer gate UI Garage;
- повторить portable check после копирования UI Garage в другой каталог;
- проверить сценарий, в котором isolated folder временно отсутствует на своём
  исходном пути.

Acceptance:

- скан зависимостей в обе стороны даёт ноль связей;
- файлы восьми инструментов не имеют extraction-related изменений;
- текущие инструменты проходят свой baseline независимо от UI Garage;
- перенос или отсутствие isolated folder не меняет behavior/build текущих
  инструментов;
- UI Garage проходит portable gate после копирования без исходного проекта.

Rollback:

- isolated folder можно удалить или перенести обратно;
- rollback приложений и миграция user data не требуются, потому что связи с
  ними не создаются.

### FX-06 — Создать полные SVG и Canvas starters

Оба starter должны быть маленькими приложениями, но демонстрировать весь общий
lifecycle, а не старый минимальный demo.

`svg-full` является самостоятельным generic use case и показывает:

- declarative settings and render;
- panels and collapse-all;
- controls and colors;
- history/presets/share;
- JSON round-trip with validation/rollback;
- SVG/PNG/PDF export;
- file intake;
- dialog/status/error;
- desktop layout and optional mobile mode.

`canvas-full` показывает:

- deterministic Canvas render;
- DPR/zoom/pan;
- pixel-safe export;
- asset intake;
- history/presets/share;
- PNG plus optional vector export hook;
- полный keyboard/focus lifecycle.

Acceptance:

- starters используют только documented public API;
- внешний вид совпадает с Component Lab;
- `START_HERE.md` позволяет другому агенту создать tool, не читая исходники
  восьми приложений;
- старый `framework/demo` обновлён или удалён, чтобы не существовало двух
  конфликтующих шаблонов.

### FX-07 — Clean-room tool proof в изолированном репозитории

Это главный тест пользовательского сценария.

Процедура:

1. создать чистый временный repository/fixture;
2. скопировать только release-папку `ui-garage/`;
3. дать агенту краткую предметную задачу на новый генератор и указать
   `ui-garage/START_HERE.md`;
4. не давать агенту доступ к восьми существующим apps;
5. собрать новый tool;
6. провести полную acceptance-проверку.

Новый test tool обязан доказать:

- узнаваемый канонический внешний вид без копирования app CSS;
- history/undo/redo;
- presets and persistence;
- share URL;
- primary export и минимум один secondary format;
- JSON round-trip, если settings document существует;
- panels/collapse-all;
- canonical shortcuts;
- dialog/error/file-intake lifecycle;
- clean reload/re-init/double export;
- отсутствие внешних runtime requests;
- отсутствие импортов из исходного monorepo.

Если создание нового tool требует посмотреть исходники существующих
инструментов или скопировать из них controller/CSS, extraction считается
неудачным и возвращается в FX-03, FX-04 или FX-06.

### FX-08 — Release и передача

Задачи:

- зафиксировать версию `1.0.0` только после successful clean-room tool proof;
- создать release notes и migration guide;
- сохранить archive/hash переносимой папки;
- описать процесс обновления копии в другом repository;
- включить автономный extraction gate в сам release UI Garage;
- задокументировать явное отсутствие зависимости исходного проекта от release;
- провести финальный smoke isolated clean-room tool.

Acceptance:

- один канонический release artifact;
- reproducible hashes;
- скопированный artifact и clean fixture имеют одинаковые version/hash;
- все portable tests, browser acceptance, visual and output invariants green;
- владелец может выполнить сценарий «скопировал папку → описал generator →
  получил новый совместимый tool» без дополнительных архитектурных решений.

## 12. Новый extraction gate

Итоговая команда может называться `gate:framework-extraction`. Она должна
включать:

1. UI/component ownership checks;
2. shortcut matrix and keyboard walkthrough;
3. public API snapshot;
4. lifecycle/re-init/leak tests;
5. portable path/assets/license/identity verification;
6. isolated SVG/Canvas starter smoke;
7. isolated network/404 scan;
8. SVG/PNG/PDF/JSON artifact smoke;
9. clean-room tool acceptance.

Baseline текущего проекта запускается отдельно только в FX-05 для доказательства
невмешательства. Он не входит в переносимый release gate и не делает восемь
текущих инструментов consumers UI Garage.

Gate не должен автоматически перезаписывать visual baselines, release hashes
или generated public runtime без явной команды и review.

## 13. Storage и обновления

- Каждый tool получает обязательный уникальный `id` и versioned namespace.
- Framework не использует `upgrade:framework:*` как production fallback.
- UI Garage не читает и не изменяет storage namespaces существующих apps.
- Миграция данных выполняется атомарно и не удаляет исходные данные.
- Framework update не запускает storage migration без app-owned migration hook.
- Новая версия должна уметь откатиться на предыдущую без порчи сохранённых
  presets/documents.

## 14. Release и versioning policy

- `MAJOR`: breaking public API, DOM/CSS contract, storage format или lifecycle;
- `MINOR`: backward-compatible capability/component;
- `PATCH`: исправление без изменения documented behavior;
- каждый release содержит manifest и hashes;
- каждый новый внешний проект фиксирует version/hash скопированной UI Garage;
- текущие восемь инструментов не закрепляют и не используют этот release;
- перенос в другой repo — копирование versioned release, а не произвольного
  рабочего каталога;
- обновление копии всегда сопровождается CHANGELOG и migration check.

## 15. Риски и обязательные защиты

| Риск | Защита |
|---|---|
| Две расходящиеся копии framework | version/hash manifest и явная update procedure |
| Новый tool копирует старый app CSS | Component Lab + no-duplicate selector check |
| Framework начинает знать apps | source graph/name boundary test |
| Исходный проект начинает зависеть от extracted folder | bidirectional dependency scan + move/absence test |
| Extraction незаметно меняет существующие apps | scoped diff/hash + независимый baseline текущего проекта |
| Скрытые двойные listeners | init/destroy/re-init instrumentation |
| Потеря user data | namespace isolation + atomic migration/rollback |
| Отсутствующий font/vendor | manifest hashes + isolated 404/network scan |
| Demo расходится с production | starters входят в extraction gate |
| Уникальная app feature ошибочно объявлена generic | ownership matrix + clean-room tool proof |

## 16. Execution status

Обновлять только при фактическом выполнении.

| Phase | Status | Evidence |
|---|---|---|
| Preconditions | Complete | UPG-076—UPG-101; Gate G13 green |
| FX-00 Baseline | Complete | clean `5700146f`; полный `npm run gate:g13:static` green |
| FX-01 Clean-slate boundary | Complete | нет app-name/URL branching, project-specific metadata, старого branding или запрещённых font assets/references внутри `ui-garage` |
| FX-02 UI/shortcut convergence | Complete | Component Lab owns 16 states and 10 families; 16 computed-style comparisons and two keyboard walkthroughs pass in the copied release |
| FX-03 Lifecycle/public API | Complete | `0.1.0-dev.2`; exact API/ownership snapshots; init/destroy/re-init, failed-init, duplicate/aborted export, aborted import and Blob URL cleanup tests green |
| FX-04 Portable folder | Complete | `0.1.0-dev.3`; 96-file manifest; 43 source modules; 88/88 tests; copied browser smoke and generated SVG/Canvas scaffolds green |
| FX-05 Source-project non-interference | Complete | `UI_GARAGE_NONINTERFERENCE.json`; zero bidirectional links/symlinks/app diffs; all eight independent app suites pass while the isolated folder is absent |
| FX-06 Starters | Complete | `0.1.0-dev.5`; full public-only SVG and Canvas starters; deterministic vector/raster models, DPR/zoom/pan, lifecycle, persistence, asset/JSON intake, responsive UI and artifact exports green in tests/browser |
| FX-07 Clean-room tool proof | Complete | new Ribbon Field generator; public-only imports; history, presets, IndexedDB drafts, share, shortcuts, dialog/file intake, exports and destroy/re-init browser acceptance green |
| FX-08 Release | Complete | UI Garage `1.0.0`; 150-file manifest; reproducible 768090-byte archive; SHA-256 and migration/release docs; unpacked artifact gate and browser acceptance green |

## 17. Definition of Done

Все пункты обязательны:

- [x] исходный baseline G13 зафиксирован как историческая точка до extraction;
- [x] isolated source очищен от app-specific knowledge, прежнего branding и
      запрещённых font assets/references;
- [x] public API versioned; starters и новые tools не используют internal imports;
- [x] framework полностью очищается и повторно инициализируется;
- [x] переносимая папка автономна;
- [x] fonts/vendor/licenses входят в portable candidate;
- [x] SVG и Canvas starters актуальны;
- [x] Component Lab задаёт единый visual/keyboard/accessibility contract;
- [x] зависимостей между исходным проектом и isolated folder нет в обе стороны;
- [x] восемь текущих apps не изменены extraction и работают независимо от неё;
- [x] isolated clean-room tool создан только по документации copied framework;
- [x] новый tool имеет history, persistence, presets, share, export, dialogs,
      file intake, panels, shortcuts и clean recovery;
- [x] source repo и isolated repo не имеют runtime-связей;
- [x] release version, hashes, changelog и rollback documented;
- [x] финальный browser result подготовлен для приёмки владельцем.
