# Lunnen Sparky: план реализации Focus Motion

Статус: реализован, дополнен и упрощён 25 августа 2026 года.

## Итог реализации

- Focus разделён на сохраняемые режимы Manual и Animate; мобильный showcase не изменён.
- Preview работает как transient state, ограничен 30 fps и использует быстрый локальный solver глаз. Фаза не попадает в presets, history и share state.
- Финальный покадровый renderer использует исходное геометрическое ядро и глобальный solver глаз в Dedicated Worker.
- PNG sequence собирается в ZIP при 1080×1080 и 60 fps, всегда имеет прозрачный фон; видимая форма глаз становится knockout только при совпадении Eye и Background color.
- MP4/H.264 использует WebCodecs quality mode, фиксированные timestamps и собственный MP4 muxer с поддержкой reordered AVC samples через CTTS.
- Во время экспорта видны progress и Cancel; экспортные кнопки защищены от повторного запуска.
- Реальные browser-прогоны подтвердили фиксированный MP4 60 fps, прозрачную PNG sequence с цветными глазами, Cancel и продолжающее двигаться preview во время фонового рендера.
- Preview и MP4 export используют одну eye-timeline: моргания и эмоции совпадают по времени и бесшовно повторяются.
- Полный regression suite: 92 теста, 92 passed.

## Продуктовые решения

- Режим Focus делится на `Manual` и `Animate` через framework `segmented-control`.
- При входе в Animate первая точка пути совпадает с текущим ручным положением фокуса.
- Вся траектория вписывается в существующую безопасную область Focus без покадрового clamp; при любой Complexity внешние опорные точки доходят до 94–99,5% её радиуса.
- Путь — замкнутый smooth cubic Bézier spline в характере `reference/motion_paths.svg`.
- `Points` 2–16 и `Complexity` независимы: Points задаёт опорные точки, а непрерывный Complexity 0–100 интерполирует кривизну, смену направления и пересечения между прежними Soft/Medium/Hard-профилями. При двух точках касательные строятся поперёк хорды, формируя полноценную замкнутую петлю.
- Общая длительность петли — 1–10 секунд и включает остановки.
- Один параметр `Stops` одновременно управляет частотой и длительностью остановок: `0` даёт непрерывное движение, `100` — остановки во всех точках с 60% цикла под hold-интервалы.
- Seeded skip остаётся внутренней детерминированной частью `Stops` и не меняет геометрию пути.
- Единственный продуктовый easing — `Ease in–out`; селектор easing удалён.
- Петля детерминирована и вычисляется на полуинтервале `[0, duration)` без дублирования первого кадра в конце.
- В Animate и export отключаются случайное моргание и realtime-инерция глаз.
- При `Stops = 0` Ease in–out применяется один раз ко всей замкнутой кривой; промежуточные anchors проходятся без замедления, обязательное замедление остаётся только на шве.
- Eye animation назначает остановке не более двух морганий. Все моргания всегда используют ручной тайминг 90 + 45 + 140 мс; если пара не помещается в hold-интервал, второе моргание продолжается уже во время движения.
- Video export: MP4/H.264, фиксированные 1080×1080 и 60 fps, без прозрачности.
- PNG sequence: ZIP, фиксированные 1080×1080 и 60 fps, всегда с прозрачным фоном и автоматическим knockout глаз по совпадению цветов.
- Мобильный showcase остаётся без изменений.
- Animated SVG припаркован и не входит в эту реализацию.

## Этап 1. State и UI

Сохраняемые настройки анимации: `focusMode`, `motionDuration`, `motionPointCount`, `motionComplexity`, `motionStops`, `motionBlinkCount`, `motionEmotionVariation`, `motionSeed` и `showMotionPath`. Технические параметры экспорта удалены из пользовательского state.

В панели Focus используются две вкладки. Manual содержит Angle, Distance и одну pill-группу Manual focus / Follow cursor / Center focus. Первые два режима взаимоисключающие; focus marker существует только в Manual focus и всегда исключается из SVG/PNG export. Animate показывает четыре основных параметра пути, eye animation и нижнюю строку управления: основной Play/Pause и компактные иконки Restart/Regenerate. Тогл `Motion path` находится вместе с другими guides в General и виден только в Animate.

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
- внутренний pause budget из `Stops` равномерно делится между активными остановками;
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

`src/animation/eyeTimeline.js` размещает запрошенные моргания внутри активных hold-интервалов или около математической точки остановки, если `Stops` равен нулю. На одну точку назначается не более двух морганий, поэтому фактическое количество ограничено числом доступных остановок × 2.

`Emotion variation` не заменяет исходные Cute/Angry: оба сигнала начинаются с исходного сочетания, отклоняются от него в пределах выбранного процента по Ease in–out и возвращаются к нему на шве. Blink временно закрывает уже анимированное выражение тем же законом lids и с тем же таймингом, который используется ручным морганием.

## Этап 6. PNG sequence

Покадрово отрисовать `duration × fps` кадров, кодировать каждый через `convertToBlob({type: "image/png"})`, именовать `sparky_0001.png` и собирать в ZIP. Worker сообщает progress и поддерживает Cancel.

## Этап 7. MP4/H.264

Использовать `VideoEncoder` в `latencyMode: "quality"`, точные microsecond timestamps и H.264 AVC output. Собрать samples в MP4 muxer, работающий после `VideoEncoder.isConfigSupported()`. Экспорт всегда рисует непрозрачный выбранный background.

## Этап 8. Тестирование и QA

- unit tests генератора, bounds, determinism и seam;
- unit tests timeline, Ease in–out, Stops mapping, pause budget и внутренний skip;
- тесты ZIP и MP4 container structures;
- browser QA Manual/Animate, controls, presets, share, Play/Pause/Restart;
- визуальное сравнение Complexity 0/50/100 с референсом;
- проверка фиксированных 60 fps / 1080 px, прозрачного PNG и автоматического knockout глаз;
- regression всех существующих тестов и mobile showcase.
