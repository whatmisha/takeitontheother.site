# Lunnen Upgrade

Автономная экспериментальная среда для восьми генераторов Lunnen на одном общем UI framework.

## Статус

Gate G1 пройден: восемь приложений скопированы, запускаются из локального индекса и изолированы по файлам, runtime URL, зависимостям и browser storage. Следующая фаза — перенос общего framework v3 без переключения приложений до готовности conformance suite.

Актуальный порядок и критерии работы находятся в [PLAN.md](./PLAN.md), архитектурные границы — в [ARCHITECTURE.md](./ARCHITECTURE.md), прогресс — в [MIGRATION_STATUS.md](./MIGRATION_STATUS.md).

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
```

Команда проверяет исходный manifest и baseline, локальные зависимости, storage namespaces, filesystem/network boundaries, 195 тестов Sparky, 165 тестов Pizza Boxer и два worker-набора Wordplayer.

Для локального просмотра:

```sh
npm run serve
```

Затем открыть `http://127.0.0.1:8000/`. Browser smoke и mobile visual Sparky описаны в [GATE_G1.md](./GATE_G1.md).
