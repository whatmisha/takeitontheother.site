# YF Tools

Основной набор из 16 инструментов. Экспериментальная версия стала рабочей версией YF Tools 2026-09-23.

**Текущая структура:** инструменты — `YF/<tool>/`, инфраструктура — `YF/infra/`. Команды npm выполняются из `YF`. Папки `lunnen/`, `muted/`, `upgrade/` и все перенаправления удалены по решению пользователя; прежние адреса больше не поддерживаются. Разделы Lunnen и Muted на странице YF Tools сохранены и ведут сразу на новые адреса. [Выпуск и восстановление](YF_PRODUCTION_PROMOTION.md), [предыдущая карта переноса](ROOT_LAYOUT.md). Исторические отчёты ниже содержат прежние пути и ограничения экспериментального этапа.

## Статус

Gate G12 пройден: все восемь инструментов используют единый системный UI-стек,
центрированный ActionDock, shortcut help, collapse/restore и export feedback.
Slider stacks, panel padding и segmented controls имеют общий ритм.
Однострочные сводки не меняют фиксированные габариты свёрнутых панелей. Sparky
остаётся protected mobile sentinel; частные codec/SVG/Canvas/algorithm/Paper
особенности инструментов не переносились в framework. OpenType feature chips
Pizza Boxer и Sticky Fingers имеют единые метрики и явную подпись, сохраняя
частное типографическое поведение.

Актуальный порядок и критерии работы находятся в [PLAN.md](./PLAN.md),
архитектурные границы — в [ARCHITECTURE.md](./ARCHITECTURE.md), прогресс — в
[MIGRATION_STATUS.md](./MIGRATION_STATUS.md). Детальный rollout унификации после
паритета описан в [G5_UNIFICATION_PLAN.md](./G5_UNIFICATION_PLAN.md), а текущий
интерфейсный слой — в [G6_INTERFACE_UNIFICATION_PLAN.md](./G6_INTERFACE_UNIFICATION_PLAN.md).

## Неприкосновенное правило

Рабочая область — корень `YF`. Общий framework находится в `infra/framework`; донорские framework и Void не являются зависимостями. Не запускайте исторические copy/bootstrap-команды для повторного создания старого набора. Генератор перенаправлений удалён; проверки запрещают возвращать `lunnen/`, `muted/`, `upgrade/` и `tools/` в корень. Исторические fixtures и отчёты приёмки сохраняются неизменными.

## Карта документации

- Основные решения: [PLAN.md](./PLAN.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [MIGRATION_STATUS.md](./MIGRATION_STATUS.md), [POST_G5_RELEASE_READINESS.md](./POST_G5_RELEASE_READINESS.md), [POST_G6_RELEASE_READINESS.md](./POST_G6_RELEASE_READINESS.md).
- Приёмочные gates: [G1](./GATE_G1.md), [G2](./GATE_G2.md), [G3](./GATE_G3.md), [G4](./GATE_G4.md), [G5](./GATE_G5.md), [G6](./GATE_G6.md), [G7](./GATE_G7.md), [G8](./GATE_G8.md), [G9](./GATE_G9.md), [G10](./GATE_G10.md), [G11](./GATE_G11.md), [G12](./GATE_G12.md).
- Текущий UI-цикл: [G12 OpenType](./G12_OPENTYPE_FEATURES.md) и [live acceptance](./G12_UI_ACCEPTANCE.md); исходный список различий — [G10 variance audit](./G10_UI_VARIANCE_AUDIT.md).
- Унификация UI: [план G5](./G5_UNIFICATION_PLAN.md), матрицы [controls](./CONTROL_COMPATIBILITY_MATRIX.md), [ranges](./RANGE_COMPATIBILITY_MATRIX.md), [toggles](./TOGGLE_COMPATIBILITY_MATRIX.md), [panels](./PANEL_COMPATIBILITY_MATRIX.md), [preset toolbar](./PRESET_TOOLBAR_COMPATIBILITY_MATRIX.md), [dialogs/feedback](./DIALOG_FEEDBACK_COMPATIBILITY_MATRIX.md), [actions/export](./ACTION_EXPORT_COMPATIBILITY_MATRIX.md) и [legacy CSS](./LEGACY_CSS_CLEANUP_MATRIX.md).
- Политики автономности: [network](./NETWORK_POLICY.md) и [storage](./STORAGE_POLICY.md).

## Приоритет

1. Sparky — protected application и будущий compatibility-sentinel.
2. Pizza Boxer.
3. Sticky Fingers.
4. Keyboarder.
5. Wordplayer.
6. Dither, Wander Bender и Pulsar Coder — после Gate G3.

Технический порядок подключения к framework отличается от продуктового: Wordplayer и Keyboarder используются как ограниченные canary-приложения перед переключением Sparky.

## Проверка текущего состояния

Из корня `YF` (актуальные проверки выпуска перечислены в YF_PRODUCTION_PROMOTION.md; ниже исторические gates):

```sh
npm run gate:g1:static
npm run gate:g2:static
npm run gate:g3:static
npm run gate:g4:static
npm run gate:g5:static
npm run gate:g6:static
npm run gate:g7:static
npm run gate:g8:static
npm run gate:g9:static
npm run gate:g10:static
npm run gate:g11:static
npm run gate:g12:static
```

Команда G3 проверяет исходный manifest и baseline, локальные зависимости, storage namespaces, filesystem/network boundaries, framework/domain suites Wordplayer и Keyboarder, 196 тестов Sparky, 169 тестов Pizza Boxer и 7 тестов Sticky Fingers. G4 дополнительно запускает component contracts, 8 Pulsar, 11 Dither и 10 Wander Bender boundary/domain checks. G5 повторяет полный G4 и машинно закрывает восемь hub/CSS/JS boundaries, отсутствие resets/promotions, ownership app deltas и принятые Sparky desktop/mobile captures. G6 дополнительно проверяет PanelShell, ActionDock, FileIntake, choice/capability contracts, Component Lab и intentional visual diffs.

Для локального просмотра:

```sh
npm run serve
```

Затем открыть `http://127.0.0.1:8000/`. Browser smoke и mobile visual Sparky описаны в [GATE_G1.md](./GATE_G1.md), общий framework — в [GATE_G2.md](./GATE_G2.md), приёмка пяти основных инструментов — в [GATE_G3.md](./GATE_G3.md), завершение миграции всех восьми — в [GATE_G4.md](./GATE_G4.md), базовая унификация — в [GATE_G5.md](./GATE_G5.md), текущая интерфейсная приёмка — в [GATE_G6.md](./GATE_G6.md).

Дополнительный живой regression пяти приоритетных инструментов после закрытия
G5 записан в [POST_G5_RELEASE_READINESS.md](./POST_G5_RELEASE_READINESS.md).
Повторная живая приёмка всех восьми инструментов после G6 записана в
[POST_G6_RELEASE_READINESS.md](./POST_G6_RELEASE_READINESS.md).
Runtime resilience G7 — cold/warm reload, lifecycle cleanup, Blob URL ownership
и два мобильных viewport Sparky — записан в
[RUNTIME_RESILIENCE_ACCEPTANCE.md](./RUNTIME_RESILIENCE_ACCEPTANCE.md).
Финальные workflows и release gate описаны в
[G7_LIVE_ACCEPTANCE.md](./G7_LIVE_ACCEPTANCE.md) и
[GATE_G7.md](./GATE_G7.md).
