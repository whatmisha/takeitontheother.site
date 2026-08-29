# Промпт: Добавление режима выравнивания текста по Cap Height

## Задача
Нужно добавить третий режим выравнивания текста по Cap Height шрифта. Сейчас есть два режима: `baseline` и `x-height`. Нужен третий режим `cap-height`.

## Контекст
В проекте есть система выравнивания текстовых блоков относительно baseline сетки. Baseline сетка состоит из прямоугольных элементов высотой = module. Позиция блока указывается через `position.y`, которая соответствует ВЕРХУ элемента baseline сетки.

Метрики шрифта известны:
- `capHeight: 630` (в units per em)
- `xHeight: 447` (в units per em)
- `unitsPerEm: 1000`

## Текущая логика режимов

### Baseline режим (по умолчанию)
- Baseline текста выравнивается по НИЗУ элемента baseline сетки
- Формула: `firstLineY = frontY + position.y + topMargin + baselineElementHeight`
- Все строки привязываются к сетке

### X-Height режим
- Верх строчных букв выравнивается по ВЕРХУ элемента baseline сетки
- Baseline текста должен быть ниже на величину x-height
- Формула: `firstLineY = frontY + position.y + topMargin + actualXHeight`
- Первая строка НЕ привязывается к сетке
- Последующие строки НЕ привязываются к сетке (используют точный интерлиньяж)

## Что нужно сделать

### 1. Добавить radio-кнопку в HTML

Найти секцию с режимами выравнивания (обычно это segmented-control с radio-кнопками для `baseline` и `x-height`) и добавить третью кнопку:

```html
<div class="segmented-control segmented-control-compact" role="radiogroup" aria-label="Alignment mode selection">
    <input type="radio" name="alignmentMode" value="baseline" id="alignmentModeBaseline" checked aria-label="Baseline alignment">
    <label for="alignmentModeBaseline">Baseline</label>
    
    <input type="radio" name="alignmentMode" value="x-height" id="alignmentModeXHeight" aria-label="X-height alignment">
    <label for="alignmentModeXHeight">X-Height</label>
    
    <!-- ДОБАВИТЬ ЭТУ КНОПКУ -->
    <input type="radio" name="alignmentMode" value="cap-height" id="alignmentModeCapHeight" aria-label="Cap height alignment">
    <label for="alignmentModeCapHeight">Cap Height</label>
</div>
```

### 2. Добавить ссылку на DOM элемент в JavaScript

Найти место, где инициализируются ссылки на DOM элементы (обычно в конструкторе или методе инициализации):

```javascript
// Найти строки типа:
alignmentModeBaseline: document.getElementById('alignmentModeBaseline'),
alignmentModeXHeight: document.getElementById('alignmentModeXHeight'),

// Добавить после них:
alignmentModeCapHeight: document.getElementById('alignmentModeCapHeight'),
```

### 3. Добавить обработчик события

Найти место, где добавляются обработчики для режимов выравнивания:

```javascript
// Найти обработчик для x-height:
if (this.dom.alignmentModeXHeight) {
    this.dom.alignmentModeXHeight.addEventListener('change', () => {
        if (this.currentEditingBlock && this.dom.alignmentModeXHeight.checked) {
            this.currentEditingBlock.alignmentMode = 'x-height';
            this.updateGrid();
        }
    });
}

// Добавить после него аналогичный обработчик для cap-height:
if (this.dom.alignmentModeCapHeight) {
    this.dom.alignmentModeCapHeight.addEventListener('change', () => {
        if (this.currentEditingBlock && this.dom.alignmentModeCapHeight.checked) {
            this.currentEditingBlock.alignmentMode = 'cap-height';
            this.updateGrid();
        }
    });
}
```

### 4. Обновить логику установки режима в UI

Найти место, где устанавливается выбранный режим при редактировании блока (обычно в методе, который заполняет форму редактирования):

```javascript
// Найти код типа:
const alignmentMode = block.alignmentMode || 'baseline';
if (this.dom.alignmentModeBaseline && this.dom.alignmentModeXHeight) {
    if (alignmentMode === 'x-height') {
        this.dom.alignmentModeXHeight.checked = true;
        this.dom.alignmentModeBaseline.checked = false;
    } else {
        this.dom.alignmentModeBaseline.checked = true;
        this.dom.alignmentModeXHeight.checked = false;
    }
}

// Заменить на:
const alignmentMode = block.alignmentMode || 'baseline';
if (this.dom.alignmentModeBaseline && this.dom.alignmentModeXHeight && this.dom.alignmentModeCapHeight) {
    if (alignmentMode === 'x-height') {
        this.dom.alignmentModeXHeight.checked = true;
        this.dom.alignmentModeBaseline.checked = false;
        this.dom.alignmentModeCapHeight.checked = false;
    } else if (alignmentMode === 'cap-height') {
        this.dom.alignmentModeCapHeight.checked = true;
        this.dom.alignmentModeBaseline.checked = false;
        this.dom.alignmentModeXHeight.checked = false;
    } else {
        this.dom.alignmentModeBaseline.checked = true;
        this.dom.alignmentModeXHeight.checked = false;
        this.dom.alignmentModeCapHeight.checked = false;
    }
}
```

### 5. Обновить логику расчета позиции первой строки

Найти место, где рассчитывается `firstLineY` для первой строки текста (обычно в методе отрисовки текстового блока):

