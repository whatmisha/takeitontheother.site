# План выделения переносимого Lunnen Framework

Статус: **Deferred — не начинать до выполнения Preconditions**
Дата фиксации: 2026-09-05
Область текущего source of truth: `js/YF/upgrade/**`

## 1. Как пользоваться этим документом в новом чате

Этот файл должен быть достаточен для продолжения работы без истории текущего
чата.

В начале нового чата:

1. прочитать этот документ целиком;
2. прочитать `MIGRATION_STATUS.md`, актуальный release-hardening plan и
   `framework/CONTRACT.md`;
3. проверить `git status` и не затирать чужие незакоммиченные изменения;
4. выполнить все проверки из раздела Preconditions;
5. начинать с первой незавершённой фазы;
6. после каждой принятой фазы обновлять раздел `Execution status` этого файла
   и прикладывать команды, результаты и ссылки на evidence;
7. не объединять две фазы в одно изменение, если у них разные rollback
   conditions.

Этот план не разрешает начинать extraction поверх красного gate или
незавершённой унификации восьми инструментов.

## 2. Зафиксированное намерение владельца проекта

Нужен автономный framework, который можно использовать так:

1. скопировать одну папку framework в другой репозиторий;
2. описать задачу на новый генератор графики;
3. получить инструмент с тем же визуальным языком и полным общим набором
   возможностей: controls, panels, shortcuts, history, presets, persistence,
   import/export, dialogs, file intake, zoom, mobile support и локальные assets;
4. не переносить в новый репозиторий существующие восемь инструментов;
5. оставить существующие восемь инструментов рабочими consumers того же
   versioned framework contract.

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
2. восемь текущих инструментов, использующих только её публичный контракт;
3. два актуальных starter-приложения — SVG и Canvas;
4. один созданный с нуля девятый инструмент в отдельном чистом fixture/repo,
   сделанный из скопированной папки без доступа к исходникам восьми apps;
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

## 6. Preconditions — обязательная точка ожидания

Extraction нельзя начинать, пока не выполнено всё перечисленное:

- [ ] завершены UPG-076, UPG-077, UPG-078 и UPG-079;
- [ ] актуальный Gate G7 проходит из чистой рабочей копии;
- [ ] все восемь live entrypoints приняты без browser errors и 404;
- [ ] Pizza public runtime соответствует source fingerprint;
- [ ] завершена унификация одинаковых по функции компонентов;
- [ ] закрыты либо преобразованы в публичные named variants все записи
      `Оставшиеся узкие app deltas`;
- [ ] утверждён и реализован общий shortcut contract;
- [ ] desktop visual baselines всех восьми инструментов актуальны;
- [ ] Sparky 390×844 и 430×932 baselines актуальны;
- [ ] Dither raster/output invariants зелёные;
- [ ] нет незадокументированных внутренних imports framework;
- [ ] текущие изменения сохранены в понятной commit history или явно приняты
      владельцем как extraction baseline.

Если хотя бы один пункт не выполнен, следующий чат должен только сообщить
актуальные blockers. Начинать package/API relocation нельзя.

## 7. Целевой формат переносимой папки

Рабочее имя артефакта: `lunnen-framework/`.

