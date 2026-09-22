# UIQ — первая итерация: реальные проверки

Дата: 2026-09-21. Основа: `b614ffc795930c1b0322b88c26e27e575608a120` + незакоммиченные изменения UIQ. Общий CSS/UnifiedUi auto-init: `uiq-2`. Проверка в Codex in-app browser через сервер `127.0.0.1:8010`, не по старым JSON-отчётам.

## Область изменений

Только `upgrade/**`: групповые заголовки, scoped цвета нижней панели, группировка импортов Dither, общий file-shortcut metadata, opt-in `ExportFeedbackController`, его Dither-адаптер, Component Lab, UI-аудитор и тесты. Pizza Boxer пересобран штатным `release`; генераторные алгоритмы восьми инструментов не изменялись. В Dither изменена оболочка запуска/завершения PNG-экспорта, не его raster pipeline, размеры или имя файла.

Прежние `.DS_Store` вне upgrade были изменены до работы и не включались в изменения задачи. Нет commit/push, переноса Random Lines или изменений оригиналов.

## Браузер: 1440 × 900, начальное состояние

| Инструмент | Групп отклонений аудитора | Совпадает | Непокрыто/ручная проверка |
| --- | ---: | ---: | ---: |
| Sparky | 0 | 11 | 3 |
| Pizza Boxer | 0 | 11 | 3 |
| Sticky Fingers | 0 | 9 | 5 |
| Keyboarder | 0 | 9 | 5 |
| Wordplayer | 1 | 11 | 2 |
| Dither | 0 | 11 | 3 |
| Wander Bender | 0 | 12 | 2 |
| Pulsar Coder | 0 | 11 | 3 |

Во всех восьми live DOM подтверждён `ui-contract.css?v=uiq-2`. Оставшееся отличие Wordplayer: back navigation `line-height: 16px` вместо `normal`. Оно не скрыто исключением и требует отдельного решения. Эти счётчики не доказывают полную приёмку приложения: проверяются свойства и текущее состояние, описанные в аудите.

## Группы и геометрия

- Wander Shape / Distribution: 12px, 400, normal letter-spacing, padding `12px 20px 0`, margin-bottom 24px. Проверены Radial, Random, Flow Field; восстановлен Radial.
- Wordplayer: Pixels и три группы Forms используют тот же компонент. После проверки восстановлен Dither mode.
- Pixels при 1440 × 900: до и после панель шириной 300px, высотой 766.0546875px; Light y=67 / height=27, Dark y=357 / height=27; toggle row y=652. Изменения геометрии эталона не обнаружены.
- В отдельном окне 1280 × 720 Pixels: 300 × 671 → 300 × 47 collapsed → 300 × 671 после окончания transition. Wander при 1024 × 768: ширина 280px сохраняется, collapsed height 47px.
- В Component Lab реально измерены h3 и div: одинаковые 12px / 400, normal letter-spacing, padding `12px 20px 0`, margin-bottom 24px.

## Dither dock и поведение

При 1440 × 900, 1280 × 800 и 1024 × 768: dock 779 × 36, смещение центра 0px, отступ снизу 20px, кнопок за окном 0. Сохранены два источника, два remove, PNG, alpha и 1×/2×/4×/8×. Источники визуально secondary, каждый remove стоит в группе соответствующего источника. Скриншот standalone Dither просмотрен в браузере.

После старта и готовности изображения `exportFeedback=explicit`, отсутствуют working/success и aria-busy, status пуст. После удаления исходного изображения кнопка disabled, но по-прежнему нет working/success или ложного Done. Исходное изображение восстановлено новой загрузкой страницы.

В Component Lab выполнены реальные клики по тестовой операции: working с `aria-busy=true` → успех; затем искусственная ошибка → error с `aria-busy` снятым; отдельный unavailable не запускает feedback. В working/error кнопка сохраняла размер 123.4609375 × 36px. Файлы в этих браузерных сценариях не создавались. Успех означает создание артефакта и инициирование скачивания, а не подтверждённую запись браузером на диск.

Unit-тесты дополнительно проверяют async rejection, sync throw, duplicate joining, быстрый повтор после завершения, очистку таймера, destroy/late completion и невозможность перезаписать explicit state старым контроллером. Dither download проверен на MIME/сигнатуре/имени, null Blob, исключении callback, удалении временной ссылки и освобождении URL.

## Выполненные команды

Все перечисленные проверки завершились с exit code 0:

```sh
npm --prefix upgrade run test:tier1
npm --prefix upgrade run test:tier2
node upgrade/scripts/check-ui-contract.mjs
node upgrade/scripts/check-component-lab.mjs
node upgrade/scripts/check-capability-manifest.mjs
node upgrade/scripts/check-boundaries.mjs
node upgrade/grid_generator/tools/check-public-runtime.js
npm --prefix upgrade/grid_generator/tools run release
node --check upgrade/dither/dither.js
node --check upgrade/framework/component-lab/feedback-demo.js
node --check upgrade/qa/ui-audit/audit.js
git diff --check
```

Framework: 76 tests; Sparky: 200; Pizza Boxer: 172; Sticky Fingers: 10; Pulsar: 10; Dither: 15; Wander: 12. Wordplayer: boundary/worker проверки и 2 artifact tests; Keyboarder: boundary, SVG encoding/geometry, IO, presets, layout content. Boundary: 452 runtime-файла, 9 entrypoints; выходов и запрещённых ссылок не найдено.

Первые прогоны обнаружили устаревшие числовые ожидания после добавления модуля и ссылки на прежние версии CSS в boundary-тестах; они обновлены под фактическую структуру, сами проверки границ/поведения не отключались. Публичная сборка Pizza обновлена штатной командой, fingerprint соответствует source.

## Не закрыто этой итерацией

- Explicit feedback ещё не подключён к другим семи инструментам и всем форматам. Старые capture-click/disabled эвристики остаются только для немигрировавших действий.
- Не выполнен браузерный экспорт реального PNG на диск; PNG pipeline покрыт текущими unit/artifact тестами, а контроллер — live demo. Не объявлять это полноценным end-to-end download acceptance.
- Нет новой полной мобильной приёмки Sparky, всех hover/focus/disabled-состояний всех кнопок, всех скрытых режимов и file-dialog сценариев. Новый аудит не заявляет обратного.
- Нет нового headless runner, CI screenshot diff или замены исторического `check-final-live-acceptance.mjs`.
- Ошибка MutationObserver при reload iframe-стенда из первичного аудита не локализована; общий статус «0 console errors» не присваивается.
- Оставшееся навигационное отличие Wordplayer и перенос Random Lines — следующие отдельные задачи.
