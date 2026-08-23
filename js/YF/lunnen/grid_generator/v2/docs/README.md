# Lunnen Grid Generator

Браузерный редактор модульных сеток и развёрток упаковки Lunnen.

Это ветка `v2`, автономная копия проекта: её можно поставить на место корня без
дополнительных шагов. Dev-сервер работает на порту `8100` (preview — `8101`),
чтобы не конфликтовать с корневым проектом на `8000`. Переход к развёрткам с
произвольным числом плоскостей описан в
`docs/progress/NET_REFACTOR_PLAN.md`.

## Быстрый старт

```bash
npm --prefix tools install
npm --prefix tools run dev
```

Откройте `http://127.0.0.1:8100`. Прямое открытие `index.html` не подходит:
приложение использует ES-модули, `fetch` и локальные динамические зависимости.

## Основные команды

```bash
npm --prefix tools test                 # unit/regression + public-runtime checks
npm --prefix tools run public:check     # проверить статическую публичную версию
npm --prefix tools run schema           # пересобрать runtime-валидатор из JSON Schema
npm --prefix tools run presets:check    # проверить manifest пресетов
npm --prefix tools run presets          # пересобрать manifest
npm --prefix tools run build            # production-сборка в build/
npm --prefix tools run release          # обновить закоммиченный public runtime
npm --prefix tools run preview          # проверить production-сборку
```

Браузерный набор находится в `tests/browser-smoke.html` и выполняет 83 проверки
редактора. Подробности о сборке и зависимостях: `tools/README.md`.

## Возможности

- Front-сетка с модулем, полями, колонками, строками и baseline.
- Четыре боковые грани с независимой видимостью, ориентацией и собственной сеткой.
- Текстовые и SVG-объекты с перетаскиванием между гранями.
- Единый порядок слоёв текста и SVG с перетаскиванием в Objects и командами
  Bring Forward / Send Backward.
- Автовосстановление несохранённого черновика через Restore/Discard.
- Поворот, zoom, Fit и экранно-ориентированное панорамирование канваса.
- JSON-пресеты версии 2.0, SVG с точными размерами и PDF.
- Локальное превращение текста в кривые без CDN.
- Undo/redo для семантических действий редактора.

JSON-файлы в `presets/` — источник истины. `presets/manifest.json` генерируется
из них. Импорт принимает форматы 2.0 и 1.2 (последний поднимается миграцией);
более старые legacy-форматы намеренно удалены.

## Архитектура

- `script.js` — минимальная точка входа.
- `src/core/GridGenerator.js` — composition root приложения.
- `src/core` — настройки, startup, DOM cache, UI sync и render scheduling.
- `src/config` — определения числовых контролов.
- `src/grid` — расчёт и SVG-отрисовка основной сетки.
- `src/surfaces` — модель развёртки, раскладка плоскостей, UI и отрисовка.
- `src/elements` — текст, графика, object editor, navigator и drag/resize.
- `src/preset` — схемы 2.0 и 1.2, миграция, импорт, применение и хранение пресетов.
- `src/svg` — SVG/PDF/JSON, санитайзер и файловый экспорт.
- `src/history` — snapshot history и транзакции.
- `src/persistence` — изолированный IndexedDB-черновик и startup recovery.
- `src/ui` — панели, слайдеры и zoom/pan.
- `src/ui/fragments` — части интерфейса, загружаемые с того же origin до startup.
- `styles` — тематические CSS-модули; корневой `style.css` задаёт их порядок.
- `schemas` — единственный контракт формата пресета.
- `vendor` — три компактные закреплённые исходные библиотеки экспорта.
- `runtime` — готовые хэшированные ассеты, которые загружает публичный `index.html`.
- `tools` — удаляемая локальная среда разработки: Vite, `node_modules` и генераторы.

Публичный `index.html` загружает только закоммиченный хэшированный `runtime/`.
Это не позволяет браузеру смешать модули от разных релизов. Исходный module
graph тоже остаётся browser-resolvable и используется Vite-сервером разработки.
jsPDF, svg2pdf.js и opentype.js закреплены в `tools/package-lock.json`,
синхронизируются в `vendor/` и попадают в runtime отдельными ленивыми ассетами.
`npm run public:check` сверяет fingerprint runtime со всеми исходниками. Папка
`tools/node_modules` не публикуется и может быть удалена с диска; она
восстанавливается через `npm --prefix tools install`. Ajv используется только
генератором; браузер получает автономный ESM-валидатор.

GitHub Actions на push и pull request выполняет чистую установку tooling,
полный `npm --prefix tools test` и production build. Workflow ничего не
коммитит и не изменяет в репозитории.

## Совместимость

Автоматически проверяются модульная логика и Chromium-совместимый UI flow,
включая кеш ассетов и метрики рендера/экспорта.
Перед релизом вручную проверить Safari, macOS Quick Look и Illustrator:
см. `docs/guides/RELEASE_CHECKLIST.md`.

Текущий аудит и дальнейший план находятся в `docs/progress/`.