```text
lunnen-framework/
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
| `⌘/Ctrl+0` | Fit artboard |
| `⌘/Ctrl+1` | Actual size / 100% |
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
- отдельный `FRAMEWORK_EXTRACTION_BASELINE.json` содержит source commit и
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
- сопоставить каждый public export хотя бы с одним реальным consumer/test.

Особое внимание:

- Pizza: document/history transactions, JSON schema, draft recovery,
  SVG/PDF, fragments and reproducible public runtime;
- Sparky: declarative shell, export progress/cancel, mobile, animation lifecycle,
  preset migration and full state extraction;
- Canvas: Wordplayer and Dither output/pixel invariants;
- specialized adapters: Sticky, Keyboarder, Pulsar, Wander.

Acceptance:

- нет capability без owner;
- нет public module без consumer, fixture или обоснованного optional status;
- список domain-private функций явно не обещается framework API.

### FX-02 — Завершить UI и shortcut convergence

Задачи:

- удалить оставшиеся визуальные различия одинаковых компонентов;
- преобразовать настоящие варианты в named framework modifiers;
- подключить общий shortcut contract ко всем применимым tools;
- добавить общий collapse-all adapter для private panel implementations;
- исключить двойную обработку ActionDock и app listeners;
- синхронизировать shortcut help/copy во всех apps;
- расширить Component Lab и visual tests.

Acceptance:

- computed component styles совпадают между apps для одинаковых states;
- `⌘/Ctrl+\` работает во всех tools с collapsible panels;
- keyboard walkthrough проходит полностью мышью не пользуясь;
- Dither pixels, Pizza document round-trip, Sticky edit mode, Wander modes,
  Pulsar SVG, Keyboarder model и Wordplayer workers не изменились;
- Sparky проходит desktop и оба mobile viewports.

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
- удалить direct imports внутренних auto-init файлов из apps;
- заменить их public API или декларативной частью `defineTool`;
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
- перенести только runtime, public docs, starters, recipes, tests and licenses;
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
- starters не используют internal modules;
- storage namespace в starters уникален;
- все third-party licenses присутствуют;
- ни одно из имён восьми apps не влияет на runtime behavior.

Acceptance:

- папка копируется во временный чистый каталог;
- framework tests проходят там без исходного monorepo;
- оба starters открываются через static HTTP server без 404/errors;
- SVG, PNG, PDF и JSON artifact smoke проходят в изоляции.

### FX-05 — Переключить восемь текущих apps на release contract

Задачи:

- apps продолжают жить в текущем проекте;
- каждый app импортирует только stable public API/CSS;
- private adapters остаются рядом с app и не попадают во framework;
- все relative paths соответствуют portable layout;
- current project фиксирует framework version/hash;
- обновление framework становится отдельной явной операцией, а не случайным
  копированием файлов;
- Pizza release build externalizes только публичный framework entrypoint.

Acceptance:

- 8/8 apps используют один и тот же version/hash;
- direct `framework/src/ui/*` imports отсутствуют;
- локальные копии framework logic отсутствуют;
- Gate G7 и новый extraction gate проходят;
- current runtime/output/storage baselines сохранены.

Rollback:

- предыдущая versioned папка framework остаётся доступной;
- каждый consumer может быть временно возвращён на предыдущую версию без
  изменения user data.

### FX-06 — Создать полные SVG и Canvas starters

Оба starter должны быть маленькими приложениями, но демонстрировать весь общий
lifecycle, а не старый минимальный demo.

`svg-full` использует Pizza/Sparky как reference evidence и показывает:

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

### FX-07 — Ninth-tool proof в изолированном репозитории

Это главный тест пользовательского сценария.

Процедура:

1. создать чистый временный repository/fixture;
2. скопировать только release-папку `lunnen-framework/`;
3. дать агенту краткую предметную задачу на новый генератор и указать
   `lunnen-framework/START_HERE.md`;
4. не давать агенту доступ к восьми существующим apps;
5. собрать новый tool;
6. провести полную acceptance-проверку.

Девятый tool обязан доказать:

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

Если создание нового tool требует посмотреть код Pizza/Sparky или скопировать
из них controller/CSS, extraction считается неудачным и возвращается в FX-03,
FX-04 или FX-06.

### FX-08 — Release и передача

Задачи:

- зафиксировать версию `1.0.0` только после successful ninth-tool proof;
- создать release notes и migration guide;
- сохранить archive/hash переносимой папки;
- описать процесс обновления копии в другом repository;
- задокументировать совместимость framework version ↔ current eight apps;
- добавить extraction gate в основной regression workflow;
- провести финальный live smoke всех восьми apps и isolated ninth tool.

Acceptance:

- один канонический release artifact;
- reproducible hashes;
- current project и clean fixture используют одинаковую версию;
- все tests, browser acceptance, visual and output invariants green;
- владелец может выполнить сценарий «скопировал папку → описал generator →
  получил новый совместимый tool» без дополнительных архитектурных решений.

## 12. Новый extraction gate

Итоговая команда может называться `gate:framework-extraction`. Она должна
включать:

1. полный Gate G7;
2. UI/component ownership checks;
3. shortcut matrix and keyboard walkthrough;
4. public API snapshot;
5. lifecycle/re-init/leak tests;
6. portable path/assets/license verification;
7. isolated SVG/Canvas starter smoke;
8. all eight consumer suites;
9. Pizza source/public reproducibility;
10. Sparky desktop/mobile acceptance;
11. Dither pixel hashes;
12. ninth-tool isolated acceptance.

Gate не должен автоматически перезаписывать visual baselines, release hashes
или generated public runtime без явной команды и review.

## 13. Storage и обновления

- Каждый tool получает обязательный уникальный `id` и versioned namespace.
- Framework не использует `upgrade:framework:*` как production fallback.
- Existing namespaces восьми apps сохраняются через explicit config.
- Миграция данных выполняется атомарно и не удаляет исходные данные.
- Framework update не запускает storage migration без app-owned migration hook.
- Новая версия должна уметь откатиться на предыдущую без порчи сохранённых
  presets/documents.

## 14. Release и versioning policy

- `MAJOR`: breaking public API, DOM/CSS contract, storage format или lifecycle;
- `MINOR`: backward-compatible capability/component;
- `PATCH`: исправление без изменения documented behavior;
- каждый release содержит manifest и hashes;
- current eight apps закрепляют точную версию;
- перенос в другой repo — копирование versioned release, а не произвольного
  рабочего каталога;
- обновление копии всегда сопровождается CHANGELOG и migration check.

## 15. Риски и обязательные защиты

| Риск | Защита |
|---|---|
| Две расходящиеся копии framework | version/hash manifest и явная update procedure |
| Новый tool копирует старый app CSS | Component Lab + no-duplicate selector check |
| Framework начинает знать apps | source graph/name boundary test |
| Скрытые двойные listeners | init/destroy/re-init instrumentation |
| Поломка Pizza при API cleanup | Pizza reproducible build + full document/export tests |
| Поломка mobile | Sparky two-viewport sentinel |
| Canvas drift | Dither/Wordplayer pixel and artifact checks |
| Потеря user data | namespace isolation + atomic migration/rollback |
| Отсутствующий font/vendor | manifest hashes + isolated 404/network scan |
| Demo расходится с production | starters входят в extraction gate |
| Уникальная app feature ошибочно объявлена generic | ownership matrix + ninth-tool proof |

## 16. Execution status

Обновлять только при фактическом выполнении.

| Phase | Status | Evidence |
|---|---|---|
| Preconditions | Blocked by unfinished G7/final unification | Не начинать extraction |
| FX-00 Baseline | Not started | — |
| FX-01 Capability audit | Not started | — |
| FX-02 UI/shortcut convergence | Not started | — |
| FX-03 Lifecycle/public API | Not started | — |
| FX-04 Portable folder | Not started | — |
| FX-05 Eight consumers | Not started | — |
| FX-06 Starters | Not started | — |
| FX-07 Ninth-tool proof | Not started | — |
| FX-08 Release | Not started | — |

## 17. Definition of Done

Все пункты обязательны:

- [ ] Gate G7 green;
- [ ] одинаковые компоненты восьми apps визуально и поведенчески совпадают;
- [ ] canonical shortcuts совпадают;
- [ ] public API versioned и не содержит внутренних imports у consumers;
- [ ] framework полностью очищается и повторно инициализируется;
- [ ] переносимая папка автономна;
- [ ] fonts/vendor/licenses входят в release;
- [ ] SVG и Canvas starters актуальны;
- [ ] восемь текущих apps используют тот же release contract;
- [ ] Pizza Boxer проходит как главный desktop/complexity sentinel;
- [ ] Sparky проходит как declarative/mobile sentinel;
- [ ] isolated ninth tool создан только по документации copied framework;
- [ ] новый tool имеет history, persistence, presets, share, export, dialogs,
      file intake, panels, shortcuts и clean recovery;
- [ ] source repo и isolated repo не имеют runtime-связей;
- [ ] release version, hashes, changelog и rollback documented;
- [ ] владелец проекта принял финальный browser result.
