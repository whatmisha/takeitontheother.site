# UPG-058: Legacy CSS and Orphan Selector Cleanup Matrix

Дата аудита: 2026-09-01.

## 1. Правило этапа

UPG-058 удаляет только доказанный legacy-дубль или orphan. Любое правило
сохраняется, если оно:

- задаёт частную геометрию или domain-state инструмента;
- компенсирует всё ещё активный unlayered universal reset;
- влияет на Canvas/SVG/export или на приоритетный mobile Sparky;
- не имеет точного before/after capture и автоматического boundary.

Production исходников вне `upgrade/` этап не касается. `revert-layer` не
считается мусором сам по себе: это активный migration bridge, который можно
снять только одновременно с побеждавшим его legacy reset/selector.

## 2. Machine-readable baseline

`scripts/check-legacy-css-contracts.mjs` фиксирует исходную точку до первого
удаления:

- 5 frozen universal resets: Pizza, Sticky, Pulsar, Dither и Wander;
- 17 `all: revert-layer` promotion bridges: Pizza 4, Sticky 4, Pulsar 3,
  Dither 4, Wander 2;
- 2 dormant overlays: Pizza и Sticky;
- 2 активных overlays: Dither и Pulsar;
- 3 широких local `.modal-content`, которые одновременно задевают новые
  native dialogs Sticky, Pulsar и Wander;
- 1 overlay-selector family Wander без соответствующего overlay markup.

Контракт добавляется в Gate G4 до первого удаления. После каждого rollout его
ожидаемая таблица обновляется вместе с доказательством, поэтому удалённый orphan
не сможет незаметно вернуться.

## 3. Карта кандидатов

| Кандидат | Текущее доказательство | Риск | Решение |
|---|---|---:|---|
| Wander `.modal-overlay`, `.modal-close`, `.modal-body` | в HTML/JS нет overlay/controller | низкий | первый canary; удалить overlay-only blocks |
| Wander broad `.modal-content` | overlay нет, но новый native `dialog` содержит `.modal-content` | средний | не считать orphan; отдельно принять canonical native shell |
| Pizza help fragment + slot + loader entry | fragment загружается, но opener/controller/ARIA trigger отсутствуют | средний | удалить атомарно и пересобрать public runtime |
| Pizza modal-only CSS/scrollbar members | нужны только orphan fragment; selectors смешаны с panel/menu lists | средний | удалить точечно, не затрагивая panel/menu scrollbars |
| Sticky help markup/controller | `helpButton` отсутствует, но markup и guarded controller остаются | средний/высокий | удалить markup + controller вместе; приоритетный exact regression |
| Sticky broad `.modal-content` | влияет и на dormant overlay, и на active native DialogHost | высокий | после orphan removal оставить canonical native shell, проверить error dialog |
| Pulsar overlay CSS | активный Verify overlay и native feedback dialog делят broad selector | высокий | scope private overlay deltas; native dialog перевести на canonical shell |
| Dither overlay CSS | active Help с pixel-safe Canvas baseline | высокий | удалять только byte-equivalent structure; private typography/geometry оставить scoped |
| 17 promotion bridges | компенсируют 5 active universal resets | высокий | не удалять отдельно; сокращать после удаления конкретных reset conflicts |
| Sparky/Keyboarder/Wordplayer private CSS | уже используют shared families без frozen reset | высокий из-за приоритета | не трогать без отдельного подтверждённого дубля |

## 4. Важное уточнение после UPG-057

Старые `.modal-content` в Sticky, Pulsar и Wander больше не являются просто
копией overlay-стилей: после добавления `DialogHost` они совпадают с классом
внутри native `<dialog>` и, будучи unlayered, перекрывают shared layer. Поэтому
bulk-delete мог бы одновременно изменить ширину, padding, transform, title и
scrollbar нового error-dialog. Сначала нужно удалить или сузить overlay family,
затем отдельно снять collision и принять open native state.

Для shared CSS уже действует правильное разделение:
`.modal-overlay > .modal-content` и `.modal > .modal-content`. Local legacy
selectors должны прийти к той же границе.

## 5. Порядок rollout

### UPG-058b — Wander selector canary

- снять только overlay-only markup-less blocks;
- отдельно сравнить native dialog до/после и при необходимости сохранить
  минимальный scoped private delta;
- сохранить 41 field, panel 300×605.703125 и три SVG mode outputs;
- обновить legacy contract и выполнить Gate G4.

### UPG-058c — Pizza orphan fragment

- удалить `help` slot, loader manifest entry и fragment;
- удалить только связанные modal rules и members из объединённых scrollbar
  lists, не меняя panel/dropdown scrollbars;
