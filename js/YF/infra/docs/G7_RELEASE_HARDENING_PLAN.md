# G7 — Release hardening

Дата начала: 2026-09-03.

## Цель

G6 принял общий интерфейс и сохранил визуальные/domain-инварианты. G7 проверяет
не только наличие кнопок и обработчиков, но и результаты пользовательских
операций: экспортируемые файлы, import/export round-trip, восстановление
состояния и полный клавиатурный путь.

## Неприкосновенные границы

- изменения разрешены только внутри `upgrade/**`;
- Sparky остаётся первым compatibility-sentinel и единственным обязательным
  mobile consumer;
- renderer, private schema/parser/history и алгоритмы инструментов не переносятся
  во framework;
- G5/G6 visual и output baselines меняются только как явно описанный intentional
  diff с отдельным rollback;
- Google Sheets остаётся единственным разрешённым внешним runtime и запускается
  только явным действием пользователя в Sticky Fingers.

## Этапы

### UPG-071 — Export acceptance inventory

- статус: **Complete** (2026-09-03);
- зафиксировать форматы, primary action, JSON surface, implementation owner и
  существующее тестовое доказательство для всех восьми приложений;
- машинно проверять связь manifest ↔ HTML ↔ implementation ↔ tests;
- явно разделить artifact coverage и boundary-only coverage.

### UPG-072 — Priority export artifacts

- статус: **Complete** (2026-09-03);
- Sparky, Pizza Boxer, Sticky Fingers, Keyboarder и Wordplayer;
- проверить сигнатуру/MIME, непустое содержимое, размеры или viewBox, отсутствие
  UI-only слоёв, стабильное имя и clean second export;
- для PDF проверить `%PDF-` и page box, для SVG — XML/root/viewBox, для PNG —
  PNG signature и ненулевые dimensions;
- private export implementations сохраняются.

### UPG-073 — Secondary export artifacts

- статус: **Complete** (2026-09-04);
- Dither: PNG для 1×/2×/4×/8×, alpha и raster hashes;
- Wander Bender: SVG трёх modes без area boundary;
- Pulsar Coder: export SVG отдельно от известной encoder/verifier CRC проблемы;
- не исправлять codec или renderer внутри export-задачи.

### UPG-074 — Import/export round-trip

- статус: **Complete** (2026-09-05);
- JSON-capable инструменты: Sparky, Pizza Boxer, Sticky Fingers, Keyboarder;
- Pizza Boxer, Sticky Fingers и Keyboarder поддерживают bidirectional round-trip;
- Sparky явно остаётся export-only и не получает искусственную import-функцию;
- export → clean parse/import возвращает согласованные settings;
- malformed/foreign/versioned data даёт локальную ошибку без частичной мутации;
- Wordplayer/Dither file intake проверяется отдельно от JSON settings.

### UPG-075 — Persistence and recovery

- статус: **Complete** (2026-09-05);
- preset/history/draft state переживает reload там, где это продуктовый контракт;
- reset/clean start не читает оригинальные Lunnen namespaces;
- два инструмента не могут повлиять на storage друг друга;
- Pizza IndexedDB и Sparky preset migration имеют отдельные rollback proofs.

### UPG-076 — Keyboard and accessibility walkthrough

- статус: **Complete** (2026-09-05);
- полный tab order для top navigation, panels, presets, controls и ActionDock;
- `⌘/Ctrl+E`, `⌘/Ctrl+J`, `⇧⌘/Ctrl+J`, `J`, Escape и panel collapse;
- focus не теряется при открытии/закрытии dialogs и скрытии JSON actions;
- stateful controls синхронизируют `aria-expanded`, `aria-pressed`, `aria-checked`
  и disabled/busy state.

### UPG-077 — Runtime resilience

- статус: **Complete** (2026-09-05);
- cold/warm reload, повторная инициализация и двойной export/import;
- отсутствие дублированных listeners, Blob URL leaks и зависших busy states;
- локальные assets/workers/fonts загружаются без 404 и внешнего fallback;
- Sparky desktop + 390×844 + 430×932 остаётся обязательным sentinel.

### UPG-078 — Final live acceptance

- статус: **Complete** (2026-09-05);
- все 8 entrypoints, пять priority workflows и три secondary workflows;
- browser errors/404 = 0, intentional warnings перечислены;
- desktop screenshots и Sparky mobile повторно приняты;
- результаты записаны отдельно от G6 baselines.

### UPG-079 — Gate G7

- статус: **Complete** (2026-09-05);
- полный Gate G6 остаётся зелёным;
- export artifact, round-trip, persistence, keyboard и resilience suites зелёные;
- isolation/storage/network policy зелёные;
- все новые gaps либо закрыты, либо явно вынесены из release scope.

## Текущий срез

UPG-071 и UPG-072 завершены. Общий export surface описан в
`EXPORT_ACCEPTANCE.json` и проверяется `npm run check:export-acceptance`.
Artifact-level coverage есть у всех восьми tools. Sticky Fingers получил vector
PDF/SVG contract tests, Wordplayer — SVG/PNG MIME, geometry, signature и filename
tests. Dither проверяет 1×/2×/4×/8× PNG packaging, Wander — очистку area boundary,
а Pulsar — неизменность generated SVG независимо от известной CRC проблемы.
UPG-074 зафиксировал три bidirectional JSON contracts, Sparky export-only и
четыре Wordplayer/Dither asset-intake surfaces. Sticky JSON теперь lossless:
читаемые секции остаются редактируемыми, а private fallback сохраняет поля,
которые они не представляют. UPG-075 зафиксировал семь изолированных persistent
surfaces, reload пользовательских preset libraries, reload/clear Pizza draft и
явно сессионную lifetime истории. Восстановление Pizza draft теперь
транзакционно откатывает документ/history/selection при ошибке, а Sparky preset
migration вынесена в тестируемую app-private функцию с atomic save rollback.
UPG-076 принял 795 live focus stops, 37 collapse controls, шесть preset menus и
восемь ActionDock toolbars. Во всех entrypoints back link идёт первым, stateful
ARIA-атрибуты валидны, duplicate ids/overflow/browser errors отсутствуют.
Скрытые JSON actions теперь доступны напрямую по `⌘/Ctrl+J` и
`⇧⌘/Ctrl+J`; `J` раскрывает их, а Escape скрывает и возвращает фокус к primary
export. Preset menu повторно удерживает фокус после собственного click lifecycle
приложения. UPG-077 принял 24/24 desktop cold/warm загрузки и 6/6 Sparky mobile
загрузок на 390×844/430×932. Повторный init, observer/listener teardown,
FileIntake cancellation и Sparky animation-worker cleanup получили отдельные
proofs; 12 Blob URL owners сбалансированы revoke-путями, runtime errors/404
равны нулю. UPG-078 принял 24 desktop loads, 6 Sparky mobile loads, пять
priority и три secondary workflow. Pizza JSON QA перестал принимать no-op за
успех: исправлен double-deserialize, три реальных импорта стабильны и не пишут
console errors. UPG-079 завершён: `npm run gate:g7:static` прошёл полный Gate G6,
все G7 contracts и focused suites. План G7 выполнен полностью.
