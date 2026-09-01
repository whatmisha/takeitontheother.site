# Preset Toolbar Compatibility Matrix

Дата аудита: 2026-08-31.

## 1. Цель и жёсткие границы

Этот документ фиксирует preset toolbar contract перед UPG-055. На этапе
UPG-055a рабочие HTML, CSS и JavaScript восьми инструментов не меняются.
Сначала унифицируется только presentation shell, а хранение, схемы данных,
применение пресета и связанные domain side effects остаются у приложения.

Обязательные границы:

- изменяется только автономная среда `upgrade`;
- исходные проекты Lunnen, общий YF index, `othersite-ui-framework` и Void не
  являются runtime-зависимостями и не меняются;
- shared framework не получает знание о полях конкретного preset JSON;
- существующие storage namespaces, manifest format, импорт, dirty state,
  per-preset history и draft recovery нельзя незаметно объединять;
- переключение пресета не должно менять SVG/Canvas иначе, чем это делал тот же
  пресет до presentation migration;
- Sparky проверяется на desktop, 390x844 и 430x932; его mobile preset/share
  flow является частью обязательной приёмки;
- Google Sheets flow Sticky Fingers не относится к presets и сохраняется;
- Pizza после source-изменений собирается штатной командой и снова содержит
  ровно 15 проверяемых public assets;
- Dither и Wander Bender не получают фиктивные preset toolbar или data layer.

Не входят в UPG-055: Dither `Lunnen Blue` color button, Pizza row presets и
text insertion presets, Sticky data-row helpers, randomize buttons, mode
navigation и export-format choices. Совпадение слова `preset` в имени не делает
их частью верхнего preset toolbar.

## 2. Инвентаризация восьми инструментов

| Инструмент | Верхний toolbar | Поставляемые данные | Persistence / share | Data owner |
|---|---|---|---|---|
| Sparky | shared dropdown + share + скрытая Save action | 5 manifest entries / 5 JSON | `upgrade:sparky:presets:v1`, CRUD, dirty, history, short/full share | `ApplicationShell`, app snapshot/apply hooks |
| Pizza Boxer | private dropdown | 21 manifest rows: 19 selectable / 19 JSON + 2 dividers | imported presets in memory, dirty flag, per-preset history, IndexedDB draft; no shared toolbar CRUD/share | `PresetManager`, repository, schema 1.2 and document adapters |
| Sticky Fingers | private dropdown | 3 manifest entries / 3 JSON | no preset CRUD/share storage; manifest fetched on startup | `script.js`, SVG import normalization and label settings |
| Keyboarder | shared dropdown + share + скрытая Save action | 10 manifest entries / 10 JSON | `upgrade:keyboarder:presets:v1`, CRUD, dirty, history, short/full share | `ApplicationShell`, normalized model hooks |
| Wordplayer | shared dropdown + share + скрытая Save action | 1 manifest entry / 3 JSON files | `upgrade:wordplayer:presets:v1`, CRUD, dirty, history, short/full share | `ApplicationShell`, mode-aware snapshot/restore |
| Pulsar Coder | private fixed dropdown | 4 inline objects | нет storage/import/share/CRUD | `pulsar-main.js` and settings store |
| Dither | нет | нет | нет | — |
| Wander Bender | нет | нет | нет | — |

У Wordplayer `field-pull.json` и `soft-form.json` присутствуют в каталоге, но не
включены в текущий manifest. UPG-055 не должен молча сделать их видимыми.

## 3. Четыре реальные системы пресетов

### 3.1. Family A — shared CRUD/share: Sparky, Keyboarder, Wordplayer

Все три приложения уже используют один `ApplicationShell`, `PresetStore`,
`PresetSession` и `ShareCodec`. Их DOM совпадает:

- `.preset-toolbar-cluster`;
- `#presetDropdown`, `#presetDropdownToggle`, `#presetDropdownMenu`;
- `type="button"`, `aria-haspopup="listbox"`, `aria-expanded`,
  `aria-controls` и `role="listbox"`;
- `#presetToolbarShareBtn`;
- скрытый `#savePresetBtn`, который framework показывает для dirty/shared
  состояния.

