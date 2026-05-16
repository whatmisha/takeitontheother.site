# Etica: план реализации Foto и Flor

## 1. Зафиксированные решения

Проект лежит здесь:

```text
/Users/mishaivanov/Library/Mobile Documents/com~apple~CloudDocs/Documents/GitHub/takeitontheother.site/js/etica
```

Цель следующего этапа — дать пользоваться Etica людям, которые не рисуют руками, но хотят получать графику в том же визуальном языке: живые точки, слипшиеся массы, дрожащие контуры, черный отпечаток, много воздуха и контролируемая степень узнаваемости.

Принятые продуктовые решения:

- генераторы создают не плоский PNG, а обычные редактируемые `strokes`;
- генерацию по текстовому промпту не делаем;
- все работает локально в браузере, без отправки фото или данных на сервер;
- в интерфейсе будет три вкладки:
  - `Etica Pinta` — текущая ручная рисовалка;
  - `Foto` — генерация рисунка из загруженной фотографии;
  - `Flor` — генератор растений и цветов;
- узнаваемость должна настраиваться: от почти читаемого изображения до свободной графической массы;
- добавляем независимый цвет кисти в панель `Background`;
- значения по умолчанию:
  - фон: `#BBBBBB`;
  - кисть: `#000000`.

## 2. Главный архитектурный принцип

Генераторы не должны обходить текущий brush engine. Они должны создавать данные в том же формате, что и ручное рисование:

```js
{
  id,
  seed,
  tool: "brush",
  brush: "dotted" | "ink",
  settings: {
    size,
    density,
    densityProfile,
    pressureEnabled,
    color
  },
  sizeScale,
  densityScale,
  points: [{ x, y, pressure, pointerType, time }]
}
```

Так результат остается частью документа:

- его можно выделять;
- двигать;
- менять size/density/profile;
- стирать;
- отменять через undo;
- экспортировать тем же механизмом;
- в будущем анимировать через тот же line-boil подход.

Если генератору нужно поставить одиночную точку, это можно делать как короткий stroke из 1-2 точек. Если нужно создать контур, это обычный stroke из серии точек. Если нужна масса, это несколько коротких strokes или один stroke с высокой плотностью и `ink`.

## 3. Изменение цветовой модели

Сейчас цвет фона и цвет кисти частично зашиты в код:

- `CanvasController` хранит `backgroundColor`;
- `BrushEngine` выбирает цвет brush/eraser внутри `renderStroke`;
- текущая логика рассчитана на светлую кисть на темном фоне.

Нужно сделать цвет кисти явной частью состояния:

- добавить `brushColor` в `CanvasController`;
- значение по умолчанию: `#000000`;
- фон по умолчанию: `#BBBBBB`;
- добавить `setBrushColor(color)`;
- при создании stroke записывать `settings.color = this.brushColor`;
- в `BrushEngine.renderStroke` брать цвет из `stroke.settings.color`;
- eraser должен стирать в прозрачность на stroke layer, как сейчас, а не рисовать цветом фона;
- preview кисти должен использовать текущий цвет кисти с подходящей альфой;
- экспорт с фоном берет `backgroundColor`, прозрачный экспорт берет только stroke layer.

В UI:

- в панели `Background` оставить текущий color control для фона;
- рядом добавить такой же компактный color control для `Brush`;
- текстово не перегружать панель: две строки `Background` и `Brush`, hex input и раскрываемый HSB;
- на мобильном можно оставить только текущий цвет кисти в будущем popover, но для первого этапа достаточно desktop-панели.

Важно: старые strokes без `settings.color` должны рендериться корректно через fallback на `controller.brushColor` или `#000000`.

## 4. Вкладки приложения

Текущая верхняя зона уже визуально похожа на tab bar: `Etica Pinta` и заглушка `Etica Sueño`. Ее нужно превратить в настоящую навигацию:

- `Etica Pinta` показывает текущие панели ручного рисования;
- `Foto` показывает панель фото-генерации;
- `Flor` показывает панель генератора растений;
- canvas остается общим рабочим пространством;
- созданная генератором графика добавляется на canvas как strokes;
- переключение вкладок не очищает рисунок.

Предлагаемая модель:

