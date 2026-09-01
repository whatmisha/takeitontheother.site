# Lunnen Upgrade

Автономная экспериментальная среда для восьми генераторов Lunnen на одном общем UI framework.

## Статус

Gate G5 пройден: все восемь инструментов подключены к shared CSS и public JavaScript boundary с сохранением согласованного desktop/domain parity. Пять local universal resets и 21 временный reset-promotion удалены до 0/0. Sparky остаётся protected mobile sentinel; частные codec/SVG/Canvas/algorithm/Paper особенности инструментов не переносились в framework.

Актуальный порядок и критерии работы находятся в [PLAN.md](./PLAN.md), архитектурные границы — в [ARCHITECTURE.md](./ARCHITECTURE.md), прогресс — в [MIGRATION_STATUS.md](./MIGRATION_STATUS.md). Детальный rollout унификации после паритета описан в [G5_UNIFICATION_PLAN.md](./G5_UNIFICATION_PLAN.md).

## Неприкосновенное правило

Все изменения проекта должны находиться внутри этой папки. Исходные проекты в `../lunnen`, framework в `../../othersite-ui-framework` и проект Void используются только для чтения и сравнения.

## Приоритет

1. Sparky — protected application и будущий compatibility-sentinel.
2. Pizza Boxer.
3. Sticky Fingers.
4. Keyboarder.
5. Wordplayer.
6. Dither, Wander Bender и Pulsar Coder — после Gate G3.

Технический порядок подключения к framework отличается от продуктового: Wordplayer и Keyboarder используются как ограниченные canary-приложения перед переключением Sparky.

## Проверка текущего состояния

Из этой папки:

```sh
npm run gate:g1:static
npm run gate:g2:static
npm run gate:g3:static
npm run gate:g4:static
npm run gate:g5:static
```

Команда G3 проверяет исходный manifest и baseline, локальные зависимости, storage namespaces, filesystem/network boundaries, framework/domain suites Wordplayer и Keyboarder, 196 тестов Sparky, 167 тестов Pizza Boxer и 5 тестов Sticky Fingers. G4 дополнительно запускает component contracts, 8 Pulsar, 11 Dither и 10 Wander Bender boundary/domain checks. G5 повторяет полный G4 и машинно закрывает восемь hub/CSS/JS boundaries, отсутствие resets/promotions, ownership app deltas и принятые Sparky desktop/mobile captures.

Для локального просмотра:

```sh
npm run serve
```

Затем открыть `http://127.0.0.1:8000/`. Browser smoke и mobile visual Sparky описаны в [GATE_G1.md](./GATE_G1.md), общий framework — в [GATE_G2.md](./GATE_G2.md), приёмка пяти основных инструментов — в [GATE_G3.md](./GATE_G3.md), завершение миграции всех восьми — в [GATE_G4.md](./GATE_G4.md), итоговая унификация — в [GATE_G5.md](./GATE_G5.md).

Дополнительный живой regression пяти приоритетных инструментов после закрытия
G5 записан в [POST_G5_RELEASE_READINESS.md](./POST_G5_RELEASE_READINESS.md).
