# Gate G5 — план унификации после паритета

Gate G4 зафиксировал рабочее поведение всех восьми инструментов. Gate G5 может
менять внешний вид и общие взаимодействия, но не имеет права незаметно менять
генеративные алгоритмы, документы, storage, export или mobile-поведение Sparky.

Этот документ разбивает унификацию на небольшие задачи, пригодные для
последовательного выполнения более быстрыми моделями.

## 1. Неподвижные ограничения

1. Изменения разрешены только внутри `upgrade/`.
2. Один общий компонент или один инфраструктурный переход — одна задача.
3. До изменения сохраняется capture текущего Upgrade; после изменения разница
   должна быть либо нулевой, либо перечисленной как намеренная.
4. Любое изменение `framework/**` требует полного `npm run gate:g4:static` и
   desktop/mobile browser-проверки Sparky.
5. Изменение app-only CSS требует тестов этого приложения, isolation check и
   browser-проверки затронутых состояний. Перед закрытием задачи всё равно
   запускается `gate:g4:static`.
6. DOM IDs, storage keys, document schema, preset schema и export geometry не
   меняются вместе с визуальным компонентом.
7. Mobile CSS включается только для Sparky. Остальные приложения проверяются на
   отсутствие случайного ухудшения desktop, но не получают новую mobile-схему.
8. Donor-код Grid v2, Wander Pattern и Void не становится runtime-зависимостью.
9. Google Sheets остаётся единственным пользовательским внешним runtime.
10. Baseline не обновляется автоматически. Старый и новый снимки хранятся как
    отдельные доказательства с объяснением намеренного отличия.

## 2. Текущая compatibility matrix

| Инструмент | Shared CSS | Navigation | Panels/sliders | Presets | Частное, не унифицировать вместе с UI |
|---|---|---|---|---|---|
| Sparky | direct canonical | `.top-link`, shared toolbar | shared; private orchestration/mobile | shared session/toolbar | character geometry, animation, focus, export workers |
| Pizza Boxer | lower cascade layer | canonical `.top-link` | private Grid controllers | private schema/repository | document, surfaces, objects, IndexedDB, Vite runtime |
| Sticky Fingers | lower cascade layer | canonical `.top-link` | private legacy GridGenerator | private manifest UI | labels, data/barcodes, Sheets, SVG/PDF |
| Keyboarder | direct canonical | `.top-link`, shared toolbar | shared | shared session/toolbar | keyboard geometry, legends, import/export wrappers |
| Wordplayer | direct canonical | mode-specific back/navigation | shared | shared session/toolbar | Canvas/workers, Dither/Forms, PNG/SVG |
| Dither | lower cascade layer | legacy standalone link; canonical attempt deferred | shared adapter | отсутствуют | Canvas/overlay, transforms, dithering, PNG |
| Wander Bender | lower cascade layer | canonical `.top-link` | shared adapter/private zoom | отсутствуют | three modes, Paper geometry, extraction, SVG |
| Pulsar Coder | lower cascade layer | canonical `.top-link` | shared adapter/private zoom | private dropdown | codec, rays, verifier behavior, SVG |

Все восемь приложений теперь участвуют в shared JavaScript и CSS boundaries.
Pizza Boxer подключён в UPG-051a с одним Arial parity bridge, Sticky Fingers —
в UPG-051b с Arial и unbounded-panel bridges. После UPG-052a/b/d/e legacy-ссылка
остаётся только в отложенном Dither; канонический framework-компонент называется
`.top-link`.

## 3. Порядок задач

### UPG-050. Зафиксировать матрицу и правила

Результат: этот документ, ссылка из основного плана и следующий точный шаг в
`MIGRATION_STATUS.md`. Runtime не меняется.

Проверка:

```sh
npm run gate:g4:static
git diff --check
```

### UPG-051. Подключить shared CSS к Pizza Boxer и Sticky Fingers

Выполнять двумя независимыми подзадачами: сначала Pizza Boxer, затем Sticky
Fingers. Не менять одновременно разметку или внешний вид.

Для каждого приложения:

1. Записать desktop capture и DOM/геометрию основных областей.
2. Добавить маленький `framework-base.css`, который импортирует
   `framework/css/othersite-styles.css` в именованный нижний cascade layer.
3. Подключить его перед текущим app CSS/bundle.
4. Если shared defaults заполняют ранее неописанное свойство, добавить узкий
   parity bridge в app CSS с комментарием и тестом; не копировать весь framework.
5. Доказать pixel-identical normal state. Для Pizza дополнительно проверить
   preset, panel collapse, object editor и export; для Sticky — normal/edit,
   preset, Sheets и PDF.
6. Добавить boundary-test на порядок CSS и отсутствие внешних URL.

Стоп-условие: если для паритета требуется более пяти разнородных bridges,
остановить подзадачу и описать конфликт cascade до дальнейших изменений.

Результат UPG-051a — выполнено для Pizza Boxer: shared CSS подключён нижним
layer, 289 representative computed-style записей и вся основная геометрия
совпадают после одного узкого Arial bridge; collapse/restore, 167 тестов и
isolation проходят. UPG-051b выполняется отдельно для Sticky Fingers.

Результат UPG-051b — выполнено для Sticky Fingers: shared CSS подключён нижним
layer; 214 representative computed-style записей, normal/edit geometry и
visibility совпадают после Arial и unbounded-panel bridges; 4 теста и isolation
проходят. Google Sheets/PDF domain paths не менялись.

### UPG-052. Общая верхняя навигация

Цель — один framework-контракт для обратной ссылки и её accessibility, сохраняя
mode navigation Wordplayer как явное расширение.

Порядок rollout: Wander → Pulsar → Dither → Pizza → Sticky → Keyboarder →
Sparky; Wordplayer последним отдельным вариантом.

Для каждого приложения:

1. Нормализовать текст до `←Upgrade Tools`, `href="../"`, `aria-label` и
   канонический класс `.top-link`.
2. Сначала допускается временный двойной класс для точного сравнения.
3. Удалить legacy `.yf-tools-link` только после принятого намеренного visual diff.
4. Проверить keyboard focus, hover, safe area Sparky и отсутствие layout shift у
   соседних preset/zoom/mode controls.

Не добавлять JavaScript-компонент для статической ссылки: контракт здесь — HTML,
shared CSS и accessibility, а не лишняя runtime-абстракция.

Результат UPG-052a — выполнено для Wander Bender: `.top-link`, единый текст и
ARIA подключены; shared CoFo/padding приняты как намеренный visual diff. Размер
zoom, panel/SVG geometry и generated markup не изменились; 10 тестов и isolation
проходят. Legacy universal reset потребовал один временный padding promotion.

Результат UPG-052b — выполнено для Pulsar Coder: тот же `.top-link`/ARIA visual
contract принят; preset/zoom sizes, три panel rectangles, codec SVG markup и
inputs не изменились. 8 тестов и isolation проходят; padding promotion временный.

Результат UPG-052c — попытка для Dither полностью откачена и отложена. При
неизменной DOM-геометрии canvas/overlay/panels/actions каноническая ссылка
детерминированно меняла canvas-area capture (`aa118…` → `01b732…`). Возврат
исходной разметки восстановил точный `aa118…`; новый baseline не принимался.
Причина должна исследоваться отдельно после rollout безопасных приложений.

