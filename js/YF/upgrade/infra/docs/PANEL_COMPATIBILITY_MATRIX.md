# UPG-053a — panel и collapse compatibility matrix

Дата фиксации: 2026-08-31. Runtime-состояние: после UPG-052 и полного зелёного
`npm run gate:g4:static`.

Цель этого документа — отделить общий внешний контракт панели от частных
координат, stacking, collapse-state и domain lifecycle. До этой фиксации нельзя
заменять app-owned `PanelManager` или переносить collapse-логику между
инструментами.

## 1. Общий baseline

Рабочий framework уже задаёт общий presentation shell:

- `.controls-panel`: fixed 300 px shell, radius/shadow/background;
- directional variants: left, text/bottom-left, presets/effects/bottom-right;
- `.panel-header`: 15×20 px padding, 36 px minimum height, draggable cursor;
- `.collapse-icon`: 16×16 px hit area and `-90deg` collapsed rotation;
- `.panel-content`: flex/scroll shell and animated collapsed state;
- `.panel-params`: summary, видимый в collapsed state;
- `PanelManager`: registration, open/close, drag, stacking, `initCollapse`,
  `setCollapsed` и snapshot-based `toggleAllCollapsed`.

Void использован только как read-only donor. Его текущий `PanelManager` содержит
базовые register/drag/open/stack операции, но не более новые collapse utilities.
Следовательно, полезный путь уже находится в Upgrade framework; runtime-import
из Void не нужен.

## 2. Фактический browser inventory, 1280×720

Всего в восьми приложениях 33 panel shells. На default startup видимы 23;
остальные зависят от mode/edit/editor state. Двадцать семь панелей имеют
`.collapse-icon`; две панели Dither используют drag-only icon, а четыре скрытых
object editor panels Pizza/Sticky имеют собственные header actions без collapse.

| Инструмент | Панели и default state | Runtime owner | Drag/stack | Collapse и accessibility | Неподвижный контракт |
|---|---|---|---|---|---|
| Sparky | 4: `shape`, `focus`, `eyes`, `colors`; все раскрыты | shared `PanelManager` через `defineTool` | clamped; content click raises | shared click collapse; icons `aria-hidden`, без focus/ARIA state; global snapshot toggle | mobile showcase, safe area, 4-panel restoration, 47 px header from private TT Commons |
| Keyboarder | 5: `grid`, `type`, `layers`; `colors` collapsed; `legend` conditional/hidden | shared manager + app editor lifecycle | clamped; content click raises | shared collapse; icons без role/tabindex/ARIA; app separately opens/positions Legend/Colors | legend editor transient state, two initially collapsed panels, SVG editing |
| Wordplayer | 4: `text`, `pixels`, один из `dither`/`forms`; второй mode panel hidden | shared manager through `defineTool` | clamped; content click raises | shared collapse; icons без role/tabindex/ARIA | mode visibility, Dither/Forms state and Canvas workers |
| Pizza Boxer | 7: `grid`, `surface` collapsed in right stack, `controls`, `elements` collapsed, `text`; `paragraph`/`graphics` hidden editors | private Registry/Drag/Ui controllers | clamped; one listener scope; content click raises; stack layout | strongest contract: role, tabindex, label, expanded state, Enter/Space; bottom-anchor and text-section restoration | right stack flex, summaries, editor lifecycle, 46 px collapsed height, exact restore |
| Sticky Fingers | 7: `dataImport` visible; 4 edit panels conditional; 2 object editors hidden | legacy app manager + delegated collapse code | clamped; content click raises; no transform reset | role/tabindex/label and Enter/Space; no `aria-expanded`; edit mode forcibly expands panels/inner sections | unbounded max-height bridge, 878.703 px Layout panel, text-section restoration, Sheets/PDF |
| Pulsar Coder | 3: `main`, `encoding`; `visual` collapsed | shared manager for drag, app click handler for collapse | clamped; content click raises | icons/click only, no role/tabindex/ARIA | three independent anchors, private zoom, codec/SVG output |
| Dither | 2: `transform`, `controls`; both always expanded | `DitherPanelManager` subclass | unbounded drag; z-order changes only during header drag; content clicks paint-neutral | no collapse; explicit `.drag-icon` variant | Canvas/overlay raster, 36 px header, 20×20×0 padding, no new collapse behavior |
| Wander Bender | 1 always-visible `controls` panel | `WanderPanelManager` subclass | shared clamping/stacking; private `setPosition` preserves transform | shared click collapse; no role/tabindex/ARIA | single long panel, 605.703 px default height, Radial/Random/Flow and SVG exactness |

## 3. Presentation differences

The browser audit records these current families:

