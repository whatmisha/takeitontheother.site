# Lunnen Grid Generator

Браузерный редактор модульных сеток и развёрток упаковки Lunnen.

## Быстрый старт

```bash
npm --prefix tools install
npm --prefix tools run dev
```

Откройте `http://127.0.0.1:8000`. Прямое открытие `index.html` не подходит:
приложение использует ES-модули, `fetch` и локальные динамические зависимости.

## Основные команды

```bash
npm --prefix tools test                 # 141 unit/regression checks + schema freshness
npm --prefix tools run schema           # пересобрать runtime-валидатор из JSON Schema
npm --prefix tools run presets:check    # проверить manifest пресетов
npm --prefix tools run presets          # пересобрать manifest
npm --prefix tools run build            # production-сборка в build/
npm --prefix tools run preview          # проверить production-сборку
```

Браузерный набор находится в `tests/browser-smoke.html` и выполняет 70 проверок
редактора. Подробности о сборке и зависимостях: `tools/README.md`.

## Возможности

- Front-сетка с модулем, полями, колонками, строками и baseline.
- Четыре боковые грани с независимой видимостью, ориентацией и собственной сеткой.
- Текстовые и SVG-объекты с перетаскиванием между гранями.
- Поворот, zoom, Fit и экранно-ориентированное панорамирование канваса.
- JSON-пресеты версии 1.2, SVG с точными размерами и PDF.
- Локальное превращение текста в кривые без CDN.
- Undo/redo для семантических действий редактора.

JSON-файлы в `presets/` — источник истины. `presets/manifest.json` генерируется
из них. Импорт принимает только полный формат 1.2; legacy-форматы намеренно
удалены.

## Архитектура

- `script.js` — минимальная точка входа.
- `src/core/GridGenerator.js` — composition root приложения.
- `src/core` — настройки, startup, DOM cache, UI sync и render scheduling.
- `src/config` — определения числовых контролов.
- `src/grid` — расчёт и SVG-отрисовка основной сетки.
- `src/surfaces` — модель, геометрия, UI и отрисовка боковых граней.
- `src/elements` — текст, графика, object editor, navigator и drag/resize.
- `src/preset` — схема 1.2, импорт, применение и хранение пресетов.
- `src/svg` — SVG/PDF/JSON, санитайзер и файловый экспорт.
- `src/history` — snapshot history и транзакции.
- `src/ui` — панели, слайдеры и zoom/pan.
- `src/ui/fragments` — синхронно собираемые части интерфейса.
- `styles` — тематические CSS-модули; корневой `style.css` задаёт их порядок.
- `schemas` — единственный контракт формата пресета.
- `tools` — Vite, локальные зависимости, генераторы manifest и валидатора.

Production-сборка использует хэшированные ассеты. jsPDF, svg2pdf.js и
opentype.js закреплены в `tools/package-lock.json` и грузятся лениво локальными
чанками. Ajv используется только инструментом сборки; браузер получает
автономный сгенерированный ESM-валидатор без runtime-зависимости от Ajv.

## Совместимость

Автоматически проверяются модульная логика и Chromium-совместимый UI flow,
включая кеш ассетов и метрики рендера/экспорта.
Перед релизом вручную проверить Safari, macOS Quick Look и Illustrator:
см. `docs/guides/RELEASE_CHECKLIST.md`.

Текущий аудит и дальнейший план находятся в `docs/progress/`.