Результат UPG-052d — выполнено для Pizza Boxer: source fragment и генерируемый
production document закрепляют `.top-link`/ARIA и shared CSS; public runtime
воспроизводимо пересобран. Приняты CoFo 16/500, padding 8×20 и совместное
смещение центрированной top-группы на 6,86 px. Размеры и стили preset/zoom/rotate,
панели, SVG geometry/markup, 113 form states и collapse/restore не изменились;
167 тестов и isolation проходят. Padding promotion временный.

Результат UPG-052e — выполнено для Sticky Fingers: принят единый текст,
`.top-link`/ARIA, CoFo 16/500 и padding 8×20. Центрированная top-группа стала
шире, поэтому preset/Edit Mode совместно сдвинулись на 27,70 px без изменения
размеров или стилей. Normal/edit SVG markup, 79 form states, panels/actions и
длинная 878.703 px панель точны; manifest dropdown содержит три option, 4 теста
и isolation проходят. Sheets/PDF domain paths не менялись.

Результат UPG-052f — выполнено для Keyboarder: визуально уже каноническая
`.top-link` получила недостающий `aria-label`. Browser state, toolbar/panels,
keyboard SVG markup и 82 form states совпадают точно; все Keyboarder suites и
isolation проходят.

Результат UPG-052g — выполнено для приоритетного Sparky: существующая
`.top-link` получила только `aria-label`. Desktop toolbar/panels/actions,
character SVG markup и 68 form states совпадают точно. Изменение атрибутное,
CSS не содержит `aria-label` selectors, поэтому принятые 390×844/430×932
safe-area layouts не затронуты; 196 тестов и isolation проходят.

Результат UPG-052h — выполнено для Wordplayer как явного расширения: back action
остаётся сегментом `.mode-nav-button.mode-nav-back`, но получает общие
href/text/ARIA semantics. Dither (`eafaf5…`) и Forms (`7d3838…`) full-page
captures byte-identical; mode/panel/Canvas/action geometry и 68 form states
точны, обе worker suites и isolation проходят.

Итог UPG-052: Wander, Pulsar, Pizza, Sticky, Keyboarder и Sparky используют
каноническую `.top-link`; Wordplayer документирован как mode-navigation variant.
Dither остаётся единственным отложенным legacy-вариантом после безопасного
rollback, пока его raster coupling не будет исследован отдельно.

### UPG-053. Panel header и collapse

Подробная compatibility matrix, browser inventory, risk boundaries и порядок
подзадач находятся в `PANEL_COMPATIBILITY_MATRIX.md`.

1. Зафиксировать варианты: fixed/right/left/bottom, stack, editor, collapsed.
2. Вынести общий визуальный контракт header/icon/summary в framework CSS.
3. Legacy adapters сохраняют drag coordinates и stacking semantics приложений.
4. Pizza/Sticky controller logic не заменять одним большим рефакторингом;
   подключать shared behavior через façade по одной операции.
5. Проверить restoration всех панелей Sparky, длинные панели Wander и
   paint-neutral clicks Dither.

Результат UPG-053a — выполнено: зафиксированы 33 panel shells, четыре visual
families, ownership drag/collapse/stack и accessibility gaps. Первым canary
выбран presentation-only title promotion Wander (13.6 → 14.4 px); shared JS,
panel geometry и domain output в этой подзадаче не менялись.

Результат UPG-053b — выполнено для Wander: title переведён 13.6 → 14.4 px с
явным 16 px line-height. Промежуточный 47 px header был отклонён; итог сохраняет
46 px header, 300×605.703 panel, 46 px collapsed shell, 41 input и точный
Radial/Random/Flow SVG markup. 10 тестов и isolation проходят.

Результат UPG-053c — выполнено для Pulsar: три title переведены 13.6 → 14.4 px
с тем же 16 px line-height. Три header/anchor и default rect 300×560,
300×214.6016, 300×46 точны; Visual expand 300×404 и Main collapse 300×46
восстанавливаются без geometry drift. Codec SVG 1000×720/40 180 characters и
22 input state совпадают; 8 тестов и isolation проходят.

Результат UPG-053d — выполнено для Pizza Boxer: все семь title и inline
summaries переведены 13.6 → 14.4 px с 16 px line-height через source CSS и
воспроизводимый 15-asset runtime. Пять default shells/right stack, 46 px main
headers, Paragraph/Graphics editors с 54 px header, SVG 1280×720/exact 94 374
characters, 113 inputs и bottom actions точны. 167 тестов, public-runtime check
и isolation проходят.

Результат UPG-053e — выполнено для Sticky Fingers: семь title/summaries
переведены 13.6 → 14.4 px с 16 px line-height без изменения private controller.
Normal/edit panel geometry, 878.703 px Layout, Text Styles inner-section
restoration, два 54 px editor header, exact SVG и 79 inputs сохранены. Google
Sheets flow и local PDF implementation не изменены; 4 теста и isolation проходят.

Результат UPG-053f — выполнено без visual/runtime правок: boundary tests теперь
фиксируют shared 0.9rem/500 selector и отсутствие private fork у Sparky,
Keyboarder и Wordplayer. Browser подтверждает 47 px Sparky headers и 46 px
Keyboarder/Wordplayer headers, exact collapse/mode restoration, SVG/Canvas и
68/82/68 input states. Отсутствие CSS diff сохраняет принятый Sparky mobile
contract; 196 тестов, обе domain suites и isolation проходят.

Результат UPG-053g — выполнено: shared `PanelManager` получил idempotent
click/Enter/Space и synchronized role/tabindex/ARIA state, покрытый 35 framework
tests. Direct apps и Wander приняли behavior без geometry/domain diff. Pulsar
удалил duplicate handler; его `435f6961…` capture byte-identical, panel/SVG/
22-input state и keyboard restore точны. Pizza/Sticky private controllers и
Dither drag-only variant не менялись; целевые suites и isolation проходят.

### UPG-054. Числовые controls, range, toggle и segmented control

Подробная browser/state/ownership matrix и порядок canaries находятся в
`CONTROL_COMPATIBILITY_MATRIX.md`.

Rollout отдельными компонентами: value display → range → toggle → segmented.
Для каждого компонента:

1. Составить таблицу normal/hover/focus/disabled/active.
2. Сначала унифицировать tokens и внешний вид, не callback/lifecycle.
3. Проверить keyboard editing, Shift+Arrow и mouse transaction Pizza.
4. Сохранить auto/max disabled semantics Wander и Dither.
5. Не менять min/max/step, округление или domain settings.

Результат UPG-054a — выполнено без runtime/CSS/HTML изменений. Зафиксированы
137 text displays, 48 native number inputs и 122 single-thumb ranges; выделены
пять presentation families и восемь разных ownership/lifecycle contracts.
Shared `SliderController` непосредственно обслуживает 71 обычную pair, тогда
как Pizza history transactions, Sticky number inputs, Keyboarder suffix/editor
fields и Dither raster conversions остаются частными. Void подтверждает
выбранный visual contract, но не требуется как dependency. Первым canary выбран
Pulsar: восемь однородных shared pairs без suffix/disabled/history; менять можно
только display presentation, сохраняя exact codec SVG, 22 inputs и geometry.