| Family | Header title | Header box | Content top | Members |
|---|---|---|---|---|
| direct canonical | 14.4 px / 500 | 46 px, 15×20 padding | 0 px | Keyboarder, Wordplayer |
| Sparky mobile reference | 14.4 px / 500 | 47 px, 15×20 padding | 0 px | Sparky |
| legacy skin over shared layer | 13.6 px / 500 | 46 px, 15×20 padding | 4 px | Pizza, Sticky, Pulsar, Wander |
| drag-only Dither | 13.6 px / 500 | 36 px, 20×20×0 padding | 20 px | Dither |

Сейчас общий shell уже совпадает по width, radius, icon geometry, header padding и
collapsed height у всех, кроме документированного Dither variant. Главный
presentation-only разрыв — 13.6 против 14.4 px в header title. Его можно менять
без вмешательства в lifecycle.

## 4. Семантические различия, которые нельзя смешивать с внешним видом

1. `open/close` (`display`) и `collapsed` (`panel-collapsed`) — разные состояния.
   Hidden editors и mode panels нельзя считать collapsed.
2. Pizza right stack использует relative children и flex shrink. Перетаскивание
   или изменение height одного child влияет на второй.
3. Pizza и Sticky сохраняют inner text-style sections при collapse; простой
   class toggle это поведение потеряет.
4. Sticky edit mode раскрывает panels и большинство внутренних sections. Shared
   manager не должен отменять этот domain transition.
5. Sparky `toggleAllCollapsed` восстанавливает только ранее раскрытый набор;
   это mobile/shortcut canary.
6. Keyboarder Legend — динамический editor panel; его show/hide и position не
   являются обычным collapse.
7. Wordplayer переключает Dither/Forms через `display`, сохраняя оба panel
   registrations.
8. Pulsar управляет collapse app handler, хотя drag получает из shared manager.
9. Dither намеренно не имеет collapse и не поднимает panel на content click.
10. Wander не сбрасывает CSS transform при drag; это обязательный adapter rule.

## 5. Accessibility gap

Pizza — единственный полный reference: focusable toggle, Enter/Space,
`aria-label` и `aria-expanded` синхронизированы с class state. Sticky близок, но
не ведёт `aria-expanded`. Shared `PanelManager.initCollapse` сейчас выполняет
только click/class toggle. Pulsar дублирует такой же app handler. Поэтому нельзя
просто добавить `role="button"` в HTML: focusable control без keyboard handler и
state sync будет ложным accessibility-контрактом.

Будущая поведенческая унификация должна отдельно:

1. добавить idempotent state sync и Enter/Space в shared manager;
2. покрыть initial expanded/collapsed и `setCollapsed` тестами;
3. подключить прямые приложения и Wander;
4. адаптировать Pulsar, удалив только подтверждённый duplicate handler;
5. оставить Pizza/Sticky private controllers до отдельных parity gates;
6. не добавлять collapse в Dither в этой задаче.

## 6. Rollout UPG-053

### UPG-053b — первый безопасный canary: Wander header title

Единственное изменение: promoted app rule переводит title с legacy 13.6 px на
shared 14.4 px / 500. Почему Wander выбран первым:

- одна всегда видимая панель, без stack/summary/editor/mobile variants;
- collapse и drag уже идут через shared manager + узкий tested adapter;
- panel/content/SVG geometry можно сравнить целиком;
- три domain modes и generated SVG имеют точные tests/captures;
- изменение не требует framework JS или удаления legacy CSS.

Acceptance: intentional title-only visual diff; panel rect 300×605.703, header
46 px, content/inputs, zoom, generated SVG markup, collapse/restore и drag
position rule должны остаться точными.

Результат: выполнено. Принят только title font 13.6 → 14.4 px; 16 px
line-height удержал header на 46 px и panel на 300×605.703. Все 41 input state,
Radial/Random/Flow SVG markup, collapse/restore и drag adapter точны; 10 тестов
и isolation проходят.

### UPG-053c — Pulsar header title

Тот же presentation-only promotion отдельно. Проверить три rect, initial
collapsed Visual, independent anchors, codec SVG/inputs и ручной collapse.

Результат: выполнено. Заголовки `Main`, `Encoding` и `Visual` переведены
13.6 → 14.4 px с явным 16 px line-height. Все три header остались высотой 46 px;
default panels сохранили rect 300×560, 300×214.6016 и 300×46, Visual после
раскрытия — 300×404, Main после collapse — 300×46. `pulsarSvg` сохранил rect
1000×720 и exact 40 180-character markup, все 22 input state совпадают.
Full-page hash изменился только в принятом presentation canary:
`8f2688…` → `435f69…`; 8 тестов и isolation проходят.