Общий behavior включает `+ New`, `Unsaved*`, create/update/rename/delete,
restore defaults, delete all, dirty guard, отдельную history каждого пресета,
короткий URL для чистого seeded preset и полный payload для изменённого.

Private hooks:

- Sparky: default `Basic`, forced reseed, migration устаревших seeded names,
  pinned `+` names, две color dots, strip/quantize share data и mobile share;
- Keyboarder: default `Work 2.0 L`, suggested save name, четыре color/model
  normalization hooks;
- Wordplayer: mode-aware Canvas snapshot, две color dots, отсутствие random
  marker и отдельные Dither/Forms workers.

Их локальный CSS содержит только layout extension: cluster использует
`display:flex`, vertical centering и `var(--spacing-md)` gap. Component base,
строки, actions, color dots и states принадлежат framework.

Вывод: production migration не нужна. UPG-055b — contract gate и browser
verification, особенно desktop/mobile Sparky и empty-storage bootstrap.

### 3.2. Family B — Pizza private repository/schema/import/draft

Pizza использует похожий DOM, но другая система данных является частью модели
редактируемого документа:

- `PresetRepository` загружает manifest и встроенные JSON, а импортированные
  presets хранит в памяти с `imported-*` id;
- `PresetFormatAdapter` валидирует единственный поддерживаемый schema 1.2 и
  преобразует JSON в document model;
- `PresetManager` хранит current name, dirty flag и координирует view;
- `PresetApplicationController` сохраняет отдельную history для каждого
  preset и делает транзакционный rollback при ошибке применения;
- `DraftRecoveryController` независимо сохраняет и предлагает восстановить
  незавершённый документ в изолированном IndexedDB.

Dropdown дополнительно поддерживает manifest divider rows, imported separator
и анимированную ширину toggle. Эти возможности нельзя заменить shared
`PresetStore`: это изменило бы schema validation, history и recovery semantics.

Вывод: в UPG-055e framework может владеть только CSS presentation. Pizza
repository, view/controller, inline imported separator и все document adapters
остаются private.

### 3.3. Family C — Sticky manifest-only loader

Sticky загружает три preset JSON через собственный async manifest flow,
сортирует названия, рассчитывает ширину toggle, применяет данные через
существующий SVG/import normalizer и выбирает первый preset при старте.
Сохранения, rename/delete, share и preset storage в этом UI нет.

Связанные, но отдельные функции — edit/prepress mode, data rows, barcode,
Google Sheets и SVG/PDF export. Их нельзя подключать к shared preset lifecycle.

Вывод: UPG-055d унифицирует только skin dropdown. Private loader и width
animation сохраняются, shared CRUD rows/share button не добавляются.

### 3.4. Family D — Pulsar inline fixed choices

Pulsar хранит четыре объекта `voyager`, `dense`, `minimal`, `accurate` прямо в
`pulsar-main.js`. Выбор записывает восемь параметров в settings store,
синхронизирует inputs и вызывает `generate()`. Нет manifest, storage, import,
dirty state, history или share.

Текущий DOM имеет `aria-haspopup` и `aria-expanded`, но toggle не задаёт
`type="button"`/`aria-controls`, а menu не задаёт `role="listbox"`. Текущий JS
закрывает menu выбором и outside click, но не Escape.

Вывод: Pulsar — самый малый presentation-only canary UPG-055c. Допустимы
семантические HTML-атрибуты с нулевым visual diff; data object и `applyPreset`
не перемещаются.

## 4. Presentation compatibility

| Свойство | Shared family A | Pizza / Sticky / Pulsar legacy | Rollout rule |
|---|---|---|---|
| Toggle height | `var(--button-height)` | то же | shared |
| Toggle font | CoFo, 1rem, 500 | system stack, 0.9rem, 600 | exact scoped bridge до отдельной typography-задачи |
| Horizontal padding | `spacing-3xl` с двух сторон | `spacing-xl` справа, `spacing-3xl` слева | exact scoped bridge |
| Gap arrow/text | 10px | 10px | shared |
| Background/shadow/radius | совпадает | совпадает | shared |
| Menu placement | 8px ниже, left 0 | совпадает | shared |
| Menu overflow | JS-clamped, default unbounded | legacy max-height 400px + scrollbar | private до viewport acceptance |
| Menu row layout | flex + trailing actions/color dots | простая text row | shared base допустим только при exact rect/text capture |
| Selected/hover | совпадающие цвета | совпадает; legacy selected weight 600 | scoped weight bridge при необходимости |
| Width animation | CSS width transition | Pizza/Sticky JS измеряют system-font width; Pulsar width auto | private controller/measurement |
| Divider/imported separator | generic CRUD footer в shared | Pizza manifest dividers + imported separator | Pizza private extension |
| Toolbar share | shared square action | отсутствует у Pizza/Sticky/Pulsar | не добавлять в presentation rollout |