Результат UPG-054b — выполнено для Pulsar. Восемь displays теперь потребляют
shared base selector; local wrapper и range rules сохранены. Намеренно удалены
legacy min-width 40 px и right padding 4 px: display rect 144.5 → 140.5 px,
right edge остаётся точным, панели/ranges/SVG не двигаются. Arrow/Shift+Arrow,
Enter, blur, Escape и live range совпадают до/после; reload возвращает exact
22 inputs и 40 180-character SVG. Восемь тестов, isolation и Gate G4 проходят.

Результат UPG-054c — выполнено для Wander. Все 19 displays используют shared
base/tabular presentation; private disabled 0.3/`not-allowed` и range skin
сохранены. Семь видимых rect получают только canonical width 144.5→140.5 px и
4 px left shift при неизменном right edge; panel 300×605.703, 41 inputs и
Radial/Random/Flow SVG точны. Auto/Max и dynamic width 30 дают те же disabled
states, stroke 25, corner/max 15 и byte-identical `b6564ee2…` SVG. Keyboard
steps, 10 tests, isolation и Gate G4 проходят.

Результат UPG-054d — Sparky уже находился на canonical contract, поэтому
завершён verification-only без HTML/runtime/CSS diff. Boundary test фиксирует
24 статических slider displays, отсутствие private `.value-display` fork и
shared normal/focus/disabled states; три readonly HSB fields остаются у shared
color picker. Desktop точен: viewport `4c57d661…`, character SVG
26 806/hash `12b209a2…`, 68 inputs, 27 displays и четыре panel rect. Keyboard
Arrow/Shift/Escape/blur и Shape collapse 300×47 с exact restoration совпадают.
Отсутствие visual/runtime source diff сохраняет принятые 390×844/430×932
mobile baselines; 196 Sparky tests проходят.

Результат UPG-054e — Wordplayer завершён verification-only. Shared contract
напрямую обслуживает 20 static displays и три readonly HSB; единственный
private selector остаётся допустимым scoped Forms extension для восьми fields
(3.2 em/11.52 px). В Dither ordinary displays сохраняют 12.8 px и 135×14.5,
в Forms compact displays — 36.859×13; Canvas 1280×720, все 68 inputs и панели
136/670/305.5/513 px восстанавливаются точно, Forms collapse остаётся 46 px.
Arrow/Shift/Escape/blur/Enter проверены в обоих вариантах. Boundary и оба
worker suites проходят; HTML/runtime/CSS приложения не менялись.

Результат UPG-054f — Keyboarder завершён verification-only с разделением
shared readonly HSB и шести private `mm` fields. HSB сохраняют canonical
12.8 px/135×14.5, mm variant — 100×26, mono 10 px, border/background, suffix и
собственный binder. Colors проходит 46→284→453 px без SVG/input diff; default
SVG 133 295/hash `f1c3d795…` и 82 inputs точны после reload. Arrow/Shift,
Escape и comma/suffix blur проверены. Трёхзнаковый display намеренно может
округлить более точное preset value при ручном commit, поэтому generic
SliderController здесь запрещён; boundary и пять domain suites проходят.

Результат UPG-054g — Pizza Boxer переведён на shared value-display
presentation без изменения app-owned поведения. Из source CSS удалены только
дубли base/focus; единственный scoped layout selector, 38 displays, private
`SliderController`/`SliderHistoryController` и девять editor fields защищены
boundary tests. Штатный release пересобрал 15 hashed assets. Единственный
browser diff — удаление legacy min-width/right padding: большинство видимых
fields 144.5→140.5 px со сдвигом x на 4 px и тем же right edge; Graphics Height
сохраняет собственную позицию adjacent-control layout. Default/Paragraph/
Graphics совпадают по 113 inputs, 29 ranges, panels, surface и SVG 94 374/hash
`4abbde0d…`. Arrow 1, Shift 10, Escape draft rollback, blur/Enter commit и
Grid 526.1016→46→526.1016 px проверены; все 167 тестов проходят.

Результат UPG-054h — Dither переведён на shared value-display base с
raster-safe scoped extension. Прямой `normal`→`tabular-nums` воспроизводимо
менял canvas `aa118d76…`→`698cacf2…`, поэтому по плановому rollback rule
сохранены private normal glyph metrics и HSB variant; unscoped base/focus при
этом удалены. Default, Bayer и Pixel Size 4 вернули исходные full-page hashes
`89276268…`, `ef32e2fa…`, `06d19922…` и точные canvas bytes. 38 inputs,
13 ranges, panels/actions/canvas geometry, HSB и modal state совпадают.
Scale percentage, Rotation degree, focus/Escape, cache invalidation и PNG path
остаются app-owned и защищены boundary test; десять тестов проходят.

Результат UPG-054i — Sticky Fingers завершён как native-number boundary. В
runtime нет text `.value-display`; 39 статических и один динамический native
number input сохраняют spinners, 32 px/private custom-column geometry и разные
NumberInputController/editor/change lifecycles. Удалены только три неактивных
local value-display selectors. Normal/edit screenshots `c021f8ed…`/
`ea806751…`, 79 form states, 40 number fields, panels, artboard и SVG
`1592eaac…`/`8850fd2f…` точны; Paragraph/Graphics DOM и SVG также совпадают.
Front Width 120.0→120.5→130.5 и live-settings Escape, Headline
7.00→7.01→7.10, clean reload и Google Sheets boundary проверены. Пять тестов
проходят. Value-display component закрыт; далее начинается отдельная range
matrix, без одновременного изменения toggle/segmented.

Результат UPG-054j — выполнено без runtime/CSS/HTML изменений. В
`RANGE_COMPATIBILITY_MATRIX.md` зафиксированы 122 single-thumb ranges: 107
ordinary и 15 HSB. 106 могут использовать shared presentation без visual diff;
три Pizza HSB сохраняют private 8 px skin/history/color lifecycle, а все 13
Dither — private 10 px raster-safe variant. Sticky имеет zero active ranges.
Определены state/behavior/cascade matrix, точные rollback criteria и порядок
UPG-054k–UPG-054q. Первым zero-diff canary выбран Pulsar Coder.

Результат UPG-054k — Pulsar Coder переведён на shared ordinary range skin.
Удалены local thumb/track/hover/focus duplicates; из-за unlayered universal
margin reset оставлен один явный 6 px top-margin bridge. Normal, hover и focus
captures побайтно совпадают до/после; все восемь range states, panels, canvas,
22 input/select states и SVG 40 180/hash `97155e5a…` точны. Live 14→15→14,
draft 999 + Escape, Arrow и Enter восстановление сохранены. Восемь tests,
isolation и полный Gate G4 проходят.