- rebuild 15 hashed public assets;
- принять New/E-ink/New: 113 fields, panels, JSON/SVG/PDF и exact SVG hashes;
- проверить private ErrorPresenter и DraftRecovery отдельно.

### UPG-058d — Sticky dormant Help

- удалить overlay markup, `helpButton` guard, `initializeModals()` и `showHelp()`;
- отделить native DialogHost от broad legacy content selectors;
- сохранить normal/edit, 79 fields, panels, SVG/PDF/settings exports,
  EAN warning и Google Sheets boundary;
- удалить только после byte/geometry evidence.

### UPG-058e — active overlay duplicate reduction

- Dither: shared structure, private measured help typography/geometry; default,
  Bayer и Pixel Size 4 Canvas должны иметь 0 changed pixels;
- Pulsar: shared structure, private rich verifier; 22 fields, panels, CRC body,
  Copy flash и SVG `97155e5a…` остаются точными;
- canonical native feedback dialog проверяется отдельно от Verify overlay.

### UPG-058f — reset/bridge reduction

- построить selector-level карту пяти universal resets;
- удалять reset conflict и соответствующий `revert-layer` в одном rollout;
- не менять private Dither left anchor, Sticky edit max-height, Wander disabled
  range presentation и preset sizing bridges без отдельного решения;
- после каждого приложения искать orphan selectors и запускать полный Gate G4.

### UPG-058g — cleanup gate

- ноль недокументированных orphan selectors и broad modal collisions;
- каждый оставшийся bridge имеет owner, причину и removal condition;
- source/public Pizza manifest совпадает;
- все восемь runtime smoke, app suites, isolation и Gate G4 проходят;
- затем начинается UPG-059 Gate G5.

## 6. Rollback

Текущий rollout откатывается внутри `upgrade`, если меняется недокументированная
геометрия, focus/ARIA, form state, panel rect, Canvas/SVG/PDF output, storage,
network boundary или любой файл вне `upgrade/`. Неожиданный diff сначала
документируется и разбирается; следующий инструмент до этого не начинается.

## 7. UPG-058a/b result

UPG-058a добавил `check:legacy-css` в Gate G4 до production cleanup. Исходный
контракт подтвердил 5 universal resets, 17 promotions, 2 dormant overlays,
3 broad native-dialog collisions и одну Wander overlay-family без markup.

UPG-058b удалил из Wander все `.modal-overlay`, `.modal-close`, `.modal-body`,
broad `.modal-content`, их scrollbar и responsive rules. HTML и runtime JS не
имели overlay/controller, поэтому удалённая семья не могла обслуживать активную
функцию. При этом аудит обнаружил, что universal `* { padding: 0 }` перекрывает
lower-layer native shell; добавлен один узкий
`.modal > .modal-content { all: revert-layer; }` bridge. Текущий инвентарь —
18 promotions, 2 dormant overlays, 2 broad collisions и 0 overlay-only orphan
families. Этот новый bridge удаляется вместе с Wander universal reset в
UPG-058f, а не раньше.

Закрытый 1280×720 capture остался byte-identical: `10b48338…`. Сохранились 41
field, panel `[960,20,300,605.703125]` и Radial SVG 1 838 символов/hash
`8bcdfde2…`; errors — 0. Скрытый native shell намеренно унифицирован: content
padding 30→20 px, width 90→100%, title weight 600→500; radius 12, max-width 600
и labelling сохранены. Wander 10/10, legacy/feedback contracts, isolation и
полный Gate G4 проходят. Следующий rollout — UPG-058c Pizza orphan fragment.

## 8. UPG-058c result

Pizza Boxer больше не загружает недостижимую Help family. Атомарно удалены
`help` slot из source document, loader manifest entry, fragment file,
`.btn-help`, modal overlay/content/close/body, responsive modal rules, scrollbar
members и ненужный `.modal-close` drag guard. Panel/menu scrollbar lists не
изменены. Reproducible release уменьшился с 15 до 14 hashed assets; source,
build и public-runtime checks совпадают.

Первый after capture отличался на 522 RGB channel, max 7, строго в SVG-local
16×16 region `[48,192,63,207]`. Повторный clean reload вернул исходный
byte-identical screenshot `0549d478…`, а DOM/state оставались точными во всех
трёх captures: 113 fields, пять visible panel rects и SVG 94 374/hash
`4abbde0d…`. Это reload raster jitter, а не результат удаления hidden overlay.
New→E-ink→New даёт точные 94 374/`4abbde0d…`, 78 234/`9d4f24e9…`,
94 374/`4abbde0d…` и полное восстановление 113 fields. Overlay count 1→0,
browser/module/app errors — 0.