```js
activeMode: "pinta" | "foto" | "flor"
```

Панели:

- `toolsPanel`, `linePanel`, `backgroundPanel` остаются для `pinta`;
- `backgroundPanel` доступна во всех вкладках, потому что цвет фона/кисти нужен всегда;
- `fotoPanel` появляется в режиме `foto`;
- `florPanel` появляется в режиме `flor`.

Кнопки в генераторах:

- `Preview` — построить временный preview strokes без записи в историю;
- `Apply` — добавить strokes в документ и записать history;
- `Regenerate` — сменить seed и построить заново;
- `Clear Generated` можно отложить, если у generated strokes будет metadata.

## 5. Общая инфраструктура генераторов

Добавить папку:

```text
js/generators/
  StrokeFactory.js
  GeneratorUtils.js
  PhotoGenerator.js
  PlantGenerator.js
```

### StrokeFactory

Отвечает за создание валидных strokes:

- `createStroke(points, options)`;
- `createDot(x, y, options)`;
- `createPolyline(points, options)`;
- `createCluster(points, options)`;
- `markGenerated(stroke, source, groupId)`.

Metadata полезна для будущего управления:

```js
meta: {
  generated: true,
  source: "foto" | "flor",
  groupId,
  seed
}
```

### GeneratorUtils

Общие функции:

- seedable random;
- jitter для точек;
- ресемплинг кривых;
- Catmull-Rom / Bezier helpers;
- нормализация координат под canvas;
- clamp/map/ease;
- генерация pressure;
- расчет bounding box;
- fit/crop в canvas.

### CanvasController API

Добавить методы:

```js
addGeneratedStrokes(strokes, { selectGroup = false } = {})
previewGeneratedStrokes(strokes)
clearGeneratedPreview()
commitGeneratedPreview()
```

Для первого этапа можно упростить:

- `addStrokes(strokes)` с `commitHistory()`;
- preview рисовать отдельным временным массивом `previewStrokes`, не добавляя в `this.strokes`;
- `renderNow` рисует `this.strokes`, затем `previewStrokes` с alpha `0.75`.

## 6. Foto: генерация рисунка из фото

### 6.1. Цель

Фото должно превращаться в графику из точек, контуров и черных масс. Пользователь должен управлять тем, насколько результат похож на исходник:

- высокая узнаваемость: больше контуров, деталей лица/силуэта, плотная карта важности;
- средний режим: сохраняются основные массы и характер;
- абстрактный режим: фото становится источником композиции, пятен и ритма.

### 6.2. Ограничение приватности

Фото обрабатывается только локально:

- через `FileReader`, `createImageBitmap` или `Image`;
- анализ идет через canvas `ImageData`;
- никаких API calls;
- никаких внешних моделей;
- для тяжелых операций позже можно вынести анализ в Web Worker, но все равно локально.

### 6.3. MVP pipeline

1. Пользователь загружает фото.
2. Фото размещается в рабочем анализ-canvas:
   - `fit`;
   - `fill`;
   - ручной crop можно добавить позже.
3. Preprocess:
   - grayscale;
   - blur radius 0-4;
   - contrast;
   - optional invert;
   - normalize luminance.
4. Feature maps:
   - dark mass map: темные области;
   - light mass map: светлые области, если нужен инвертированный режим;
   - edge map через Sobel;
   - local contrast map;
   - optional center-weight или face-priority позже.
5. Importance map:
   - смешать mass, edge и contrast;
   - применить настройку `recognizability`;
   - применить `abstraction`;
   - выкинуть слабые значения threshold'ом.
6. Sampling:
   - точки ставятся вероятностно по importance map;
   - чем выше importance, тем выше шанс и размер;
   - использовать grid/Poisson-like spacing, чтобы не получить цифровой шум;
   - добавлять jitter.
7. Stroke conversion:
   - одиночные точки и микрокластеры -> `dotted` strokes;
   - крупные темные пятна -> `ink` strokes или плотные dot clusters;
   - контуры -> короткие дрожащие polylines.
8. Preview.
9. Apply -> добавить strokes в документ.

### 6.4. Настройки Foto

Минимальный набор для MVP:

- `Image` upload;
- `Fit`: `Fit` / `Fill`;
- `Recognition`: 0-100;
- `Abstraction`: 0-100;
- `Detail`: 0-100;
- `Mass`: 0-100;
- `Contour`: 0-100;
- `Density`: 0-100;
- `Dot Size`: 0-100 или px;
- `Jitter`: 0-100;
- `Seed`;
- `Invert Source` или `Use light areas` можно добавить как advanced.

Как настройки влияют:

- `Recognition` повышает вес контуров, локального контраста и мелких деталей;
- `Abstraction` укрупняет blur, снижает detail, повышает threshold, оставляет крупные массы;
- `Detail` увеличивает количество точек на edge/contrast map;
- `Mass` усиливает темные области и blob-формы;
- `Contour` усиливает Sobel-контуры и короткие strokes;
- `Density` управляет количеством generated strokes;
- `Dot Size` управляет базовым `settings.size`;
- `Jitter` управляет случайным смещением и распадом.

### 6.5. Узнаваемость как контролируемый параметр

Лучше не делать одну ручку `Style`, а дать две главные оси:

- `Recognition`: насколько результат обязан читаться как исходник;
- `Abstraction`: насколько разрешено разрушать исходник в пользу графической массы.

Они не обязаны быть взаимоисключающими. Например:

- `Recognition 90 / Abstraction 10` — почти портрет из точек;
- `Recognition 60 / Abstraction 45` — узнаваемый, но живой;
- `Recognition 25 / Abstraction 80` — композиция по мотивам фото;
- `Recognition 80 / Abstraction 75` — читаемый силуэт с грубыми массами.

### 6.6. Алгоритмы без внешних библиотек

Для первого этапа можно обойтись нативным Canvas:

- grayscale: ручной проход по `ImageData`;
- blur: box blur или separable blur;
- contrast: формула по яркости;
- Sobel: 3x3 convolution;
- threshold: quantile или фиксированный slider;
- connected components: простая flood fill по бинарной карте для крупных масс;
- sampling: grid cells + random acceptance.

OpenCV.js пока не нужен. Его можно рассмотреть позже, если понадобятся:

- более качественные контуры;
- morphological open/close;
- adaptive threshold;
- Canny;
- face/segmentation helpers.

Для MVP лучше не тянуть тяжелую зависимость.

### 6.7. Риски Foto

- Фото с шумным фоном будут давать грязь.
- Лица требуют аккуратного баланса: слишком много деталей выглядит как цифровой halftone, слишком мало — теряется лицо.
- Edge-only результат может выглядеть как фильтр, а не как Etica.
- Массы могут стать слишком буквальными черными пятнами.

Антидоты:

- ограничить количество точек;
- добавить крупный `Abstraction`;
- делать пропуски;
- использовать короткие strokes вместо непрерывных контуров;
- добавлять random deletion;
- preview обязателен перед apply.

## 7. Flor: генератор растений

### 7.1. Цель

Flor должен быть не фильтром, а маленькой процедурной системой, которая рисует растения в языке Etica. Это наиболее контролируемая и авторская часть генератора.

Результат должен выглядеть так, будто человек наметил растение точками и живыми пятнами:

- стебель не идеально гладкий;
- листья чуть разные;
- цветы асимметричны;
- часть формы распадается на точки;
- где-то отпечатки слипаются в черные массы;
- остается много пустого пространства.

### 7.2. MVP типы растений

Для первого этапа достаточно 4 типов:

- `Single Flower` — один цветок на стебле;
- `Branch` — ветка с листьями;
- `Wild Stem` — травянистый стебель с мелкими бутонами;
- `Bouquet` — несколько пересекающихся стеблей.

Позже:

- `Tulip`;
- `Poppy`;
- `Daisy`;
- `Fern`;
- `Vine`;
- `Abstract Botanical`.

### 7.3. Структура растения

Flor генерирует сначала не strokes, а скелет:

```js
{
  stems: [curve],
  leaves: [{ anchor, side, length, width, tilt }],
  flowers: [{ center, radius, petalCount, petalShape }],
  buds: [{ center, size }],
  accents: [points]
}
```

Потом скелет переводится в strokes:

- стебли -> dotted или ink polyline;
- листья -> контурные dotted polylines + редкие внутренние точки;
- цветочные центры -> плотные dot clusters;
- лепестки -> короткие кривые/точки по контуру;
- бутоны -> маленькие ink/dotted blobs;
- случайные осыпавшиеся точки -> отдельные dots.

### 7.4. Настройки Flor

Минимальный набор:

- `Type`: Single Flower / Branch / Wild Stem / Bouquet;
- `Seed`;
- `Scale`;
- `Complexity`;
- `Stem Bend`;
- `Flower Count`;
- `Leaf Count`;
- `Openness`;
- `Recognition`;
- `Abstraction`;
- `Density`;
- `Dot Size`;
- `Jitter`;
- `Mass`;

Как настройки влияют:

- `Complexity` добавляет элементы;
- `Stem Bend` усиливает изгиб кривых;
- `Openness` влияет на расстояние между элементами и количество пустоты;
- `Recognition` делает ботаническую структуру более читаемой;
- `Abstraction` разрушает симметрию, удаляет часть контуров, добавляет свободные точки;
- `Mass` увеличивает слипание в центрах цветов/бутонах;
- `Density` управляет количеством отпечатков;
- `Jitter` делает край живым.

### 7.5. Генерация форм

Стебель:

- строится как cubic Bezier от нижней точки к верхней;
- контрольные точки зависят от `Stem Bend`;
- линия ресемплится в точки;
- часть точек удаляется при высокой `Abstraction`.

Лист:

- anchor на стебле;
- две кривые формируют контур листа;
- центральная прожилка может быть отдельным stroke;
- при высокой абстракции лист превращается в несколько точек и один намек на контур.

Цветок:

- центр: cluster;
- лепестки: petalCount с вариацией угла и размера;
- каждый лепесток — 1-2 кривые или цепочка точек;
- часть лепестков можно пропускать;
- center mass зависит от `Mass`.

Букет:

- несколько стеблей с разными seed offsets;
- композиция ограничивается bounding box;
- элементы не должны равномерно заполнять весь canvas;
- важно сохранять пустые зоны.

## 8. UI план

### 8.1. Top tabs

Заменить текущую вторую кнопку `Etica Sueño` на:

- `Etica Pinta`;
- `Foto`;
- `Flor`.

Каждая кнопка:

- имеет `data-mode`;
- получает `.active`;
- переключает видимость mode panels.

### 8.2. Foto panel

Панель компактная, без объясняющих текстов:

- upload button;
- thumbnail/meta row;
- fit segmented control;
- sliders;
- seed control;
- `Preview`;
- `Apply`;
- `Regenerate`.

### 8.3. Flor panel

Панель:

- type select;
- sliders;
- seed control;
- `Preview`;
- `Apply`;
- `Regenerate`.

### 8.4. Общие UX правила

- Preview не должен ломать историю undo.
- Apply должен быть одной undo-операцией.
- Regenerate меняет seed, но не добавляет strokes, пока пользователь не нажал Apply.
- После Apply generated group можно оставить выделенной позже, но в MVP можно просто добавить strokes.
- Все sliders должны быть достаточно отзывчивыми; тяжелый Foto preview лучше debounce'ить.

## 9. Производительность

Foto может быть тяжелее ручного рисования. Ограничения MVP:

- анализировать изображение в downscaled buffer, например 512-768 px по длинной стороне;
- потом масштабировать координаты точек в canvas;
- ограничить максимальное количество generated strokes/points;
- preview debounce 150-300 ms;
- `Apply` может занять немного дольше, но должен оставаться предсказуемым.

Ориентиры:

- Foto quick preview: до 1 500-3 000 dots;
- Foto high detail: до 6 000-10 000 dots;
- Flor: обычно до 300-1 500 generated marks;
- не создавать десятки тысяч отдельных strokes, если можно сгруппировать точки в короткие strokes.

Если браузер начинает тормозить:

- добавить cap по точкам;
- использовать fewer strokes with more points;
- вынести photo analysis в Web Worker;
- кэшировать feature maps до смены фото/settings.

## 10. Порядок реализации

### Этап 1. Цвет кисти и фон

Цель: подготовить основу для генераторов и зафиксировать новую визуальную норму.

Сделать:

- фон по умолчанию `#BBBBBB`;
- brush color state `#000000`;
- `settings.color` у stroke;
- color picker для кисти в `Background`;
- fallback для старых strokes;
- проверить transparent export.

Критерии готовности:

- новая линия рисуется черным по серому фону;
- можно поменять цвет фона;
- можно поменять цвет кисти;
- старые функции undo/select/export не ломаются.

### Этап 2. Режимы и панели

Сделать:

- top tabs `Etica Pinta`, `Foto`, `Flor`;
- mode state;
- скрытие/показ панелей;
- заглушки Foto/Flor без генерации;
- сохранить текущую ручную рисовалку без регресса.

Критерии:

- переключение вкладок не очищает canvas;
- ручные инструменты работают в `Etica Pinta`;
- `Background` доступна во всех режимах.

### Этап 3. Shared generator infrastructure

Сделать:

- `StrokeFactory`;
- `GeneratorUtils`;
- `CanvasController.addStrokes`;
- `previewGeneratedStrokes`;
- generated metadata;
- seedable behavior.

Критерии:

- можно программно добавить strokes;
- можно показать preview;
- Apply является одной undo-операцией;
- generated strokes рендерятся тем же brush engine.

### Этап 4. Flor MVP

Flor лучше делать первым как более управляемый генератор.

Сделать:

- 4 типа растений;
- основные sliders;
- seed/regenerate;
- preview/apply;
- strokes через `StrokeFactory`.

Критерии:

- каждый seed дает повторяемый результат;
- разные settings заметно меняют композицию;
- результат похож на Etica, а не на SVG-иконку;
- strokes можно редактировать текущими инструментами.

### Этап 5. Foto MVP

Сделать:

- загрузку фото локально;
- preprocess canvas;
- grayscale/contrast/blur;
- Sobel edge map;
- mass map;
- importance map;
- sampling в dots/clusters/short contours;
- settings для recognition/abstraction/detail/mass/contour/density/jitter;
- preview/apply.

Критерии:

- портрет/объект может быть узнаваемым при высоком `Recognition`;
- при высоком `Abstraction` результат становится графической массой;
- фото никуда не отправляется;
- результат создается как strokes;
- preview не зависает на обычных фото.

### Этап 6. Полировка

Сделать:

- пресеты Foto:
  - `Portrait`;
  - `Object`;
  - `Mass`;
  - `Contour`;
  - `Abstract`;
- пресеты Flor:
  - `Sparse`;
  - `Dense`;
  - `Ink Bloom`;
  - `Broken Dots`;
- caps по точкам;
- аккуратное mobile поведение;
- визуальная проверка на нескольких canvas presets.

## 11. Тестирование и ручная проверка

Обязательные проверки:

- ручное рисование после добавления цвета кисти;
- undo/redo после Apply генератора;
- export with background;
- transparent export;
- select/move generated strokes;
- смена density/size у selected generated stroke;
- Foto с портретом;
- Foto с предметом на белом фоне;
- Foto с шумным фоном;
- Flor по всем типам;
- desktop и mobile layout;
- canvas 1:1 и 9:16.

Визуальные критерии:

- нет ощущения цифрового halftone-фильтра;
- точки не образуют слишком регулярную сетку;
- в Flor нет векторной стерильности;
- в Foto есть воздух и пропуски;
- черные массы не забивают весь canvas;
- результат остается в языке приложенных референсов.

## 12. Что не делаем сейчас

- prompt-to-image;
- внешние AI API;
- server-side обработку фото;
- авторизацию, кредиты, лимиты API;
- полноценную галерею;
- анимацию line boil;
- OpenCV.js, пока нативного Canvas достаточно;
- автоматическое распознавание объектов как обязательную часть MVP.

## 13. Рекомендуемый MVP

Минимальный полезный релиз:

1. Цвет кисти и новый дефолт фона.
2. Три вкладки: `Etica Pinta`, `Foto`, `Flor`.
3. Flor с 4 типами растений и preview/apply.
4. Foto с локальным анализом фото и основными настройками узнаваемости.

Такой MVP уже решает исходную задачу: человек без навыка рисования может получить живую графику в стиле Etica, при этом инструмент остается рисовалкой, а не превращается в генератор плоских картинок.
