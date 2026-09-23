# Семь новых инструментов одним пакетом

> После этого этапа папки перенесены: приложения — `upgrade/<tool>/`, инфраструктура — `upgrade/infra/`. См. [ROOT_LAYOUT.md](ROOT_LAYOUT.md). Ниже сохранён отчёт пакетного копирования, включая прежние пути.

2026-09-22. По прямому запросу пользователя оставшиеся семь инструментов добавлены сразу. Все изменения агента — внутри upgrade; commit/push агент не выполнял. Контрольная привязка — SOURCE_BASELINE, BATCH7_COPY_MANIFEST и vendor/p5/MANIFEST с SHA-256.

## Результат

В tools/ теперь 16 приложений: восемь ранее принятых и восемь в переносе (Rays плюс этот пакет).

| Новый инструмент | Каталог в upgrade | Проверено в браузере |
| --- | --- | --- |
| Hyperspace | tools/hyperspace/ | Анимация, Center, прокрутка панели; запуск с lng=es после локализации p5 |
| Pattern 01 | tools/pattern_generator/ | Все пять вкладок, Canvas и controls; прокрутка до экспорта |
| Pattern 02 | tools/pattern_generator_02/ | Рисунок, controls, переключение режима двух дуг |
| Random Lines | tools/random_lines_generator/ | Явный Generate/Regenerate с count=30, обычный и градиентный режимы |
| Asterisk Pattern | tools/asterisk_pattern_generator/ | Рисунок и сетка, слой 0→1, переход tessellation→axes |
| Calendar Randomizer | tools/calendar-randomizer/ | Все четыре SVG; Randomize/Reset доступны, шаблоны загружаются |
| Chladni Sound Pattern | tools/chladni-sound-pattern/ | Статический рисунок и снятие Sound-Reactive X/Y без микрофона |

