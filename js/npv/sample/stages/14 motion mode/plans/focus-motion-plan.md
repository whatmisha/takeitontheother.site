# Lunnen Sparky: план реализации Focus Motion

Статус: реализован и проверен 24 августа 2026 года.

## Итог реализации

- Focus разделён на сохраняемые режимы Manual и Animate; мобильный showcase не изменён.
- Preview работает как transient state, ограничен 30 fps и использует быстрый локальный solver глаз. Фаза не попадает в presets, history и share state.
- Финальный покадровый renderer использует исходное геометрическое ядро и глобальный solver глаз в Dedicated Worker.
- PNG sequence собирается в ZIP, поддерживает 480/960, 30/60 fps, прозрачный фон и knockout видимой формы глаз.
- MP4/H.264 использует WebCodecs quality mode, фиксированные timestamps и собственный MP4 muxer с поддержкой reordered AVC samples через CTTS.
- Во время экспорта видны progress и Cancel; экспортные кнопки защищены от повторного запуска.
- Реальные browser-прогоны подтвердили MP4, прозрачную PNG sequence, 960×960 / 60 fps, Cancel и продолжающее двигаться preview во время фонового рендера.
- Полный regression suite: 76 тестов, 76 passed.

## Продуктовые решения

- Режим Focus делится на `Manual` и `Animate` через framework `segmented-control`.
- При входе в Animate первая точка пути совпадает с текущим ручным положением фокуса.
- Вся траектория вписывается в существующую безопасную область Focus без покадрового clamp.
- Путь — замкнутый smooth cubic Bézier spline в характере `reference/motion_paths.svg`.
- `Points` и `Complexity` независимы: Points задаёт опорные точки, Complexity — кривизну, смену направления и пересечения.
- Общая длительность петли — 1–10 секунд и включает остановки.
- `Pause` — отдельный параметр; easing действует на движение между точками.
- Seeded skip пропускает только остановку, но не меняет геометрию пути.
- Один глобальный easing используется для всех сегментов первой версии.
- Петля детерминирована и вычисляется на полуинтервале `[0, duration)` без дублирования первого кадра в конце.
- В Animate и export отключаются случайное моргание и realtime-инерция глаз.
- Video export: MP4/H.264, 480×480 или 960×960, 30 fps по умолчанию и опция 60 fps, без прозрачности.
- PNG sequence: ZIP, 480×480 или 960×960, 30/60 fps, с непрозрачным или прозрачным фоном и опциональным knockout глаз.
- Мобильный showcase остаётся без изменений.
- Animated SVG припаркован и не входит в эту реализацию.

## Этап 1. State и UI

Добавить сохраняемые настройки `focusMode`, `motionDuration`, `motionPointCount`, `motionComplexity`, `motionEasing`, `motionPause`, `motionSkipProbability`, `motionSeed`, `showMotionPath`, `motionFps`, `motionResolution`, `motionTransparentBackground` и `motionKnockoutEyes`.

В панели Focus использовать две вкладки. Manual сохраняет Angle, Distance, Center focus и Follow cursor. Animate показывает параметры пути, Play/Pause, Restart, Regenerate и диагностический overlay.

## Этап 2. Генератор пути

Создать чистый модуль `src/animation/focusPath.js`:

- seeded PRNG;
- генерация опорных точек внутри Focus region;
- независимые point count и complexity;
- циклические smooth tangents и cubic Bézier handles;
- сохранение первой точки в текущем focus;
- ограничение control points внутри выпуклой Focus region;
- arc-length lookup для каждого сегмента;
- воспроизводимый SVG path для preview overlay.

Инварианты: одинаковый seed даёт тот же путь, путь замкнут, конечные значения конечны, весь spline находится внутри Focus region, seam сохраняет непрерывную касательную.

## Этап 3. Timeline

Создать `src/animation/focusTimeline.js`:

- полная длительность включает движения и паузы;
- pause budget равномерно делится между активными остановками;
- movement budget делится пропорционально длинам сегментов;
- easing применяется к arc-length progress сегмента;
- skip mask воспроизводима по seed и не меняет path;
- стартовая остановка канонична и не дублируется на конце;
- функция возвращает точное состояние для любого времени.

## Этап 4. Preview и state integration

Хранить текущую animated focus point как transient state. Не записывать каждый кадр в settings/history/presets. `activeRenderSettings()` подставляет transient point только на desktop в Animate. При переключении в Animate сначала фиксируется текущий Follow cursor focus, затем Follow cursor отключается.

Preset/share сохраняют конфигурацию и seed, но не текущую фазу. После восстановления петля начинается с `t = 0`.

## Этап 5. Frame renderer

Добавить DOM-независимый Canvas/OffscreenCanvas renderer, использующий существующие `buildCharacterGeometry()` и `buildEyeGeometry()`. Preview остаётся SVG, export строит ту же геометрию в worker.

Knockout-глаза вычитаются из головы по фактически видимой форме глаза после lids. Для прозрачного background фон не рисуется.

## Этап 6. PNG sequence

Покадрово отрисовать `duration × fps` кадров, кодировать каждый через `convertToBlob({type: "image/png"})`, именовать `sparky_0001.png` и собирать в ZIP. Worker сообщает progress и поддерживает Cancel.

## Этап 7. MP4/H.264

Использовать `VideoEncoder` в `latencyMode: "quality"`, точные microsecond timestamps и H.264 AVC output. Собрать samples в MP4 muxer, работающий после `VideoEncoder.isConfigSupported()`. Экспорт всегда рисует непрозрачный выбранный background.

## Этап 8. Тестирование и QA

- unit tests генератора, bounds, determinism и seam;
- unit tests timeline, easing, pause budget и skip;
- тесты ZIP и MP4 container structures;
- browser QA Manual/Animate, controls, presets, share, Play/Pause/Restart;
- визуальное сравнение Soft/Medium/Hard с референсом;
- проверка 30/60 fps, 480/960, прозрачного PNG и knockout глаз;
- regression всех существующих тестов и mobile showcase.
