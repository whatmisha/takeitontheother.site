# Lunnen Grid Generator

Браузерный редактор модульных сеток и развёрток упаковки для Lunnen.

## Быстрый старт

```bash
python3 -m http.server 8000
```

Откройте `http://localhost:8000`. Приложению нужен HTTP-сервер: прямое открытие `index.html` не подходит для ES-модулей и `fetch`.

## Возможности

- Сетка Front с настраиваемыми модулем, полями, колонками, строками и baseline.
- Четыре боковые грани с независимой видимостью, ориентацией и собственной сеткой.
- Текстовые и графические объекты, включая перетаскивание между гранями.
- Поворот, zoom, Fit и панорамирование канваса без влияния на экспорт.
- JSON-пресеты, SVG с точными размерами и PDF; текст можно превращать в кривые.
- Undo/redo для семантических действий редактора.

JSON-файлы в `presets/` — источник истины. `presets/manifest.json` строится из них генератором.

## Команды

```bash
npm test                 # unit/regression suite
npm run presets:check    # manifest соответствует JSON-пресетам
npm run presets          # пересобрать manifest
./UPDATE_PRESETS.sh      # обёртка над тем же Node-генератором
```

Браузерный smoke-набор находится в `tests/browser-smoke.html`.

## Архитектура

- `script.js` — минимальная точка входа.
- `GridGenerator.js` — composition root: создаёт и связывает сервисы и контроллеры.
- `src/core` — settings, startup, DOM cache, UI synchronization, render scheduling.
- `src/config` — конфигурация слайдеров.
- `src/grid` — расчёт и SVG-отрисовка сетки.
- `src/surfaces` — состояние, геометрия, UI и отрисовка граней.
- `src/elements` — текст, графика, object editor, navigator, drag/resize.
- `src/preset` — репозиторий, формат, импорт и применение пресетов.
- `src/svg` — сборка экспортного документа, SVG/PDF/JSON и скачивание файлов.
- `src/history` — snapshot history и транзакции.
- `src/ui` — панели, слайдеры, zoom/pan и команды UI.

Граф модулей намеренно остаётся zero-build ES modules. Текущий план и аудит: `docs/progress/CURRENT_OPTIMIZATION_PLAN.md` и `docs/progress/FULL_CODE_AUDIT_2026-08-11.md`.

## Ограничения

- PDF и превращение текста в кривы сейчас лениво загружают внешние библиотеки и требуют сеть.
- Автотесты покрывают логику и Chromium-совместимый smoke. Приёмка в Safari и открытие экспорта в Illustrator остаются ручными.
