# Архитектура Lunnen Upgrade

## 1. Назначение

`upgrade` — отдельная автономная среда, объединяющая восемь инструментов Lunnen одним framework. Она не является inplace-рефакторингом текущих проектов и не должна влиять на них через файлы, URL, browser storage или сборочные команды.

## 2. Источники истины

| Область | Источник истины | Роль альтернатив |
|---|---|---|
| UI framework | Othersite UI Framework v3 | Fork-улучшения Keyboarder и Sparky переносятся после тестирования |
| Sparky | верхний `lunnen/sparky` | Общий framework подключён; animation/mobile/export orchestration частные |
| Pizza Boxer | верхний `lunnen/grid_generator` | Общие `ColorUtils` и CSS lower layer через adapters; Grid Application/Vite/domain частные; `v2` — donor |
| Sticky Fingers | верхний `lunnen/label_generator` | Общие `ColorUtils`/TT Commons/CSS lower layer через façade; label/data/barcode/export частные |
| Keyboarder | верхний `lunnen/keyboarder` | Общий framework подключён; geometry/legends/import/export wrappers частные |
| Wordplayer | верхний `lunnen/wordplayer` | Общий framework подключён; renderer/workers/export остаются частными |
| Pulsar Coder | верхний `lunnen/pulsar_coder` | Общие panels/sliders/CSS подключены; codec/SVG/private zoom остаются частными |
| Dither | верхний `lunnen/dither` | Общие ColorUtils/panel lifecycle/CSS подключены; Canvas/overlay/algorithms/export остаются частными |
| Wander Bender | верхний `lunnen/wander_bender` | Общие panels/sliders/CSS и local Paper vendor; три режима/Paper geometry/private zoom частные; `pattern/` — donor-only |
| Void | активный root проекта без `wip/` | Donor общих принципов; приложение не копируется |

## 3. Dependency direction

Разрешено:

```text
application -> framework public API
application -> application domain modules
framework -> framework internal modules
framework -> local framework assets/vendor
```

Запрещено:

```text
framework -> application
application A -> application B
upgrade runtime -> ../lunnen
upgrade runtime -> ../../othersite-ui-framework
upgrade runtime -> Void
```

Публичная точка JavaScript API — `framework/src/index.js`. Прямой импорт внутренних framework-модулей допускается только как документированное исключение для lazy/worker-кода.

## 4. Framework ownership

Framework владеет:

- settings store и lifecycle;
- DOM cache;
- SVG/Canvas render targets;
- sliders, ranges, toggles и dice;
- panels, dialogs, tooltips и color picker;
- zoom/pan;
- history infrastructure;
- preset storage/session/share;
- generic export infrastructure;
- UI design tokens и базовые components;
- generic effects, geometry и utilities.

Приложение владеет:

- domain settings schema;
- предметной геометрией и генеративным алгоритмом;
- renderer body;
- app-specific assets и presets;
- app-specific import/export formats;
- app-specific workers;
- app-specific layout overrides.

Framework не содержит проверки имени приложения. Отличия подключаются capabilities, adapters и lifecycle hooks.

## 5. Storage contract

Все новые ключи начинаются с `upgrade:`. Все IndexedDB names начинаются с `upgrade-`.

Приложение не имеет права автоматически читать старый namespace. Миграция данных возможна только отдельной пользовательской командой, которая копирует данные и никогда не удаляет оригинал.

## 6. Network contract

Runtime self-contained. Разрешено:

- same-origin `/upgrade/**`;
- SVG/XML namespace identifiers;
- Google Sheets export endpoints только после действия пользователя в Sticky Fingers.

Шрифты, Paper.js, jsPDF, svg2pdf и OpenType должны быть локальными. GitHub API и directory-listing preset fallback запрещены.

## 7. CSS contract

До Gate G4 DOM IDs и существующие class names сохраняются. Framework CSS загружается раньше app CSS. Layout-specific CSS остаётся в приложениях. Mobile capability включается только для Sparky.

Visual baseline нельзя обновлять в том же изменении, которое модифицирует UI.

## 8. Build contract

Root workspace оркестрирует приложения, но не заставляет их иметь одинаковый build pipeline. Статические ES-module tools могут импортировать framework напрямую. Pizza Boxer сохраняет Vite build и проверку соответствия source/public runtime; его hashed entry внешне импортирует `framework/src/index.js`, не включая копию framework в bundle.

Все `node_modules`, caches, generated runtime и test artifacts располагаются внутри `upgrade/`.

## 9. Protected Sparky contract

После миграции Sparky любое изменение `framework/**` обязано запускать:

- framework unit/conformance tests;
- Wordplayer tests;
- Keyboarder tests;
- все Sparky tests;
- Sparky desktop visual;
- Sparky mobile visual;
- boundary/storage/network checks.

Изменение framework не принимается, если Sparky не прошёл этот gate.

## 10. Architecture decisions

- ADR-001: parity before unification — accepted.
- ADR-002: v3 is the framework base — accepted.
- ADR-003: Pizza Boxer top-level is current baseline — accepted.
- ADR-004: Grid v2 is donor-only until post-parity — accepted.
- ADR-005: Wander retains three modes — accepted.
- ADR-006: mobile compatibility is required only for Sparky — accepted.
- ADR-007: external runtime is forbidden except user-initiated Google Sheets — accepted.
- ADR-008: storage starts empty in new namespaces — accepted.
- ADR-009: applications live directly under `/upgrade/<name>/` — accepted.
- ADR-010: shared CSS is the exact v3/Void base with local font URLs only — accepted.
- ADR-011: applications consume `framework/src/index.js`; internal imports require a migration note — accepted.
- ADR-012: Void contributes generic behavior, never runtime files or domain code — accepted.
- ADR-013: Pizza Boxer keeps its Grid Application and exposes shared behavior through a thin runtime adapter — accepted.
- ADR-014: Sticky Fingers keeps its legacy GridGenerator and moves shared behavior only through small façades — accepted.
- ADR-015: Google Sheets is the sole user-initiated external runtime exception — accepted.
- ADR-016: Pulsar keeps its legacy codec/SVG/zoom; shared CSS is placed in a lower cascade layer until post-parity skin unification — accepted.
- ADR-017: Dither keeps its Canvas/overlay/algorithm monolith and preserves paint-neutral panel clicks plus unbounded desktop drag through a thin shared `PanelManager` subclass — accepted.
- ADR-018: Wander keeps all three modes, Paper geometry and legacy zoom private; shared panels/sliders are exposed through one façade, while `pattern/` remains outside the active runtime — accepted.
- ADR-019: Pizza and Sticky join the shared CSS cascade through per-application lower-layer entrypoints before any intentional visual unification; narrow parity bridges must be explicit and tested — accepted.
- ADR-020: top navigation is a static HTML/accessibility/shared-CSS contract rather than a JavaScript component; Wordplayer may keep mode navigation as an explicit extension — accepted.