Shared stylesheet остаётся единственным каноническим component owner. Для
legacy tools безопасный путь тот же, что для ranges/toggles: framework
подключён нижним cascade layer, совместимые selectors повышаются app-scoped
bridge, а точные legacy metrics остаются короткими токенами/bridges. Полный
local base удаляется только после browser parity.

Dormant preset CSS в `wander_bender/css/yf-styles.css` не становится активным
контрактом и удаляется только в UPG-058 после orphan-selector проверки.

## 5. State и behavior matrix

| Состояние | Что проверяется | Где обязательно |
|---|---|---|
| Initial closed | label, selected row, toggle/menu rects, SVG/Canvas, panel rects | все шесть dropdown tools |
| Open | `aria-expanded`, arrow rotation, menu bounds, z-index, no layout shift | все шесть |
| Choose preset | selected row/label, form states, output hash/geometry | все шесть |
| Close | item click и outside click; Escape там, где он уже поддержан | все шесть |
| Keyboard focus | существующий Tab/focus appearance и отсутствие submit side effect | все шесть |
| Empty storage | shipped seed/bootstrap and isolated namespace | family A |
| Dirty state | label `*`, Save visibility, guarded switch, undo/history restore | family A; private equivalent Pizza |
| Duplicate name | reject/replace/rename semantics | family A |
| Share | clean seeded short URL, dirty/full payload, clipboard feedback | family A |
| Restore/delete | shipped defaults and current-state transition | family A |
| Import/schema error | imported row, rollback and unchanged document | Pizza |
| Draft recovery | Restore/Discard independent of toolbar migration | Pizza |
| Edit/Sheets | preset switch leaves data/edit/Sheets lifecycle intact | Sticky |
| Mobile | open/choose/share, no clipped menu or inaccessible action | Sparky 390x844 and 430x932 |

Accessibility normalization is intentionally bounded. Adding missing
`type="button"`, `aria-controls` and listbox roles with zero visual change is
allowed. Roving focus, Arrow key navigation or a new Escape policy changes
interaction and must be implemented/tested as a separate explicit improvement,
not smuggled into CSS promotion.

## 6. Domain invariants by priority

### Sparky — highest priority

- five shipped names, `Basic` default and forced-seed migration remain exact;
- local namespace and original sentinel keys stay isolated;
- preset switch restores all 68 accepted form states and exact character SVG;
- animation mode, Edit Path, undo/redo and full share payload round-trip;
- desktop plus both mobile viewports, including mobile share action.

### Pizza Boxer — priority

- schema 1.2 validation, 19 selectable built-ins and two dividers;
- imported preset IDs/rows, failed-import rollback and current document;
- per-preset history, dirty state, draft Restore/Discard and IndexedDB name;
- 113 form states, editor/surface geometry and SVG remain exact;
- rebuild produces the checked 15-asset public runtime.

### Sticky Fingers — priority

- three manifest presets and sorted menu;
- current width animation and first-preset bootstrap;
- normal/edit panel geometry, 79 form states and SVG hashes;
- data rows, Google Sheets, barcode, prepress and SVG/PDF export unchanged.

### Keyboarder — priority

- ten shipped names, `Work 2.0 L` default and suggested Save name;
- 82 accepted form states, layout model, text/outlined SVG and editable PDF;
- isolated namespace, duplicate-name and share round-trips.

### Wordplayer — priority

- only `Default` is seeded from the current manifest;
- Dither/Forms mode, 68 accepted form states, Canvas and both workers;
- isolated namespace, dirty/share/restore behavior.