### UPG-053d — Pizza header title

High-priority приложение мигрируется отдельно: right-stack, summary, editor и
public-runtime rebuild входят в acceptance.

Результат: выполнено. Source rule и воспроизводимый 15-asset runtime переводят
все семь title с 13.6 на 14.4 px при 16 px line-height. Пять default shells,
46 px headers, Grid 300×526.1016, expanded Surface 300×99.8984, collapsed Grid
300×46 и right-stack anchors точны. Inline summary glyph boxes изменились только
вместе с принятой типографикой; тексты и state остались точными. Paragraph
300×680 и Graphics 300×451 editors с 54 px header, SVG 1280×720/exact 94 374
characters, 113 inputs и bottom actions совпадают. Full-page hash:
`4d4a27…` → `6fbbb2…`; 167 тестов, public-runtime и isolation проходят.

### UPG-053e — Sticky header title

Выполнить отдельно от Pizza. Acceptance включает normal/edit, long 878.703 px
panel, inner sections, Google Sheets и PDF; private controller не заменять.

Результат: выполнено. Все семь title/summary переведены 13.6 → 14.4 px с
16 px line-height; runtime logic не менялась. Normal Data Import 300×242,
edit Layout 300×878.703, Text Styles 300×237 и все 46 px headers точны.
Раскрытая inner section переживает Text Styles 300×505 → 300×46 → 300×505.
Paragraph 300×847.492 и Graphics 300×567 editors сохраняют 54 px headers,
positions, content и state. Normal/edit SVG markup и 79 inputs совпадают;
captures: `2d2e85…` → `164e7e…` и `c2d238…` → `299465…`. Google Sheets
остался явным user-initiated flow, local PDF implementation не затронута;
4 теста и isolation проходят.

### UPG-053f — direct canonical verification

Sparky, Keyboarder и Wordplayer уже имеют canonical 14.4/500 header title.
Здесь нужен boundary-test и browser evidence, а не визуальная правка. Sparky
обязательно остаётся единственным mobile acceptance target.

Результат: выполнено без runtime/CSS diff. Boundary tests фиксируют shared
`.panel-header span:first-child` 0.9rem/500 и запрещают private override во всех
трёх приложениях. Browser подтверждает: четыре Sparky title — 14.4/500 с
private-font 47 px header; пять Keyboarder и четыре Wordplayer title — 14.4/500
с 46 px header. Sparky Shape collapse/restore сохраняет exact panels,
26 806-character SVG и 68 inputs; Keyboarder Colors 300×46 → 300×284 → 300×46
с exact 133 295-character SVG/82 inputs; Wordplayer Dither/Forms panels и
68 inputs возвращаются точно. Sparky CSS не получает selector override или
другой visual change, поэтому принятые mobile layouts остаются теми же; все
196 тестов, Keyboarder/Wordplayer suites и isolation проходят.

### UPG-053g — collapse semantics/accessibility

Только после завершения title rollout. Это отдельная behavior task с framework
tests, полным Gate G4 и browser keyboard checks; она не должна одновременно
менять padding, height, drag или stacking.

Результат: выполнено. Shared manager идемпотентно синхронизирует click,
Enter/Space, `role`, `tabindex`, `aria-expanded` и state label при init,
interaction, `setCollapsed` и global snapshot restore. Sparky, Keyboarder,
Wordplayer и Wander получают контракт без app diff; ни один новый attribute не
попадает под их CSS selectors. Pulsar удалил duplicate click handler и вызывает
`panelManager.initCollapse()`. Его full-page capture остался byte-identical
`435f6961…`; Visual 300×404, Main 300×46, SVG/22 inputs и restore точны. Wander
capture также byte-identical `ea74b239…`; direct-app panels/SVG/Canvas/inputs
возвращаются точно после keyboard interaction. Pizza/Sticky controllers не
изменены, Dither по-прежнему drag-only. Framework теперь имеет 35 тестов;
целевые suites и isolation проходят.

Dither исключён из UPG-053b–g. Его drag-only header и raster coupling сначала
требуют отдельного расследования; новый baseline не принимается автоматически.

## 7. Capture template для каждой подзадачи

До/после записываются:

- panel id/class/display и полный rect;
- computed header height/padding/title font/cursor;
- icon rect/class/role/tabindex/label/expanded;
- content max-height/opacity/padding/overflow;
- initial, collapsed и restored state;
- anchor coordinates после drag canary;
- app canvas/SVG rect и exact output markup/hash;
- form state и module/browser errors;
- app tests, `check:isolation`, затем полный `gate:g4:static` при закрытии rollout.

Любая незапланированная разница в panel rect, domain output, bottom anchoring,
stack order или raster считается rollback condition.