```javascript
// Найти код типа:
if (alignmentMode === 'x-height') {
    // X-Height режим: верх строчных букв выравнивается по ВЕРХУ элемента baseline
    // baseline текста должен быть ниже на величину x-height
    firstLineY = frontY + position.y + topMargin + actualXHeight;
} else {
    // Baseline режим (по умолчанию): baseline текста выравнивается по НИЗУ элемента baseline
    firstLineY = frontY + position.y + topMargin + baselineElementHeight;
}

// Заменить на:
if (alignmentMode === 'x-height') {
    // X-Height режим: верх строчных букв выравнивается по ВЕРХУ элемента baseline
    // baseline текста должен быть ниже на величину x-height
    firstLineY = frontY + position.y + topMargin + actualXHeight;
} else if (alignmentMode === 'cap-height') {
    // Cap-Height режим: верх заглавных букв выравнивается по ВЕРХУ элемента baseline
    // baseline текста должен быть ниже на величину cap height
    firstLineY = frontY + position.y + topMargin + actualCapHeight;
} else {
    // Baseline режим (по умолчанию): baseline текста выравнивается по НИЗУ элемента baseline
    firstLineY = frontY + position.y + topMargin + baselineElementHeight;
}
```

**Важно:** Убедиться, что переменные `actualCapHeight` и `actualXHeight` уже рассчитаны выше в коде. Обычно это делается так:

```javascript
// Расчет actualCapHeight и actualXHeight на основе useXHeight настройки
const metrics = this.getFontMetricsForStyle(block.styleRef || 'text');
let actualCapHeight, actualXHeight;

if (useXHeight) {
    actualXHeight = module * textSize * scale;
    actualCapHeight = actualXHeight * (metrics.capHeight / metrics.xHeight);
} else {
    actualCapHeight = module * textSize * scale;
    actualXHeight = actualCapHeight * (metrics.xHeight / metrics.capHeight);
}
```

### 6. Обновить функцию snapToBaseline

Найти функцию `snapToBaseline` (или аналогичную), которая привязывает позицию к сетке:

```javascript
// Найти код типа:
if (isFirstLine) {
    // Для x-height режима первая строка НЕ привязывается к baseline - возвращаем как есть
    if (alignmentMode === 'x-height') {
        return y; // Возвращаем исходную позицию без округления
    }
    // Первая строка в baseline режиме - привязываем к целому модулю
    const fullModule = module * scale;
    nearestBaseline = Math.round(relativeY / fullModule) * fullModule;
}

// Заменить на:
if (isFirstLine) {
    // Для x-height и cap-height режимов первая строка НЕ привязывается к baseline
    if (alignmentMode === 'x-height' || alignmentMode === 'cap-height') {
        return y; // Возвращаем исходную позицию без округления
    }
    // Первая строка в baseline режиме - привязываем к целому модулю
    const fullModule = module * scale;
    nearestBaseline = Math.round(relativeY / fullModule) * fullModule;
}
```

### 7. Обновить логику для последующих строк

Найти место, где обрабатываются строки после первой (обычно в цикле отрисовки строк):

```javascript
// Найти код типа:
if (index === 0) {
    const lineApproxY = firstLineY;
    lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, true, alignmentMode);
    previousBaselineY = lineBaselineY;
} else if (alignmentMode === 'x-height') {
    // В режиме x-height все строки после первой НЕ привязываем к сетке
    lineBaselineY = previousBaselineY + lineHeightInMm;
    previousBaselineY = lineBaselineY;
} else {
    // В режиме baseline остальные строки привязываются к сетке
    const lineApproxY = previousBaselineY + lineHeightInMm;
    lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, false);
    previousBaselineY = lineBaselineY;
}

// Заменить на:
if (index === 0) {
    const lineApproxY = firstLineY;
    lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, true, alignmentMode);
    previousBaselineY = lineBaselineY;
} else if (alignmentMode === 'x-height' || alignmentMode === 'cap-height') {
    // В режиме x-height и cap-height все строки после первой НЕ привязываем к сетке
    // Используем точное расстояние согласно интерлиньяжу
    lineBaselineY = previousBaselineY + lineHeightInMm;
    previousBaselineY = lineBaselineY;
} else {
    // В режиме baseline остальные строки привязываются к сетке
    const lineApproxY = previousBaselineY + lineHeightInMm;
    lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, false);
    previousBaselineY = lineBaselineY;
}
```

## Логика работы режима Cap Height

Режим `cap-height` работает аналогично режиму `x-height`, но использует `actualCapHeight` вместо `actualXHeight`:

- **Верх заглавных букв** выравнивается по **ВЕРХУ** элемента baseline сетки
- Baseline текста находится ниже на величину cap height
- Первая строка **НЕ привязывается** к сетке (возвращается точная позиция)
- Последующие строки **НЕ привязываются** к сетке (используется точный интерлиньяж)

## Проверка

После реализации проверить:

1. ✅ Radio-кнопка "Cap Height" появляется в интерфейсе
2. ✅ При выборе режима текст выравнивается правильно
3. ✅ Первая строка не привязывается к сетке
4. ✅ Последующие строки используют точный интерлиньяж
5. ✅ Режим сохраняется и загружается из пресетов
6. ✅ Режим экспортируется в SVG

## Примеры использования в коде

### Сохранение в пресет:
```json
{
  "alignmentMode": "cap-height"
}
```

### Проверка режима:
```javascript
const alignmentMode = block.alignmentMode || 'baseline';
if (alignmentMode === 'cap-height') {
    // Логика для cap-height
}
```

### Условная проверка для нескольких режимов:
```javascript
if (alignmentMode === 'x-height' || alignmentMode === 'cap-height') {
    // Общая логика для режимов без привязки к сетке
}
```