Private `ErrorPresenter` и `DraftRecoveryController` не изменялись и остаются
покрытыми suite. Pizza проходит 167/167, feedback contract теперь фиксирует
2 active + 1 dormant overlay, legacy contract — 18 promotions, 1 dormant,
2 broad collisions и 0 overlay-only orphan families. Isolation и полный Gate
G4 проходят. Следующий rollout — UPG-058d Sticky dormant Help.

## 9. UPG-058d result

Sticky Fingers больше не содержит dormant Help: удалены HTML overlay, guarded
`helpButton`, `initializeModals()`/`showHelp()`, help/modal/content/close/body,
scrollbar и responsive CSS. Пять error paths и delete decision продолжают
использовать native `DialogHost`. Один узкий
`.modal > .modal-content { all: revert-layer; }` promotion пропускает canonical
shell через frozen universal reset и будет удалён вместе с ним в UPG-058f.

Normal и edit 1280×720 screenshots byte-identical: `dd028e0f…` и `e08e621f…`.
Оба состояния сохраняют 79 fields и exact panels. SVG остаются
18 640/`1592eaac…` и 18 607/`8850fd2f…`; normal→edit→normal возвращает exact
fields/panels/SVG. Overlay count 1→0. Native dialog намеренно унифицирован:
padding 30→20 px, width 90→100%, title 600→500 при неизменных radius 12,
max-width 600 и labelling. Blank Sheets URL сохраняет существующий
`Please enter a URL`, `alert`/assertive/atomic и не делает внешний запрос.

EAN warning, Google Sheets boundary и exports не менялись. Sticky 5/5,
feedback contract теперь фиксирует 2 active + 0 dormant overlays; legacy
contract — 19 promotions, 0 dormant, 1 broad collision и 0 orphan families.
Isolation и полный Gate G4 проходят. Следующий rollout — UPG-058e active
Dither/Pulsar overlay duplicate reduction.

## 10. UPG-058e result

Dither и Pulsar больше не дублируют structural overlay/content/close/scrollbar/
responsive shells. Framework владеет этой структурой и headings через scoped
promotions. Dither сохраняет только private `z-index:1000`, 0.2 s transition,
closed scale 0.9 и legacy help typography. Pulsar сохраняет только rich verifier
typography; его native feedback title больше не получает overlay weight.

Dither closed capture `f6e17c56…`, 38 fields, обе panel rect и Canvas geometry
точны. Open record полностью совпал: overlay 1280×720, content
`[340,118.234375,600,483.5234375]`, padding 30, z-index 1000, body 13.6,
title 24/600 и 0.2 s timing; focus/ARIA/scroll restore точны. Dither 11/11.

Pulsar сохраняет 22 fields, три panels и SVG 40 180/`97155e5a…`. Verify open
record и rich failure body hash `d05830eb…` точны: content
`[340,223.5859375,600,272.8203125]`, padding 30, title 24/600 и прежние
transitions. Copy flash `Copy SVG → ✓ Copied! → Copy SVG` и SVG точны. Closed
capture имеет только уже известный SVG-local jitter 291 RGB/max 2/bounds
`[64,336,119,479]`. Native feedback shell намеренно унифицирован 30→20 px,
90→100%, title 600→500. Pulsar 8/8.

Из-за пяти frozen universal resets понадобились два scoped promotion blocks;
текущий machine contract фиксирует 21 promotion, 0 dormant overlays,
0 broad native collisions и 0 overlay-only orphan families. Они кандидаты на
совместное удаление с reset conflicts в UPG-058f, а не самостоятельный мусор.
Feedback/legacy contracts, isolation и полный Gate G4 проходят.

## 11. UPG-058f result

Пять universal resets удалены по одному приложению вместе с зависевшими от них
promotion-блоками. Инвентарь менялся монотонно: Wander `5→4` resets и `21→18`
promotions, Sticky `4→3`/`18→13`, Pizza `3→2`/`13→9`, Dither `2→1`/`9→4`,
Pulsar `1→0`/`4→0`. Итоговый machine contract: 0 universal resets,
0 `all: revert-layer`, 0 dormant overlays, 0 broad native-dialog collisions и
0 overlay selector families без markup.

