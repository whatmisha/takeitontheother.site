# Архитектура Lunnen Upgrade

## 1. Назначение

`upgrade` — отдельная автономная среда, объединяющая восемь инструментов Lunnen одним framework. Она не является inplace-рефакторингом текущих проектов и не должна влиять на них через файлы, URL, browser storage или сборочные команды.

## 2. Источники истины

| Область | Источник истины | Роль альтернатив |
|---|---|---|
| UI framework | Othersite UI Framework v3 | Fork-улучшения Keyboarder и Sparky переносятся после тестирования |
| Sparky | верхний `lunnen/sparky` | Локальный framework — donor универсальных расширений |
| Pizza Boxer | верхний `lunnen/grid_generator` | `grid_generator/v2` — donor, не текущий runtime |
| Sticky Fingers | верхний `lunnen/label_generator` | Старые framework-компоненты заменяются через façade |
| Keyboarder | верхний `lunnen/keyboarder` | Локальный framework — donor export/preset улучшений |
| Wordplayer | верхний `lunnen/wordplayer` | Локальный foundation заменяется общим framework |
| Wander Bender | трёхрежимный верхний инструмент | `pattern/` — donor v3-реализации Random mode |
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

Root workspace оркестрирует приложения, но не заставляет их иметь одинаковый build pipeline. Статические ES-module tools могут импортировать framework напрямую. Pizza Boxer сохраняет Vite build и проверку соответствия source/public runtime.

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

