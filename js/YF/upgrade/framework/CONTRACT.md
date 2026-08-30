# Shared framework contract

Статус: рабочий контракт Gate G2. Публичная точка входа — `framework/src/index.js`.

## 1. Dependency rule

Приложение импортирует только публичный barrel или документированный adapter. Framework не импортирует файлы приложений и не ветвится по имени инструмента. Частные возможности задаются config, callbacks, lifecycle hooks или отдельным adapter в папке приложения.

## 2. Public API

Публичны:

- `defineTool`, `ApplicationShell`;
- `Settings`, `DOMCache`, `ShortcutRouter`;
- `RenderTarget`, `SvgTarget`, `CanvasTarget`;
- sliders/ranges, panels, color picker, dice, dialogs, tooltips, zoom/pan;
- `HistoryManager`, `HistoryBridge`;
- `PresetStore`, `PresetSession`, `ShareCodec`;
- `SVGExporter`, `svgDocumentString`, `TextToPath`, `ExportGuard`;
- opt-in `MobileBootstrap`;
- generic effects, color/math/noise/stripe utilities и timings.
- `SeededRandom` для воспроизводимых генеративных потоков.

Импорт из внутренних путей считается временным compatibility exception и должен быть записан в migration-карточке приложения.

## 3. Tool configuration

Минимальный config:

```js
defineTool({
    renderer: 'svg',
    dom: { canvas: 'canvasContainer', surface: 'mainSvg' },
    settings: { width: 500, height: 500 },
    render(context) {}
});
```

Optional capabilities включаются наличием соответствующей секции: `controls`, `panels`, `colorPickers`, `dice`, `presets`, `share`, `export`, `history`, `shortcuts`, `dialog`, `tooltips`, `zoom`. Отключение оформляется `false`, если это поддерживает секция. `zoom.interactive: false` оставляет fit/centering, но не устанавливает wheel/keyboard/pointer listeners.

`mobile` — строго opt-in. `MobileBootstrap` владеет media-query, root class, viewport CSS variables и снятием listeners; перестройка интерфейса остаётся в `mobile.onChange(app, active)` и app CSS. В текущем наборе capability предназначена только Sparky.

`presets.suggestSaveName(app)` может предложить имя для сохранения временного/полученного по ссылке пресета; окончательное решение остаётся за пользователем. `presets.fetchTimeoutMs` ограничивает ожидание локальной seed-библиотеки и по умолчанию равно 5000 ms.

`presets.migrate(store)` выполняется перед seed и предназначен только для изменения данных уже переданного app-specific store. Он не даёт разрешения читать legacy namespaces. `presets.forceSeed: true` повторно сверяет локальную seed-библиотеку, не перезаписывая пользовательские пресеты с совпадающими именами.

Framework не предполагает конкретную DOM-разметку сверх переданных IDs и documented component classes. Существующие IDs/classes приложения сохраняются до визуального Gate G5.

## 4. Lifecycle

`ApplicationShell.init()` выполняет настройку state, DOM, renderer, controls, UI services, history/presets/share/export, shortcuts, затем вызывает `onInit`, первый render, zoom bootstrap, preset/share bootstrap и `onReady`.

Hooks:

- `onInit(app)` — DOM и framework services уже созданы;
- `onReady(app)` — первый render и bootstrap завершены;
- `syncControls(app)` — app-specific синхронизация UI;
- `onChromeRefresh(app)` — app-specific preset/action chrome;
- `snapshot/restore` — состояние history;
- `collectPreset/applyPreset` — persisted blob;
- `renderSVG/renderTo` — альтернативный export renderer.

Hook не должен писать в другое приложение или в путь вне `upgrade`.

## 5. Render context

`render(ctx)` получает `app`, settings proxy/store, target, DOM proxy, logical `width/height` и backend-specific `svg/create` либо `ctx2d`. Domain geometry и алгоритмы принадлежат приложению. Framework владеет очисткой surface, coalescing, zoom/pan и общей export-обвязкой.

Render должен быть детерминированным при одинаковом состоянии и seed. Случайность передаётся явно через setting/configurable RNG.

`SeededRandom` принимает числовой или строковый seed, имеет сериализуемый state и независимые `fork(label)` streams. Он не заменяет существующий алгоритм приложения во время parity-миграции: adapter должен сохранить прежнюю последовательность, если она влияет на результат.

SVG-узлы с `data-export-exclude="true"` удаляются из файла. `data-fit-artboard="true"` на корневом SVG заставляет zoom/fit использовать логические размеры артборда, даже если guides выступают наружу. `SliderController.setDisplayValue()` меняет только отображение, не state. `PanelManager.toggleAllCollapsed()` восстанавливает именно набор ранее раскрытых панелей.

## 6. Storage

Каждое приложение обязано передать уникальный versioned key вида `upgrade:<tool>:<purpose>:vN`. IndexedDB использует `upgrade-<tool>-vN`. Автоматическое чтение старых namespaces запрещено.

Framework fallback — `upgrade:framework:presets:v1`; он предназначен только для demo/tests и не заменяет app-specific key. Seed marker образуется как `<storageKey>__seeded`.

## 7. Vendor and fonts

Runtime assets загружаются только same-origin:

- `SVGExporter` вычисляет local jsPDF/svg2pdf URLs через `import.meta.url`, принимает `pdfLibPaths` override, не дублирует параллельные загрузки и поддерживает outline либо editable-text PDF с явно переданными fonts;
- `svgDocumentString` добавляет XML declaration и заменяет non-ASCII символы numeric entities для переносимого SVG-файла;
- `TextToPath` сначала загружает local ESM OpenType, затем использует local classic fallback; доступны `opentypeModuleUrl`/`opentypeUrl`/`fontPaths` overrides;
- CSS использует `framework/fonts`.

`ExportGuard` оборачивает framework SVG/PNG export: `export.prepare` может лениво заполнить отсутствующие caches, но если preparation или export изменили captured state, guard восстанавливает точный pre-export snapshot. Для внешних caches приложение задаёт `export.captureState`/`restoreState`; обычный settings/history snapshot используется по умолчанию. Export renderer всё равно обязан быть детерминированным и не вызывать новый random roll.

Для неизменённого bundled preset (`seeded: true`) framework копирует короткий `?preset=<slug>` URL. Изменённый, пользовательский, New или Shared preset получает полный `#p=v1…` payload. `share.shortSlug(name, blob, app)` позволяет задать стабильный slug; `share.shortSeeded: false` отключает short URL.

Единственное внешнее runtime-исключение всей среды — user-initiated Google Sheets в Sticky Fingers; framework его не реализует.

## 8. CSS

`framework/css/othersite-styles.css` подключается до app CSS. Tokens можно переопределять только последующим stylesheet. Mobile behavior opt-in и требуется только Sparky. Изменение framework CSS требует desktop checks всех приложений и обеих mobile ширин Sparky.

## 9. Compatibility and versioning

До Gate G4 совместимость проверяется приложениями, а не обещанием semver. Breaking change public export, config semantics, DOM/CSS contract, storage format или lifecycle требует:

1. отдельного migration note;
2. framework conformance;
3. Wordplayer, Keyboarder и Sparky tests;
4. browser/visual Gate соответствующих приложений.

Void, Grid v2, Sparky fork, Keyboarder fork и Wander Pattern являются donors, а не зависимостями. Их улучшения переносятся по одному после доказательства универсальности.