Удаление не превратилось в редизайн: каждое broad promotion заменено только
нужными для исходной геометрии свойствами. Wander сохраняет точный capture
`8897b8c2…`, panel 300×605.703125 и три SVG; Sticky — normal/edit captures,
четыре edit-panel rect и SVG `8850fd2f…`; Pizza — capture `e8e782e1…`, все
1 155 style/geometry records и New→E-ink→New SVG round-trip; Dither — capture
`1908fc0e…`, все 160 element records, Canvas и active Help dialog; Pulsar —
capture `f8b4fa57…`, panels, controls, Verify/Copy и SVG `97155e5a…`.

Два скрытых, неиспользуемых поля native dialog теперь получают canonical shared
reset; активные dialog/overlay paths, domain output и пользовательские состояния
не изменились. Pizza public runtime пересобран в 14 assets и совпадает с source.
Все затронутые boundary suites, feedback/legacy contracts и isolation проходят.

### Оставшиеся узкие app deltas

Это не универсальные reset/promotion bridges, а минимальные документированные
различия приложений поверх общих компонентов.

| Delta | Owner | Причина | Условие удаления |
|---|---|---|---|
| Dither `.bottom-buttons` left anchor | Dither | raster tool держит actions слева, а не по центру | только вместе с принятым редизайном action bar и Canvas/export pixel proof |
| Dither compact range/HSB rhythm и 1/1/2 px segmented metrics | Dither | сохраняют измеренную v1 panel geometry | после явного принятия shared rhythm с 0 changed Canvas pixels и exact panel/control records |
| Dither Arial/legacy canvas-label/button properties | Dither | замороженная raster-safe typography и intrinsic geometry | после отдельного typography/layout canary с byte/geometry evidence |
| Sticky `.controls-panel { max-height:none }` | Sticky Fingers | edit panels исторически выходят за viewport | только при согласованном desktop edit-layout redesign с normal/edit round-trip proof |
| Sticky compact chip/checkbox/segment properties | Sticky Fingers | компенсируют broad local `.control-group` metrics | после миграции этой local control family и exact 79-field/edit-panel proof |
| Sticky manifest preset sizing/scrollbar | Sticky Fingers | фиксирует исходный dropdown viewport и текстовые метрики | после общего preset sizing redesign с three-preset, Sheets и edit-state acceptance |
| Pizza compact range/HSB/choice properties | Pizza Boxer | сохраняют 113-field repository-view geometry | после миграции broad local control metrics и source/public rebuild с exact form/SVG round-trip |
| Pizza repository preset sizing | Pizza Boxer | 400 px menu, ellipsis и font metrics — часть текущего view | после согласованного preset redesign и New/E-ink/New acceptance |
| Wander unbounded panel, Arial action и segmented metrics | Wander Bender | длинная control surface и исходный 1280×720 layout | после отдельного long-panel/navigation redesign с тремя точными режимами |
| Wander disabled Auto/Max range presentation | Wander Bender | disabled inputs намеренно выглядят как интерактивные geometry controls | только вместе с изменением domain interaction и отдельным owner approval |
| Pulsar compact range/HSB/choice и preset metrics | Pulsar Coder | сохраняют плотную v1 coder panel geometry | после отдельного control/preset redesign с 22-field и three-preset SVG evidence |
| Pulsar rich verifier typography | Pulsar Coder | Verify overlay содержит domain-rich CRC report | после отдельной verifier redesign acceptance с exact body semantics and focus lifecycle |

Следующий шаг — UPG-058g cleanup gate; новые compatibility deltas в нём
запрещены без отдельного owner/reason/removal-condition record.

## 12. UPG-058g result

Cleanup gate закрыт без новых production-дельт. Таблица выше покрывает каждый
оставшийся property-level app delta. `check:legacy-css`, `check:toggles`,
`check:presets`, `check:actions` и `check:feedback` запрещают возврат broad
reset/promotion/modal families и фиксируют актуальные частные свойства.

Live smoke на `http://127.0.0.1:8010/upgrade/` загрузил 8/8 entrypoints до
`document.readyState=complete`: каждый имеет видимый SVG или Canvas и локальную
обратную ссылку; native dialogs закрыты. Dither и Pulsar overlays имеют
`aria-hidden=true`, opacity 0 и `pointer-events:none`. Browser error log пуст;
Sticky выдаёт только документированный EAN-13 checksum warning.

Pizza source/schema/preset/vendor/static graph и public runtime совпадают;
release содержит 14 hashed assets. `gate:g4:static` проходит полностью:
framework 42/42, Sparky 196/196, Pizza 167/167, Sticky 5/5, Pulsar 8/8,
Dither 11/11, Wander 10/10 плюс Keyboarder/Wordplayer suites, source manifest,
storage, assets and boundaries. UPG-058 завершён; следующий этап — UPG-059
Gate G5.