Проверочный каталог: [восемь новых копий](http://localhost:8010/upgrade/qa/migrations/). На карточках есть прямой запуск и UI-аудит. Общая главная по-прежнему даёт ссылки только на принятые инструменты; новые остаются placeholders, а в аудиторе доступны с пометкой «перенос». Это не восемь готовых унифицированных релизов.

## Изоляция и намеренные изменения

- Скопированы 29 файлов из канонических источников. Каталоги backup и альтернативные версии не переносились. Четыре календарных SVG включены полностью.
- localStorage Random Lines: upgrade:random-lines:settings:v1; Calendar: upgrade:calendar-randomizer:controls-collapsed:v1. Чтения старых ключей и fallback на оригинал нет.
- p5 1.4.0, 1.7.0, 1.9.0 и sound из пакета 1.9.0 находятся в framework/vendor/p5. npm-архивы проверены по закреплённому SHA-512; добавлены лицензии и читаемые исходники рядом с minified builds. Версии не обновлялись.
- В unminified p5 1.4.0 обнаружена скрытая CDN-загрузка переводов friendly errors. Локализованы словари той же версии, заменён только URL backend. Обратная замена проверяется по hash официального исходника; изменение явно описано в vendor manifest. В двух minified builds этот backend не инициализируется.
- Убраны Google Fonts и удалённые CoFo. HTML/CSS UI использует согласованный системный стек и веса 400/500. Четыре адресные замены служебного шрифта в Canvas/SVG перечислены в qa/migrations/batch7/ui-text-patches.json: сообщение Random Lines, подписи magnetic UI и сетки Asterisk. Включение сетки Asterisk в экспорт сохранено; её подписи больше не Arial.
- Формулы, RNG, диапазоны, defaults, порядок генерации, canvas dimensions и маршруты экспорта не переписывались. Тест восстанавливает только разрешённые namespace/font-замены и сравнивает hash всего JS с оригиналом. Так же проверены inline scripts Calendar.
- Общий migration-preview.css — небольшой временный слой навигации/типографики, не замена ToolUiController. Только в копиях Hyperspace/Pattern 01 добавлена прокрутка недоступных на высоте 720px controls. Ни один из прежних восьми инструментов этот CSS не подключает.

## Проверки и их границы

- 33/33 batch tests: полный состав, checksums, source identity с указанными исключениями, неизменность HTML-controls/options/defaults, шрифты HTML/CSS, четыре SVG без внешних ресурсов, точные версии p5, literal storage calls.
- Те же 33 теста проходят с Node permission model и чтением только внутри upgrade: запускать из upgrade команду node --permission --allow-fs-read="$PWD" qa/migrations/batch7/isolated-copy.test.mjs. Это проверка независимости тестов от оригиналов, не симуляция полного офлайн-браузера.
- Chladni setup/draw/Stop/Pause проверены в VM с поддельным AudioIn: capture не вызывается до Start. Настоящий микрофон и permission prompt не включались.
- test:catalog — 16/16; test:rays-baseline — 33/33. test:tier1 и test:tier2 прошли для framework и прежних восьми приложений.
- check:isolation / check:boundaries: 16 runtime tools, 20 entrypoints, 502 runtime text files, 7 внутренних dependency symlinks. Vendor проверяется отдельными hashes, поскольку minified bundles не сканируются как приложение.
- migration:sources:check повторно подтвердил неизменность 32 исходных файлов восьми новых источников.
- Браузер: Codex IAB, localhost:8010, штатный viewport 1280×720. Screenshot/DOM smoke всех семи; в журнале проверенных действий нет error/warn. Микрофон и скачивания файлов не запускались. Счётчики SVG paths Calendar после переключений: 68 / 63 / 65 для 02 / 03 / 04.
- UI-аудитор Pattern 02 во встроенном окне 1440×900 завершил измерение: 2 группы отклонений, 3 совпадения, 11 групп требуют проверки. Отличаются legacy-слайдеры/подписи и точный CSS-стек; общие dock/help ещё отсутствуют. На 19 видимых UI-элементах нет запрещённых шрифтов/весов. Предупреждение «Инструмент в переносе» присутствует, console error/warn нет. Это ожидаемый незавершённый UI, не зелёная приёмка.

Это ещё не T.7: нет полной проверки экспорта/round-trip каждого нового инструмента, отказов microphone/file intake, 20 переключений Calendar или stress-режимов. HTML inventory не покрывает отдельно семантику динамически создаваемых controls; она пока защищена identity всего JS, далее нужны предметные fixtures. Сравнение CSS не даёт права менять state на accepted.

## Оставшиеся задачи

1. У всех восьми новых копий ещё исходная компоновка, controls и export/help/keyboard. Подключить общий framework через opt-in ToolUiController по прежнему плану, сохраняя особенности инструментов.
2. Сначала завершить Rays T.3b (Canvas/SVG renderer из проверенной scene); потом T.4–T.7. Копию Rays и существующие 33 теста этот пакет не меняет.
3. Перед извлечением движков семи других приложений дополнить T.1 геометрическими/артефактными fixtures. Их T.2 теперь сделан пакетно; не копировать файлы заново. Порядок дальнейшей интеграции: Random Lines → Pattern 02 / p5 host → Asterisk → Pattern 01 → Calendar → Hyperspace → Chladni.
4. Сохраняются известные исходные дефекты: sf parser Random Lines, маршруты экспортных шоткатов Pattern 01, несовпадение axes-слоёв Asterisk preview/export, повторные listeners и новая рандомизация при экспорте Calendar, ручные режимы/readiness/export Chladni. Список в CONTRACTS не обнулялся.
5. Дополнительное наблюдение: в Chladni ArrowRight на активном X range не изменил значение; keyPressed безусловно возвращает false. Воспроизвести с regression test и исправить в T.4; ручной ввод нельзя считать принятым по факту снятия disabled.
6. Старые незакрытые вопросы сохраняются: MutationObserver error аудитора и Pulsar keyboard inventory (3 ожидаемых панели против 2 текущих). Полный общий gate не объявлен зелёным.

Воспроизводимая проверка фундамента: npm run check:migration-foundation. Скрипты copy-remaining-tools.mjs и vendor-migration-p5.mjs --acquire/--localize уже выполнены; не запускать их заново поверх существующих копий. Обычные tests/check работают локально и не скачивают зависимости.
