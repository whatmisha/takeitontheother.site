# Все инструменты в tools/; Rays T.3a

Последующее обновление: остальные семь тоже добавлены; теперь в tools/ 16 приложений. Текущий статус и проверки — [BATCH7_ISOLATED_TOOLS.md](BATCH7_ISOLATED_TOOLS.md). Ниже сохранён отчёт о предыдущем шаге перемещения девяти папок.

2026-09-22. Пользователь попросил хранить все инструменты в одной отдельной папке и продолжить интеграцию. Изменения ограничены upgrade. Commit/push этой задачей не выполнялись.

## Структура

```text
upgrade/
  index.html
  tools/
    sparky/
    grid_generator/          Pizza Boxer
    label_generator/         Sticky Fingers
    keyboarder/
    wordplayer/
    dither/
    wander_bender/
    pulsar_coder/
    rays_pattern_generator/  migrating, общий UI ещё не подключён
  framework/                 один общий runtime
  catalog/
  qa/
  scripts/
  docs/
```

Семь остальных новых инструментов пока не скопированы. Их будущие адреса в TOOL_CATALOG уже имеют вид `tools/<id>/index.html`. Lunnen/Muted остаются разделами каталога, не отдельными копиями framework. Главная — прежняя `/upgrade/`, ссылки на принятые инструменты теперь `/upgrade/tools/<id>/`. Старых корневых папок, дубликатов и symlink-алиасов нет; старые прямые URL следует заменить новыми.

Источник Rays до первого переноса: `YF/lunnen/rays_pattern_generator/01/`. Оригинальные `YF/lunnen` и `YF/muted` не перемещались и не редактировались. Теперь все разработки upgrade выполняются в `upgrade/tools/`, не в этих источниках.

## Что обновлено при переносе

- Девять каталогов вместе с assets, presets, тестами и локальными build dependencies перемещены целиком. Чтение Git tree до переноса и проверка нового расположения: 737 tracked-файлов побайтно прежние, 45 получили изменения путей/проверок; пропавших файлов нет. 16 tracked-файлов старого публичного runtime Pizza проверялись отдельно как пересобираемый пакет.
- Относительные imports/CSS/fonts/vendor и обратная навигация адаптированы к дополнительному уровню. App-private FrameworkAdapter и относительные связи внутри приложений сохранены. Значения CSS/геометрии восьми инструментов не менялись ради переноса.
- Pizza Boxer пересобран штатным `build:pizza`: 14 hashed assets; public runtime проверен по fingerprint. Реестр общих ресурсов обновлён, сами ресурсы не копировались заново (`assets:sync`: 0 copied).
- TOOL_CATALOG, действующий capability manifest, npm scripts, QA-страницы, аудитор и проверки используют новые пути. Boundary checker не пропускает папку tools: сканируется весь runtime девяти приложений, исключается лишь app-owned build tooling.
- Новые layout tests запрещают приложения/алиасы в корне upgrade, незарегистрированные папки внутри tools и старые ссылки в действующих QA-страницах; проверяют возврат всех девяти приложений на главную.
- Исторические SOURCE_MANIFEST, acceptance-отчёты, исходные fixtures Rays и COPY_MANIFEST не пересоздавались. Их старые пути разрешаются в проверках через `scripts/lib/upgrade-paths.mjs`, сохраняя исходную evidence. Изменение действующего APPLICATION_CAPABILITIES касается только адресов.
- `scripts/relocate-tools.mjs` — выполненная одноразовая механическая миграция с read-only preview по умолчанию. **Не запускать повторно** для новых инструментов: их сразу создавать в tools/. Скрипт отказывается перезаписывать существующее назначение.

## Продолжение Rays: T.3a выполнен, T.3 целиком ещё нет

В `tools/rays_pattern_generator/engine/scene.js` добавлена независимая от DOM/storage модель. Она принимает настройки, размеры документа и при необходимости декодированные RGBA pixels, возвращает упорядоченные группы модулей и соединительные линии.

Сохранены legacy-порядок примитивов, центровка/видимость граничных модулей, odd-row polarity, scale, caps, gradient/image sampling, незажатая relativeX у соединений и повтор вертикального луча при чётном count. Цвет preview/SVG и рамка листа не входят в геометрию. Чистая функция не декодирует файлы, не рисует и не сохраняет настройки.

11 новых тестов сравнивают модель с замороженным script/Canvas/SVG: семь golden hashes, все допустимые count, Classic/caps/dividers, RGB/alpha/contrast/invert, приоритет gradient, snapping, отсутствие мутаций. Всего **33/33** теста Rays.

