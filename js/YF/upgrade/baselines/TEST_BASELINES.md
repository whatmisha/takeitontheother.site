# Test Baselines

Дата проверки: 2026-08-29/30.

## Pizza Boxer — top-level current baseline

Команда из `lunnen/grid_generator/tools`:

```sh
npm test
```

Результат:

- schema validator current;
- manifest соответствует 19 presets;
- local vendor files current;
- static runtime graph содержит 101 browser-resolvable module;
- public runtime соответствует source, 15 hashed assets;
- 165 tests, 165 pass, 0 fail.

## Pizza Boxer — nested v2 donor

Команда из `lunnen/grid_generator/v2/tools`:

```sh
npm test
```

Результат:

- schema 2.0 validators current;
- 19 presets на формате 2.0;
- net golden current;
- static runtime graph содержит 107 modules;
- public runtime соответствует source;
- 222 tests: 221 pass, 1 fail.

Failure находится в `panel-ui.test.mjs`: Node mock не предоставляет `window.requestAnimationFrame`, необходимый `PanelStackScrollController.scheduleUpdate`. До будущего использования v2 необходимо сначала получить чистые 222/222.

## Sparky

Команда из `lunnen/sparky`:

```sh
npm test
```

Результат: 195 tests, 195 pass, 0 fail.

## Wordplayer

Команды из `lunnen/wordplayer`:

```sh
node tests/dither-worker.test.mjs
node tests/forms-worker.test.mjs
```

Оба набора проходят.

## Остальные инструменты

Dither, Keyboarder, Sticky Fingers, Pulsar Coder и основной Wander Bender не имеют единой полной команды regression tests. До миграции для них обязательны browser smoke и ручные functional сценарии из `VISUAL_BASELINES.md` и будущих acceptance-файлов.