Результат UPG-054l — direct canonical family завершена verification-only без
production CSS/runtime/HTML diff. Boundary tests фиксируют 44 ordinary ranges
(Sparky 24 + Wordplayer 20), девять shared HSB и отсутствие private range skin;
единственное приложение-расширение — 100% width восьми compact Forms ranges.
Browser подтверждает 27/23/3 runtime ranges, canonical ordinary/HSB geometry,
gradients и picker docking. Sparky 5→6→5 возвращает exact 26 806-character SVG;
Wordplayer Forms 25→26→25 возвращает inputs/panels при 120×10 controls и
1280×720 Canvas; Keyboarder HSB gradients/docking и clean-reload exact
133 295-character SVG сохранены. Существующее HSB integer round-trip
`#aaaaaa`→`#ababab` при ручном редактировании зафиксировано как private color
behavior, не range regression. App suites, isolation и Gate G4 проходят.

Результат UPG-054m — Wander Bender переведён на shared ordinary range skin.
Local normal/thumb/track/hover/focus duplicate удалён; сохранены 6 px reset
bridge и все private disabled rules, поэтому `stroke`/`cornerRadius` ranges
остаются opacity 1/pointer, а displays — 0.3/`not-allowed`. Normal capture
`47dacdc3…`, все 19 ranges, 48 controls и panel 300×605.703 совпадают точно.
Radial/Random/Flow captures и SVG 1 838/12 261/26 292 characters совпадают
побайтно. Auto/Max off/on, width 30 → stroke 25/corner max 15 и clean reload
идентичны до/после. Десять tests проходят; isolation/Gate G4 остаются зелёными.

Результат UPG-054n — Pizza Boxer переведён на shared ordinary range skin с
нулевым visual/runtime diff. Удалены только local ordinary
base/thumb/track/hover/focus declarations; сохранены 6 px reset bridge, весь
private HSB block с 8 px thumb/gradients и application-owned slider/history
controllers. Reproducible build синхронизировал 15 public assets.

Cached old и новый runtime на 1280×720 побайтно совпадают в default, hover,
focus, HSB, Graphics и Paragraph states. Все 29 ranges, 113 form states,
panels/surface и SVG совпадают; Graphics 300×451 и Paragraph 300×680 сохраняют
собственные редакторы. Mouse gesture/document mouseup/focus-blur transaction
границы подтверждены dedicated tests; Pizza suite проходит 167/167.

Результат UPG-054o — HSB boundary закрыт verification-only. Девять ranges в
Sparky/Wordplayer/Keyboarder остаются shared: 244×10, 12 px thumb, dynamic
gradients, единый `ColorPicker` и переносимый `UnifiedColorPicker`. Три Pizza
ranges остаются private: 260×10, 8 px thumb, 10 px dynamic track и собственный
color/history lifecycle. Browser подтверждает HEX/output update, docking и
exact clean reload для shared SVG apps, а Pizza control restore возвращает
exact 94 380-character SVG. Новый framework contract test фиксирует gradients,
silent sync, callback и существующую integer HSB quantization. Framework 36/36
и Pizza 167/167 tests проходят.

Результат UPG-054p — исключения range family закрыты без production diff.
Dither сохраняет private raster-safe contract для всех 13 ranges: 1 px track,
10 px thumb, private formatting/cache invalidation и разделение immediate
transform от 16 ms debounced raster controls. Sticky сохраняет ноль active
ranges и 40 native number fields; его dormant legacy range CSS оставлен до
отдельного dead-CSS cleanup. Принятые UPG-054h/i browser baselines остаются
валидны; Dither 11/11 и Sticky 5/5 tests проходят.

Результат UPG-054q — range component gate закрыт. `check:ranges` теперь является
обязательной частью Gate G4 и машинно фиксирует 97 shared ordinary, девять
shared HSB, 16 private ranges и zero-range Sticky boundary. Он также запрещает
возврат private ordinary thumb/track skin в shared-compatible apps. Полный Gate
G4 проходит вместе с manifest, assets/provenance, storage/path isolation,
36 framework tests, всеми app suites и Pizza 15-asset public runtime.
`git diff --check` clean. Следующий компонент начинается с отдельной
toggle/segmented compatibility matrix без production diff.

Результат UPG-054r — выполнена отдельная инвентаризация toggle/segmented без
production diff. `TOGGLE_COMPATIBILITY_MATRIX.md` фиксирует 77 checkbox и 37
radio (114 native controls), семь presentation families и восемь private
state buttons. Подтверждены уже shared 27 `pill-toggle`; 24 `toggle-chip` и
шесть `toggle-switch` готовы к поэтапному promotion; для 20 legacy
`checkbox-label` нужен новый совместимый shared base. Из 37 radio 31 относятся
к radio/label segment, остальные защищены как pill/toolbar/private variants.
Определены state/ownership matrix, Dither raster rollback и последовательность
UPG-054s–UPG-054y. Следующий шаг — machine-readable contract gate и
verification-only direct family, прежде чем менять shared CSS.

Результат UPG-054s — `scripts/check-toggle-contracts.mjs` добавлен в
`check:toggles` и обязательный Gate G4. Gate фиксирует 77 checkbox + 37 radio,
все family totals, уже shared direct apps, текущих legacy owners и private
Keyboarder/Wordplayer/Dither variants. Boundary tests Sparky, Keyboarder и
Wordplayer теперь запрещают возвращать local pill/toggle-switch base. Browser
на 1280×720 подтверждает checked/restore: Sparky возвращает SVG к 26 806
символам, Keyboarder — к 133 295; Wordplayer возвращается Forms→Dither.
Sparky на 390×844 и 430×932 имеет canvas ровно по viewport, zero horizontal
overflow и все девять choice inputs. Console errors отсутствуют; 196 Sparky
tests и все Keyboarder/Wordplayer suites проходят. Production CSS/runtime не
изменялись. Следующий шаг — изолированный Pulsar canary.

Результат UPG-054t — shared framework получил exact-compatible 33×18
`checkbox-label` и `--segmented-control-font-size` с default 0.9rem. Полные
checkbox/segmented дубли удалены из Pulsar; frozen 13.6 px metric сохраняют
0.85rem token и узкий `revert-layer` promotion bridge. Первая проверка штатно
поймала влияние legacy unlayered reset на padding до приёмки; bridge вернул
exact geometry без копирования declarations. Финальная old/new full-page
capture побайтно совпадает (`001ddcb25457…`), как и complete state record:
checkbox 260×26, track 33×18, thumb 14/left 17, segment 260×33.602, panels,
22 input/select/textarea states и SVG 40 180 chars. Show Rays даёт
40 180→37 965→40 180, ECC 2x — 77 860→40 180; checked/focus styles точны.
CSS provenance теперь явно отделяет immutable upstream-v3 от G5 extensions.
Framework 36/36, Pulsar 8/8, toggle gate и isolation проходят. Следующий шаг —
единственный segmented control Wander; private Auto/Max не меняются.