Pulsar keeps 22 input/select states and exact 40,180-character default SVG.
Dither and Wander use their already accepted outputs only as a negative check:
UPG-055 must not touch their active runtime.

## 7. Rollout UPG-055a–UPG-055f

### UPG-055a — matrix, no production diff

- record DOM/data/persistence/CSS ownership;
- record manifest and inline counts;
- select Pulsar as the smallest presentation-only canary;
- keep Gate G4 green.

### UPG-055b — machine-readable gate + direct shared verification

- add `check:presets` and pin six active dropdowns, five manifests, four inline
  Pulsar presets, three isolated namespaces and zero active Dither/Wander
  dropdowns;
- protect shared component ownership and the three family-A layout extensions;
- verify Sparky/Keyboarder/Wordplayer without production changes;
- include Sparky desktop/mobile, empty-storage, dirty, duplicate and share
  acceptance.

### UPG-055c — Pulsar presentation canary

- promote shared dropdown selectors through the existing scoped cascade layer;
- retain only measured font/padding/overflow bridges needed for exact parity;
- remove the local component base after closed/open/selected captures match;
- add missing zero-diff button/listbox attributes separately and test them;
- keep inline data and `applyPreset` private.

### UPG-055d — Sticky presentation rollout

- use shared dropdown base while retaining exact width-measurement metrics;
- verify all three presets, normal/edit, panels, SVG/PDF and Google Sheets
  boundary;
- do not add shared CRUD/share/storage.

### UPG-055e — Pizza presentation rollout

- use shared dropdown base with private divider/imported-row/scroll bridges;
- rebuild public runtime;
- verify built-in and imported preset, schema rejection/rollback, dirty/history,
  draft recovery, panels/editors, form states and SVG;
- do not replace repository, schema or document adapters.

### UPG-055f — preset component gate

- update `check:presets` to final shared/private CSS ownership;
- run every app suite, isolation, Gate G4 and browser acceptance set;
- document every remaining bridge with owner and removal condition;
- only then mark preset toolbar complete and begin UPG-056.

## 8. Rollback rules

Откатить текущий app rollout внутри `upgrade`, если происходит хотя бы одно:

- неожиданно меняются SVG/Canvas pixels, export geometry или serialized preset;
- preset switch меняет другое количество form states, чем до rollout;
- меняется storage/IndexedDB namespace или затрагивается original sentinel;
- Pizza перестаёт валидировать schema, восстанавливать history/draft или
  импортировать preset;
- Sticky теряет data rows, Sheets, edit/prepress или export behavior;
- меню обрезается viewport, перекрывается panel или меняет top-toolbar layout
  вне заранее принятого visual diff;
- Sparky desktop/mobile menu или share action становятся недоступны;
- local component base удалён раньше, чем закрытый, открытый, hover/focus и
  selected states получили browser capture до/после.

Каждый rollout должен быть одним небольшим diff. Domain refactor, новая preset
schema, новая функция и CSS promotion не объединяются в одну задачу.

## 9. Выполнение UPG-055b

Добавлен `scripts/check-preset-contracts.mjs`, включённый в `gate:g4:static`.
Он фиксирует:

- шесть активных dropdown и отсутствие active toolbar у Dither/Wander;
- 38 выбираемых manifest presets в 40 rows / 40 JSON files;
- четыре inline Pulsar presets;
- три shared CRUD/share systems, три private data systems и их CSS ownership;
- storage keys Sparky/Keyboarder/Wordplayer, Pizza schema 1.2/import/draft,
  Sticky manifest loader/Google Sheets и Wordplayer 1-entry manifest.

Family A прошла verification-only без production diff. Sparky и Keyboarder
после выбора другого preset возвращают form states, panels и SVG точно.
Wordplayer возвращает fields/panels, а центральная Canvas-область содержит 0
изменённых RGB channels. Dirty label, Save visibility, share feedback и clean
reload приняты; browser errors отсутствуют. Empty storage, duplicate names и
per-preset history дополнительно покрыты 36 framework tests. Следующий шаг —
UPG-055c Pulsar presentation-only canary.

## 10. Выполнение UPG-055c

