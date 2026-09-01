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