Результат UPG-054u — единственный radio/label segment Wander Bender переведён
на shared presentation. Полный local segmented block удалён; 13.6 px frozen
metric сохраняют 0.85rem token и scoped `revert-layer` bridge поверх legacy
reset. Runtime, настройки и private Auto/Max CSS/behavior не менялись.
Full-page before/after SHA-256 побайтно совпадает (`5877e8c29e237acc…`), как
и complete computed/state record: segment 260×55.203125, panel 300×605.703125,
48 controls и disabled dependencies. Radial/Random/Flow возвращают точные SVG
длины 1 838/12 261/26 292; после round-trip Radial снова 1 838. Console errors
отсутствуют. Wander 10/10, framework 36/36 и toggle gate проходят. Следующий
шаг — поэтапный Pizza Boxer rollout с пересборкой 15 public assets.

Результат UPG-054v — Pizza Boxer перевёл 15 `toggle-chip`, семь
`checkbox-label`, четыре segmented groups и один export `toggle-switch` на
shared presentation. Полные base/state дубли удалены из трёх source CSS files;
surface tabs, Graphics flex-layout и все controllers остались private. Frozen
reset компенсируют один grouped `revert-layer` promotion, 0.85rem token и
узкие container/input bridges без копирования component declarations.

Первые after captures были отклонены: сначала segment вырос на 2 px, затем
`.show-toggle-chip-group` добавил 1 px. Более точные selectors вернули исходный
layout. Финальный default capture побайтно совпадает (`1dfbb49ac2b3aa3…`),
как и полный record 113 fields, 36 choices, component geometry/styles, пять
panel shells и SVG 94 374 chars (`4abbde0d…`). Paragraph 300×680 и Graphics
300×451 state records совпадают; private surface lock states стабильны.
Show Columns, Link Mode, x-height и Outline Fonts round-trip возвращает все
113 fields и точный SVG; keyboard focus ring остаётся 2/4 px. Public runtime
воспроизводим и содержит 15 assets. Pizza 167/167, framework 36/36 и toggle
gate проходят; полный Gate G4 остаётся зелёным. Следующий rollout — Sticky
Fingers с сохранением edit/Sheets/PDF.

Результат UPG-054w — Sticky Fingers перевёл девять `toggle-chip`, десять
`checkbox-label`, две segmented groups и три `toggle-switch` на shared
presentation. Полные local base/state blocks удалены из `style.css`; edit-mode,
preset/data rows, Google Sheets, SVG/PDF и все event handlers не менялись.
Frozen universal reset компенсируют grouped `revert-layer`, 0.85rem token и
узкие chip/container/segment bridges. Единственные частные chip-метрики —
центрирование, 12 px horizontal padding и 13.6 px text.

Первый edit capture выявил сокращение Layout panel на 8 px: shared
`.control-section > .control-group:last-child` обнулял legacy нижний интервал
последней chip group. Изменение было отклонено; scoped bridge вернул ровно
8 px без копирования component base. Финальные normal/edit records полностью
совпадают: 79 form fields, 28 choices, все component computed styles и panels,
включая Layout 300×878.703125. SVG остаётся 18 640 chars/hash `1592eaac…` в
normal и 18 607/hash `8850fd2f…` в edit; принятые full-page captures остаются
`164e7ea8…`/`29946506…`. Show objects, Prepress и edit round-trip возвращают
исходный SVG/state; switch focus ring остаётся 2 px black + 4 px white.
Browser errors: 0; известен только прежний EAN-13 checksum warning.

Sticky 5/5, framework 36/36, toggle gate и полный Gate G4 проходят. Следующий
rollout — Dither с обязательным raster rollback boundary.

Результат UPG-054x — Dither перевёл две `checkbox-label` и один трёхпозиционный
segment на shared presentation. Полные local base/state blocks удалены;
четыре native 16×16 export checkbox, все 13 private ranges, Canvas algorithms,
cache invalidation и PNG export не менялись. Raster-safe bridge сохраняет
0.85rem и исходные segment margins 1/1/2 px плюс `gap: normal`.

Первый capture был отклонён: segment потерял 2 px высоты. После измеренного
bridge полный default и Bayer component/state record совпадает, включая
38 fields, panels, Canvas/overlay geometry и choice computed styles. Для
Pixel Size 4 browser automation оставляет правую прокручиваемую панель на
отличающемся на 2 px `scrollTop`; diff полностью ограничен x≥976. Во всей
области Canvas (246 440 pixels) default/Bayer/Pixel4 имеют 0 изменённых RGB
channels. Invert и Show Effect меняют raster и после обратного click возвращают
его точно; private ×2 checkbox также возвращается. Segment focus остаётся
2 px/offset 2 px, browser errors — 0. Dither 11/11 и Gate G4 проходят.

Результат UPG-054y — `check:toggles` обновлён до финальной классификации. Gate
фиксирует 77 checkbox + 37 radio = 114 native controls, все семь presentation
families, шесть private inputs и восемь отдельных state buttons. Отдельно
защищены Keyboarder compensation buttons, Wordplayer mode navigation, четыре
Dither export checks, Sparky Edit Path, два Pizza surface lock и Wander
Auto/Max с его зафиксированным отсутствием `aria-pressed`. Все rollout bridges
имеют app-owner и точную parity-причину. Полный Gate G4 и isolation проходят;
choice family закрыта. Следующий этап — UPG-055 preset toolbar.

### UPG-055. Preset toolbar

1. Канонический shared toolbar остаётся источником Sparky/Keyboarder/Wordplayer.
2. Pulsar подключает только совместимый presentation layer; его preset data
   остаётся частным.
3. Pizza и Sticky сохраняют собственные repositories/schema и адаптируют view
   отдельно.
4. Dither/Wander не получают фиктивные presets в этой задаче.
5. Проверить duplicate names, dirty state, share, seed/migration hooks и empty
   storage namespace.

Результат UPG-055a — выполнен полный статический аудит без production diff. В
`PRESET_TOOLBAR_COMPATIBILITY_MATRIX.md` зафиксированы шесть активных верхних
dropdown, пять manifest-библиотек и четыре разные data family. Sparky,
Keyboarder и Wordplayer уже используют shared CRUD/share/session contract;
Pizza сохраняет repository, schema 1.2, импорт, per-preset history и draft
recovery; Sticky сохраняет manifest-only loader и width animation; Pulsar
сохраняет четыре inline objects. Dither/Wander не получают искусственные
presets. У Wordplayer отдельно защищено текущее состояние: один manifest entry
при трёх JSON files. Определены state matrix, domain invariants, rollback rules
и порядок UPG-055b–UPG-055f. Следующий шаг — machine-readable gate и
verification-only приёмка уже канонической family A, с desktop/mobile
приоритетом Sparky.

Результат UPG-055b — добавлен `scripts/check-preset-contracts.mjs` и включён в
Gate G4. Контракт фиксирует шесть активных dropdown, 38 выбираемых manifest
presets в 40 строках/40 JSON files, четыре inline Pulsar presets, три shared
CRUD и три private data systems; отдельно защищены три upgrade storage keys,
Wordplayer 1-entry manifest, Pizza schema/import/draft и Sticky Google Sheets.
Production HTML/CSS/JS приложений не менялись.

