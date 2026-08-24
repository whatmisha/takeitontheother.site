# Lunnen Sparky: план реализации Focus Motion

Статус: реализован, дополнен и упрощён 25 августа 2026 года.

## Итог реализации

- Focus разделён на сохраняемые режимы Manual и Animate; мобильный showcase не изменён.
- Preview работает как transient state, ограничен 30 fps и использует быстрый локальный solver глаз. Фаза не попадает в presets, history и share state.
- Финальный покадровый renderer использует исходное геометрическое ядро и глобальный solver глаз в Dedicated Worker.
- PNG sequence собирается в ZIP при 480×480 и 60 fps, всегда имеет прозрачный фон; видимая форма глаз становится knockout только при совпадении Eye и Background color.
- MP4/H.264 использует WebCodecs quality mode, фиксированные timestamps и собственный MP4 muxer с поддержкой reordered AVC samples через CTTS.
- Во время экспорта видны progress и Cancel; экспортные кнопки защищены от повторного запуска.
- Реальные browser-прогоны подтвердили фиксированный MP4 60 fps, прозрачную PNG sequence с цветными глазами, Cancel и продолжающее двигаться preview во время фонового рендера.
- Preview и MP4 export используют одну eye-timeline: моргания и эмоции совпадают по времени и бесшовно повторяются.
- Полный regression suite: 85 тестов, 85 passed.

## Продуктовые решения

- Режим Focus делится на `Manual` и `Animate` через framework `segmented-control`.
- При входе в Animate первая точка пути совпадает с текущим ручным положением фокуса.
- Вся траектория вписывается в существующую безопасную область Focus без покадрового clamp.
- Путь — замкнутый smooth cubic Bézier spline в характере `reference/motion_paths.svg`.
- `Points` и `Complexity` независимы: Points задаёт опорные точки, а непрерывный Complexity 0–100 интерполирует кривизну, смену направления и пересечения между прежними Soft/Medium/Hard-профилями.
- Общая длительность петли — 1–10 секунд и включает остановки.
- `Pause` — отдельный параметр; easing действует на движение между точками.
- Seeded skip пропускает только остановку, но не меняет геометрию пути.
- Один глобальный easing используется для всех сегментов первой версии.
- Петля детерминирована и вычисляется на полуинтервале `[0, duration)` без дублирования первого кадра в конце.
- В Animate и export отключаются случайное моргание и realtime-инерция глаз.
- При `Skip stops = 100%` easing применяется один раз ко всей замкнутой кривой; промежуточные anchors проходятся без замедления, обязательная остановка остаётся только на шве.
- Eye animation добавляет детерминированное количество морганий за цикл только во время остановок и степень отклонения от исходной пары Cute/Angry по выбранному easing.
- Video export: MP4/H.264, фиксированные 480×480 и 60 fps, без прозрачности.
- PNG sequence: ZIP, фиксированные 480×480 и 60 fps, всегда с прозрачным фоном и автоматическим knockout глаз по совпадению цветов.
- Мобильный showcase остаётся без изменений.
- Animated SVG припаркован и не входит в эту реализацию.

## Этап 1. State и UI

Сохраняемые настройки анимации: `focusMode`, `motionDuration`, `motionPointCount`, `motionComplexity`, `motionEasing`, `motionPause`, `motionSkipProbability`, `motionBlinkCount`, `motionEmotionVariation`, `motionSeed` и `showMotionPath`. Технические параметры экспорта удалены из пользовательского state.

В панели Focus используются две вкладки. Manual сохраняет Angle, Distance, Center focus и Follow cursor. Animate показывает параметры пути, Play/Pause, Restart, Regenerate и eye animation. Тогл Path находится вместе с другими guides в General и виден только в Animate.

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

## Дополнение: Eye animation timeline

`src/animation/eyeTimeline.js` создаёт точное количество морганий на полный цикл и всегда размещает их внутри активных hold-интервалов или около математической точки остановки, если Pause равен нулю.

`Emotion variation` не заменяет исходные Cute/Angry: оба сигнала начинаются с исходного сочетания, отклоняются от него в пределах выбранного процента по выбранному Focus easing и возвращаются к нему на шве. Blink временно закрывает уже анимированное выражение тем же законом lids, который используется ручным морганием.

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
- проверка фиксированных 60 fps / 480 px, прозрачного PNG и автоматического knockout глаз;
- regression всех существующих тестов и mobile showcase.