**Рабочая страница пока не использует новый engine.** Она остаётся T.2-копией с прежним интерфейсом и известными исходными ошибками. Эта промежуточная граница позволяет отдельно проверить математику до переподключения renderer. Не удалять legacy identity-test, пока adapter действительно не переведён.

## Проверки

Выполнены на локальном рабочем дереве 2026-09-22, Node v24.11.1, Codex IAB. Это не отчёт о публикации.

- `test:catalog`: 16/16; `test:rays-baseline`: 33/33, также при разрешённом чтении только внутри upgrade (Node permission model).
- `test:tier1` и `test:tier2`: пройдены для всех восьми существующих приложений и framework.
- `test:resilience`, `test:persistence`, `test:keyboard`: пройдены, включая реальные unit/artifact тесты экспорта, IO и cleanup.
- `check:isolation`, `check:boundaries`, `check:ui-contract`, `check:ranges`, `check:toggles`, `check:actions`, `check:feedback`, `check:presets`, `check:choices`, `check:file-intake`, `check:capabilities`, `check:component-lab`, `check:legacy-css`: пройдены. После добавления engine boundary проверяет 473 runtime text files, 12 entrypoints и 7 внутренних dependency symlinks.
- `check:export-acceptance`, `check:round-trip`, `check:persistence`, `check:resilience`, `check:live-acceptance`: исторические inventories/ссылки разрешаются корректно. Их сообщения о старых live-сценариях **не означают новый запуск всех этих сценариев**.
- `migration:sources:check`: все 8 новых источников, 32 файла, 791667 bytes совпадают с baseline.
- Браузер: все 9 страниц загружаются через новый путь. UI-аудитор 1440×900: у восьми существующих 0 групп CSS-отклонений; у Rays ожидаемые 2 группы отклонений старого UI. Остальные состояния по-прежнему требуют ручной приёмки.
- Визуально просмотрен Sparky 1280×720 и мобильный 390×844: персонаж, экспортные кнопки и мобильная оболочка отрисованы. Pizza Boxer 1280×720: дождались загрузки пресета, видны artwork, текст/логотипы, сетка и controls; обратная кнопка привела к обновлённой главной с tools-ссылками.
- В браузерном журнале проверенных загрузок нет error; единственный warn — несовпадение контрольной цифры EAN-13 у демонстрационных данных Sticky Fingers. Файлы в браузере не скачивались; визуальный smoke не заменяет полный export/keyboard/mobile acceptance.

### Незакрытые замечания

`check:keyboard` (исторический inventory, не `test:keyboard`) сообщает `pulsar_coder collapse count changed`: metadata ждёт 3, текущая страница содержит 2. Это уже было в HEAD до перемещения: `mainPanel` и `encodingPanel`. Панели не удалялись этой миграцией. Не менять исторический счётчик ради зелёного результата; новая приёмка Pulsar должна отдельно подтвердить текущий состав и поведение. Поэтому полного зелёного gate здесь не заявляем.

Единичная MutationObserver error из INT-02 в этих проверках не повторилась, но её причина всё ещё не установлена. Известные ошибки Rays, описанные в T.1/T.2, не исправлялись.

## Следующий шаг: T.3b

1. Запустить `test:rays-baseline` и `test:catalog`, проверить текущее рабочее дерево.
2. Добавить простые Canvas/SVG renderer проверенной сцены. Группы имеют локальные уже масштабированные координаты плюс x/y origin; divider — координаты документа. Не умножать scale второй раз.
3. Подключить к `script.js` через ES modules/адаптер, обновить Node harness для настоящего module linking либо отдельного adapter test. Замороженный исходник не редактировать и ожидаемые hashes не подгонять.
4. Удалить дублирующую математику из действующего script лишь после parity Canvas/SVG, включая оба tone modes и крайние scale/count. T.2 identity-assert заменить новой проверкой adapter, остальные frozen tests сохранить.
5. Только затем T.4 (исходные ошибки), T.5/T.6 (общий UI host, FileIntake, commands/feedback) и T.7. До приёмки Rays остаётся migrating без ссылки на главной.

Ссылки: [главная](http://localhost:8010/upgrade/), [Rays](http://localhost:8010/upgrade/tools/rays_pattern_generator/), [UI-аудитор](http://localhost:8010/upgrade/qa/ui-audit/?tool=rays_pattern_generator).