Browser verification подтверждает Sparky `Basic → Shtrikh → Basic` с точным
возвратом 68 form states, panels и 26 806-character SVG, dirty/Save/share и
clean reload; Keyboarder `Work 2.0 L → Ground 14 → Work 2.0 L` с точным
возвратом form states, panels и SVG; Wordplayer `New → Default`, dirty/reload и
0 изменённых RGB channels в центральной Canvas-области. Browser errors — 0.
Empty-storage/duplicate/per-preset history остаются покрыты 36 framework tests;
browser sandbox запретил прямой `localStorage`, поэтому page storage не
мутировал. Sparky 196/196, Keyboarder и Wordplayer suites проходят. Следующий
шаг — UPG-055c, presentation-only canary Pulsar.

Результат UPG-055c — Pulsar fixed dropdown переведён на shared presentation.
Полный local component base и его preset scrollbar selectors удалены; scoped
bridge сохраняет legacy system 14.4/600 toggle, asymmetric 8×12×8×20 padding,
400 px overflow contract, text clipping и selected 600. Четыре inline preset
objects, `applyPreset`, settings и SVG renderer не менялись. Добавлены только
нулевые visual diff semantics: `type="button"`, `aria-controls` и
`role="listbox"`.

Closed/open computed-style records совпадают полностью. Initial 22 form states,
panels и 40 180-character SVG hash `97155e5a…` точны; Accurate и последующий
Voyager совпадают со своими до-migration state/SVG snapshots, включая
существующее отличие startup label/default от явно применённого Voyager. В
full-page JPEG остаётся одинаковый closed/open raster jitter только внутри SVG:
291 RGB channels, max delta 2; dropdown geometry/style не меняются. Outside
click, focus и selected state приняты, browser errors — 0. Pulsar 8/8,
`check:presets` и Gate G4 проходят. Следующий rollout — Sticky Fingers.

Результат UPG-055d — Sticky Fingers manifest-only dropdown переведён на shared
presentation. Полный local base и scrollbar block удалены; framework bridge
сохраняет system 14.4/600 toggle, asymmetric padding, 400 px overflow,
text clipping, selected weight и 6 px scrollbar. Loader, manifest sorting,
width measurement/application, data rows, Google Sheets и exports не менялись.
Добавлен нулевой visual diff `aria-controls`.

Closed и open captures побайтно совпадают, как и все computed-style records.
Laptop initial/restore сохраняет 79 form states, panels и SVG hash
`1592eaac…`; Monitor сохраняет собственные 78 states и SVG `e006d2ff…`;
Tablet даёт ожидаемо другой SVG `c0f0bd8…` и точно возвращается в Laptop.
Edit mode сохраняет 79 states, Layout 300×878.703125, Data 300×242, Objects
300×383, Text 300×237 и SVG `8850fd2f…`. Его единственный raster jitter —
108 RGB channels/max delta 8 в 8×8 px области SVG, вне toolbar; DOM/style/output
snapshots точны. Escape закрывает menu, browser errors — 0. Sticky 5/5 и preset
contract проходят. Следующий rollout — Pizza Boxer.

Результат UPG-055e — Pizza Boxer удалил полный local preset dropdown base и
получает component skin из shared framework. В приложении остались только
private divider rules, repository/schema/import/history/draft logic и точные
font/padding/400 px overflow bridges. Добавлен `aria-controls`; data model и
обработчики выбора не менялись.

Первый production build был отвергнут до приёмки: генератор публичного HTML
оставил source-relative путь `../../framework-base.css`, и shared CSS не
загрузился. `renderApplicationDocument` теперь независимо от cache-buster
переписывает его в root-relative для инструмента `./framework-base.css`; тест
фиксирует разные корректные пути source и public документов. Повторная сборка
создала проверенный 15-asset runtime.

Closed/open computed-style records и geometry совпадают с pre-rollout
эталонами полностью. `New → E-ink → New` сохраняет 113 form states, panels и
точные SVG: New 94 374/hash `4abbde0d…`, E-ink 78 234/hash `9d4f24e9…`.
Escape закрывает listbox и возвращает focus toggle; browser errors — 0.
Schema 1.2, 19 built-ins, два divider, import rollback, per-preset history и
draft recovery подтверждены полным набором 167/167 тестов. Следующий шаг —
UPG-055f preset component gate.

Результат UPG-055f — preset family закрыта. `check:presets` фиксирует шесть
active dropdown, 38 selectable manifest presets в 40 rows/40 JSON files,
четыре inline Pulsar presets, три shared CRUD и три private data systems.
Final bridge inventory и условия удаления записаны в compatibility matrix.
Isolation, storage/boundary checks, 36 framework tests и все восемь app suites
проходят в полном Gate G4. Следующий шаг — UPG-056a, audit нижних
action/export панелей без production diff.

### UPG-056. Нижняя панель действий и export presentation

Унифицируются placement, button states, focus и progress presentation. Форматы,
filename, SVG/PDF/PNG geometry, font embedding и workers остаются частными.

Обязательные canaries: Sparky static/animation export, Pizza SVG/PDF/JSON,
Sticky SVG/PDF, Keyboarder editable/outlined SVG/PDF, Wordplayer PNG/SVG,
Dither PNG, Wander/Pulsar SVG.

Результат UPG-056a — создан `ACTION_EXPORT_COMPATIBILITY_MATRIX.md` без
production diff. Зафиксированы восемь bars, 31 `btn-fixed`, две специальные
кнопки Sparky и девять label-controls: всего 42 direct controls. Определены пять
presentation families, восемь private export pipelines, accessibility gaps,
rollback rules и порядок UPG-056b–h. Общая граница остаётся view-only:
framework не получает generic exporter или чужие filename/domain rules.

Результат UPG-056b — добавлен `check:actions` и включён в Gate G4. Он
защищает 42 direct controls, IDs/formats, current shared/local CSS ownership,
Sparky progress/mobile, Wordplayer aria-busy, Pizza/Sticky/Dither private
states и все восемь export pipelines. Все action bars получили явные
`role=toolbar` и доступное имя; пять изменённых captures имеют 0 changed RGB
channels, controls/geometry точны.

Sparky подтверждён в static и Basic Wild states: labels переключаются
`Export PNG / Export ⌘E` ↔ `Export PNG sequence / Export MP4`. Working
state скрывает и disables обе кнопки, показывает progress/cancel; cancellation
возвращает idle/buttons. Intentional AbortError больше не логируется как export
failure и защищён тестом. На 390×844 и 430×932 action bar остаётся скрытым.
Sparky 196/196, Keyboarder и Wordplayer suites проходят.

Результат UPG-056c — Wander удалил полный local action bar/button base и
получает canonical shared presentation через scoped `revert-layer`.
Намеренный diff одной кнопки: Arial 14.4/600 и 8×15 px → CoFo 16/500 и
8×20 px; width 110.016→124.914 px, центр и 36 px height сохранены. Raster diff
ограничен кнопкой. Panel 300×605.703125, 41 fields и Radial/Random/Flow SVG
точны; возврат к исходному Radial state точен. Wander 10/10 и action gate
проходят. Следующий rollout — UPG-056d Pulsar.