Pulsar удалил полный local preset component base и получает dropdown skin из
shared framework. Scoped bridge сохраняет только legacy font/padding,
400 px overflow, text clipping и selected weight. Четыре inline objects и
`applyPreset` остались private. HTML получил `type="button"`, `aria-controls`
и `role="listbox"` без visual diff.

Closed/open computed-style records совпадают полностью. Initial 22 fields,
panels и SVG 40 180/hash `97155e5a…` точны; Accurate и последующий Voyager
совпадают с соответствующими pre-migration states. Одинаковый closed/open
full-page raster jitter ограничен SVG (291 RGB channels, max delta 2) и не
затрагивает dropdown. Outside click/focus проходят, browser errors — 0.
Следующий шаг — UPG-055d Sticky Fingers presentation rollout.

## 11. Выполнение UPG-055d

Sticky Fingers удалил полный local dropdown/scrollbar base и получает skin из
shared framework. Scoped bridge сохраняет manifest-loader metrics, JS width
animation и 6 px scrollbar. Loader, три JSON, sorting/application, data rows,
Google Sheets и exports остаются private; добавлен только `aria-controls`.

Closed/open captures и computed styles совпадают точно. Laptop, Monitor и
Tablet применяются; возврат к Laptop точен по fields/panels/SVG. Normal/edit
states и SVG hashes `1592eaac…`/`8850fd2f…` сохранены, включая Layout
300×878.703125. Edit screenshot имеет только 8×8 px SVG-local jitter
(108 RGB channels, max delta 8), вне toolbar. Escape и outside behavior не
изменены, browser errors — 0. Следующий шаг — UPG-055e Pizza Boxer.

## 12. Выполнение UPG-055e

Pizza Boxer удалил полный local dropdown base из `styles/toolbar.css` и
получает presentation из shared framework через scoped `revert-layer`.
Repository view сохраняет только измеренные system font/padding, 400 px
overflow, clipping/selected weight и private divider extension. Repository,
schema 1.2, 19 selectable built-ins, два dividers, imported rows, rollback,
per-preset history и IndexedDB draft `upgrade-pizza-boxer-v1` остаются private.

В source fragment добавлен только `aria-controls`. Исправлен release renderer:
source document продолжает использовать `../../framework-base.css`, а
сгенерированный root `index.html` гарантированно получает
`./framework-base.css` при любом version query. Boundary test защищает оба
пути, чтобы следующий build не мог молча отключить shared layer.

Closed/open styles и geometry совпадают полностью. `New → E-ink → New`
возвращает все 113 form states, panels и SVG точно: `4abbde0d…` →
`9d4f24e9…` → `4abbde0d…`. Escape/focus/listbox semantics проходят без
browser errors. Public runtime содержит 15 проверенных hashed assets, полный
Pizza suite проходит 167/167. Следующий шаг — UPG-055f final preset gate.

## 13. Выполнение UPG-055f

Финальное владение preset presentation:

| Family | Shared owner | Оставшийся private bridge | Условие удаления |
|---|---|---|---|
| Sparky / Keyboarder / Wordplayer | framework dropdown целиком | Только app layout extensions, перечисленные в gate | Отдельная принятая перестройка toolbar layout |
| Pulsar | framework position/paint/animation/item states | Legacy font, padding, 400 px overflow и clipping в `pulsar-styles.css` | Намеренная visual normalization с closed/open/SVG capture |
| Sticky | framework dropdown base | Loader width metrics, 400 px overflow и 6 px scrollbar в `framework-base.css` | Замена width animation при сохранении трёх presets и normal/edit parity |
| Pizza | framework dropdown base | Repository sizing/overflow bridge и divider rows | Общая repository-view спецификация с import/history/draft acceptance |
| Dither / Wander | Нет active preset toolbar | Нет | Только если появится реальная domain-функция presets |

`check:presets` защищает шесть dropdown, 38 selectable manifest presets в
40 rows/40 JSON files, четыре inline Pulsar presets, три shared CRUD и три
private data systems. Полный Gate G4 повторно подтверждает isolation,
storage/boundaries, 36 framework tests и все восемь app suites. Preset toolbar
закрыт; следующий этап — UPG-056 action/export presentation.
