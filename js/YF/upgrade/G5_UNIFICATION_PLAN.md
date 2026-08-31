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

### UPG-055. Preset toolbar

1. Канонический shared toolbar остаётся источником Sparky/Keyboarder/Wordplayer.
2. Pulsar подключает только совместимый presentation layer; его preset data
   остаётся частным.
3. Pizza и Sticky сохраняют собственные repositories/schema и адаптируют view
   отдельно.
4. Dither/Wander не получают фиктивные presets в этой задаче.
5. Проверить duplicate names, dirty state, share, seed/migration hooks и empty
   storage namespace.

### UPG-056. Нижняя панель действий и export presentation

Унифицируются placement, button states, focus и progress presentation. Форматы,
filename, SVG/PDF/PNG geometry, font embedding и workers остаются частными.

Обязательные canaries: Sparky static/animation export, Pizza SVG/PDF/JSON,
Sticky SVG/PDF, Keyboarder editable/outlined SVG/PDF, Wordplayer PNG/SVG,
Dither PNG, Wander/Pulsar SVG.

### UPG-057. Dialog, tooltip, error и toast presentation

Общий framework владеет shell, focus trap, dismissal и визуальными tokens.
Приложение владеет текстом, validation и recovery decision. Не объединять
unsaved guard, Pizza recovery и export errors в одну domain-модель.

### UPG-058. Удалить подтверждённые legacy CSS-дубли

Удалять только rules, которые:

- покрыты shared CSS;
- не требуются parity bridge;
- имеют browser capture до/после;
- не используются donor/example HTML как отдельный контракт.

После каждого приложения запускать поиск orphan selectors и boundary tests.

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