Результат UPG-056d — Pulsar удалил полный local `bottom-buttons`/`btn-fixed`
base и получает canonical shared presentation через scoped `revert-layer`.
Намеренный diff трёх кнопок: CoFo 14.4/600 и 8×15 px → CoFo 16/500 и 8×20 px;
общая ширина 313.664→366.281 px, центр, bottom anchor и 36 px height сохранены.
Raster diff ограничен нижней панелью. Verify открывает и закрывает прежний
modal с зафиксированной legacy CRC-ошибкой; Copy показывает зелёный `✓ Copied!`
и восстанавливается. Все 22 поля, три panel rect и SVG 40 180/hash `97155e5a…`
точны; browser/module errors — 0. Pulsar 8/8 и action gate проходят. Следующий
rollout — UPG-056e Pizza Boxer.

Результат UPG-056e — Pizza Boxer удалил local base action bar, fixed button и
дублирующий export variant. Shared framework теперь владеет shell; private
остались muted Setup, bordered PDF и right group extensions. Намеренный diff
четырёх кнопок: Arial 14.4/600 и 8×15 px → CoFo 16/500 и 8×20 px. Bar остаётся
320×664, 640×36; muted/PDF paint и правый край Outline сохранены, raster diff
ограничен action region. Browser JSON, SVG и PDF actions не меняют документ.
New/E-ink/New возвращают точные 113 fields, panels и SVG 94 374/`4abbde0d…`,
78 234/`9d4f24e9…`, 94 374/`4abbde0d…`; errors — 0. Public runtime пересобран
в 15 hashed assets, Pizza 167/167 и action gate проходят. Следующий rollout —
UPG-056f Sticky Fingers.

Результат UPG-056f — Sticky Fingers удалил local action bar/fixed button base
и дублирующий export paint. Shared framework владеет shell; private остались
muted preset/SVG variants, right group, edit/data visibility и batch lifecycle.
Намеренный diff visible buttons: Arial 14.4/600 и 8×15 px → CoFo 16/500 и
8×20 px; normal group 283.211→306.078 px, центр/bottom/36 px height сохранены,
raster diff ограничен action region. Normal 79 fields, Data 300×242 и SVG
18 640/`1592eaac…`; edit 79 fields, Layout 300×878.703125, Objects 300×383,
Text 300×237 и SVG 18 607/`8850fd2f…` точны. Preset, current SVG/PDF actions
не меняют state; Outline/Prepress round-trip точен, errors — 0. Google Sheets
остаётся user-initiated private boundary; Sticky 5/5 и action gate проходят.
Следующий rollout — UPG-056g Dither.

Результат UPG-056g — Dither удалил local fixed-button base и получает shared
shell через raster-safe promotion. Private остаются left 20 px anchor/z-index,
36 px destructive remove buttons и четыре native 16×16 export option labels.
Намеренный diff обычных кнопок: Arial 14.4/600, 8×15, 1 px border и 35.5 px
height → CoFo 16/500, 8×20, no border и 36 px; bar width 904.695→947.742 px,
его левый/bottom anchor сохранён. Для default, Bayer и Pixel Size 4 получен один
и тот же full-page diff `21675/max 255/bounds [8,400,623,423]`, полностью ниже
Canvas region: Canvas имеет 0 изменённых пикселей, 38 fields, panels и
Canvas/overlay geometry точны. Alpha и ×2/×4/×8 exclusivity, PNG ×2,
disabled/no-image и reload restore проходят; errors — 0. Dither 11/11 и action
gate проходят. Следующий шаг — UPG-056h final action gate.

Результат UPG-056h — action family закрыта. `check:actions` фиксирует восемь
shared shells, 42 direct controls и восемь private export pipelines. Framework
владеет centered bar/button normal/hover/focus/disabled; app-owned остаются
Sparky progress/cancel/mobile, Pizza/Sticky group и semantic variants, Pulsar
Copy flash, Wordplayer busy state и Dither left anchor/remove/native export
labels. Sparky progress не вынесен в speculative shared primitive: его lifecycle
жёстко связан с animation worker и cancel. `all:revert-layer` bridges удаляются
только после UPG-058 legacy universal resets; Dither anchor — только при отдельном
решении центрировать инструмент. Source manifest, assets/provenance,
storage/path isolation, 36 framework tests и все восемь app suites проходят в
полном Gate G4. Следующий этап — UPG-057a dialog/tooltip/error/toast audit.

### UPG-057. Dialog, tooltip, error и toast presentation

Общий framework владеет shell, focus trap, dismissal и визуальными tokens.
Приложение владеет текстом, validation и recovery decision. Не объединять
unsaved guard, Pizza recovery и export errors в одну domain-модель.

Результат UPG-057a — production не изменён; создана
`DIALOG_FEEDBACK_COMPATIBILITY_MATRIX.md`. Зафиксированы 3 native
dialogs, 2 active legacy overlays, 2 dormant Pizza/Sticky overlay fragments, 1 Sparky
shortcut popup, 47 tooltip hosts и раздельные feedback families. Важный
blocker: shared overlay и native dialog одновременно используют
нескоупленный `.modal-content`; local overlay CSS нельзя удалять до
отдельного regression contract. `TooltipService` пока mouse-only, а
Pulsar overlay lifecycle не имеет полной keyboard/focus семантики; Sticky
controller сохранился после удаления его UI-trigger и не должен быть оживлён.
Решение: общий native `DialogHost`, минимальный
`OverlayDialogHost` для двух реальных consumers и accessible `TooltipService`;
domain presenters/progress/recovery остаются private. Следующий шаг —
UPG-057b machine-readable feedback gate.

Результат UPG-057b — `check:feedback` добавлен в Gate G4 и до первого
production diff фиксирует 3 native dialogs, 2 active overlays + 2 dormant
fragments, 1 private popup, 47 tooltip hosts, 10 primary blocking browser calls,
shared shells и private feedback/recovery ownership. Следующий шаг — UPG-057c
CSS scoping и native `DialogHost` lifecycle hardening.

Результат UPG-057c — конфликт двух широких `.modal-content` устранён без
визуального изменения: legacy overlay использует
`.modal-overlay > .modal-content`, native dialog — `.modal > .modal-content`,
а общие title/scrollbar/responsive rules явно перечисляют обе семьи. Для
Keyboarder до/после полностью совпали dialog/content rect, background,
radius, max sizes, overflow, padding 20 px, scale 0.95, transition и 24 px
title; Wordplayer сохраняет тот же shell, Escape и возврат фокуса на About.
Три native dialog получили `aria-labelledby="dialogTitle"`. `DialogHost`
теперь разрешает native cancel/close, повторный show, repeated close, exact-once
Promise resolution, focus return и destroy; `ApplicationShell.destroy()`
освобождает его listeners. Dither и Pulsar overlay остаются рабочими со своими
600 px shells; dormant Sticky UI не оживлён. Framework 38/38, все app suites,
isolation и полный Gate G4 проходят. Следующий шаг — UPG-057d accessible
`TooltipService`.

Результат UPG-057d — 47 существующих tooltip hosts в Sparky 4, Keyboarder 21
и Wordplayer 22 получили общий focus lifecycle, `role="tooltip"`, временный
`aria-describedby`, Escape dismissal и очистку своих attributes/listeners.
Existing `aria-describedby` сохраняется; dynamic и disabled copy, viewport flip
и destroy покрыты unit test. Pointer mode до/после точен во всех трёх apps:
совпадают text, rect, padding 6×10, 12/400 font, colors, 4 px radius, opacity,
visibility и z-index. Keyboard focus показывает ту же copy под host, Escape
скрывает её, оставляет focus и снимает только `cursorTooltip` reference.
Versioned public-module chain гарантирует загрузку обновлённого service, не
создавая app-local copies. Framework 39/39, все app suites, isolation и полный
Gate G4 проходят. Следующий шаг — UPG-057e Dither `OverlayDialogHost` canary.

Результат UPG-057e — создан presentation-neutral `OverlayDialogHost` и через
существующий adapter подключён к Dither. App-local Escape/help/close/backdrop,
class и body-overflow lifecycle удалён; markup, copy, CSS и Canvas domain-код
не менялись. Default, Bayer и Pixel Size 4 имеют нулевую разницу state и RGB.
Открытый shell сохраняет точный rect 600×483.523 px, padding 30 px, radius
12 px, max sizes, background и transform. Намеренное отличие — initial focus
теперь находится на Close, а не за overlay на Help; Tab удерживается внутри,
Escape/backdrop возвращают focus и восстанавливают scroll. Добавлены ARIA
trigger state и полный destroy contract. Framework 41/41, Dither 11/11,
feedback contract, isolation и полный Gate G4 проходят. Следующий шаг —
UPG-057f Pulsar rollout и доказательство dormant Pizza/Sticky fragments.

Результат UPG-057f — Pulsar подключён к тому же `OverlayDialogHost` с
`bindTrigger: false`: codec и rich verification HTML остаются app-owned, а
окно открывается после вычисления результата. Известный CRC failure body,
shell 600×272.820 px, 22 fields, три panels и SVG 40 180 символов/hash
`97155e5a…` точны. Copy flash восстанавливается через 1.5 s. Initial focus
на Close, Tab loop, Escape/backdrop/close focus return, scroll restore и ARIA
прошли browser acceptance без новых ошибок. Pizza runtime имеет orphan overlay,
но не trigger/controller; Sticky сохраняет старый controller и закрытый fragment,
но не имеет Help trigger. Shared host отсутствует в обоих, поэтому UI не оживлён.
Framework 42/42, Pulsar 8/8, feedback contract, isolation и полный Gate G4
проходят. Следующий шаг — UPG-057g feedback accessibility/blocking calls.

Результат UPG-057g — все 10 оставшихся blocking `alert/confirm` устранены.
Sticky направляет пять error paths и dormant navigator delete decision через
общий `DialogHost`; Pulsar — три empty-map guards; Wander — clipboard fallback.
Тексты, validation, export/codec/persistence решения остаются app-owned.
Sticky `dataStatus` стал atomic live region: progress/success получает
`status`/polite, ошибка — `alert`/assertive; Google Sheets остаётся явным
user-initiated boundary. Closed Sticky и Wander captures точны; Sticky сохраняет
79 fields, Wander 41 fields, panel 300×605.703125 и Radial SVG. Pulsar сохраняет
22 fields, три panels, rich CRC failure body и SVG 40 180/`97155e5a…`; виден
только уже зафиксированный reload SVG jitter 291 RGB/max 2. Итоговый contract:
6 native dialogs, 2 active overlays + 2 dormant fragments, 1 private popup,
47 tooltip hosts и 0 primary blocking calls. Framework 42/42, Sticky 5/5,
Pulsar 8/8, Wander 10/10, isolation и полный Gate G4 проходят. Следующий шаг —
UPG-057h final feedback component gate.

Результат UPG-057h — feedback family закрыта. Итоговое владение зафиксировано:
framework обслуживает 6 native dialogs, 2 active overlay lifecycle и 47
tooltips; app-owned остаются Pizza ErrorPresenter/DraftRecovery, Sticky Sheets
status, Sparky shortcut/animation state, Pulsar Copy flash, Keyboarder toast
copy/timing и Wordplayer busy state. Для dormant Pizza/Sticky overlay и dead
Wander modal CSS заданы отдельные removal proofs; они не были оживлены ради
теста. Cumulative browser acceptance покрывает open/close, Escape, backdrop,
Tab/focus return, scroll restore и tooltip keyboard lifecycle. Финальный smoke
загружает все 8 entrypoints до complete с закрытыми поверхностями и 0 errors.
Feedback contract, isolation, framework 42/42, все app suites и полный Gate G4
проходят. UPG-057 завершён; следующий шаг — UPG-058a legacy CSS inventory без
production diff.

### UPG-058. Удалить подтверждённые legacy CSS-дубли

Удалять только rules, которые:

- покрыты shared CSS;
- не требуются parity bridge;
- имеют browser capture до/после;
- не используются donor/example HTML как отдельный контракт.

После каждого приложения запускать поиск orphan selectors и boundary tests.

Результат UPG-058a — создан `LEGACY_CSS_CLEANUP_MATRIX.md`, а новый
`check:legacy-css` включён в Gate G4 до первого удаления. Он зафиксировал
5 frozen universal resets, 17 initial `revert-layer` promotions, 2 dormant
overlays, 3 broad local native-dialog collisions и одну Wander overlay-family
без markup. Обнаружено, что broad `.modal-content` Sticky/Pulsar/Wander нельзя
удалять как обычный orphan: он перекрывает новые native dialogs. Production на
этом шаге не изменён; полный Gate G4 проходит.

Результат UPG-058b — Wander удалил всю markup-less overlay/close/body family,
broad content, scrollbar и responsive copies. Закрытый capture `10b48338…`,
41 fields, panel 300×605.703125 и Radial SVG 1 838/`8bcdfde2…` точны. Для
native dialog потребовался один узкий `revert-layer` bridge поверх frozen
universal padding reset; его canonical shell намеренно меняется 30→20 px,
90→100% и title 600→500 при неизменных radius/max-width/label. Текущий contract:
18 promotions, 2 dormant overlays, 2 broad collisions, 0 overlay-only orphan
families. Wander 10/10 и полный Gate G4 проходят. Следующий шаг — UPG-058c
Pizza orphan fragment.

### UPG-059. Gate G5

Критерии:

- все восемь инструментов используют общий CSS и public JavaScript boundary;
- согласованные navigation, panels, controls, presets и actions выглядят и
  взаимодействуют одинаково, кроме документированных domain-вариантов;
- domain golden tests и export geometry не изменились;
- Sparky desktop, 390×844 и 430×932 приняты;
- isolation/storage/network checks проходят;
- bridges сведены в таблицу и каждый имеет владельца/причину удаления.

## 4. Шаблон приёмки каждой задачи

В отчёте обязательно указать:

- изменённый общий компонент и приложения;
- состояния, просмотренные до/после;
- намеренные visual diffs;
- неизменные domain counts/hashes/export geometry;
- новые или удалённые bridges;
- результаты app tests, `check:isolation` и `gate:g4:static`;
- следующий один шаг, а не пакет несвязанных улучшений.

Если diff неожиданно затрагивает domain output, задача откатывается внутри
`upgrade`, а причина документируется до продолжения rollout.
