# 🔄 План поэтапного рефакторинга

## Принципы безопасного рефакторинга

✅ **Работающий код всегда остается рабочим**  
✅ **Тестируем после каждого шага**  
✅ **Делаем бэкап перед каждым изменением**  
✅ **Один модуль за раз**  
✅ **Постепенная замена, а не полная переписывание**

---

## 📊 Текущее состояние

- ✅ Старый код работает (7569 строк)
- ✅ Новые модули созданы в `src/`
- ✅ Документация готова
- ⏳ Нужна постепенная интеграция

---

## 🎯 Итерация 1: Утилиты (1-2 часа)

**Цель:** Заменить дублирующиеся функции на модули утилит

### Шаг 1.1: Интеграция ColorUtils

**Что делать:**
1. Добавить импорт в начало `script.js`:
```javascript
import { ColorUtils } from './src/utils/ColorUtils.js';
```

2. Заменить методы класса на вызовы ColorUtils:
```javascript
// Было:
hexToRgb(hex) { /* 20 строк кода */ }

// Стало:
hexToRgb(hex) {
    return ColorUtils.hexToRgb(hex);
}
```

3. Постепенно заменить все вызовы:
   - `this.hexToRgb()` → `ColorUtils.hexToRgb()`
   - `this.rgbToHsb()` → `ColorUtils.rgbToHsb()`
   - `this.hsbToRgb()` → `ColorUtils.hsbToRgb()`
   - И т.д.

**Тестирование:**
- [ ] Color picker работает
- [ ] Lunnen Blue preset работает
- [ ] Динамическая прозрачность сетки работает

**Бэкап:** `_backup/iteration_01_colorutils/`

---

### Шаг 1.2: Интеграция MathUtils

**Что делать:**
1. Добавить импорт:
```javascript
import { MathUtils } from './src/utils/MathUtils.js';
```

2. Заменить методы:
```javascript
// Было:
mmToPt(mm) { return mm * 2.834645669; }

// Стало:
mmToPt(mm) {
    return MathUtils.mmToPt(mm);
}
```

3. Заменить вызовы:
   - `this.mmToPt()` → `MathUtils.mmToPt()`
   - `this.clamp()` → `MathUtils.clamp()`

**Тестирование:**
- [ ] Размеры в SVG корректны
- [ ] Слайдеры работают с ограничениями

**Бэкап:** `_backup/iteration_01_mathutils/`

---

### Шаг 1.3: Интеграция DOMUtils

**Что делать:**
1. Добавить импорт:
```javascript
import { DOMUtils } from './src/utils/DOMUtils.js';
```

2. Заменить создание SVG элементов:
```javascript
// Было:
const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
rect.setAttribute('x', x);
rect.setAttribute('y', y);
// ... много строк

// Стало:
const rect = DOMUtils.createSVGElement('rect', { x, y, ... });
```

**Тестирование:**
- [ ] Сетка отрисовывается
- [ ] SVG элементы создаются корректно

**Бэкап:** `_backup/iteration_01_domutils/`

---

## 🎯 Итерация 2: Settings (2-3 часа)

**Цель:** Заменить объект настроек на реактивный Settings

### Шаг 2.1: Подготовка

**Что делать:**
1. Добавить импорт:
```javascript
import { Settings } from './src/core/Settings.js';
```

2. В конструкторе создать экземпляр:
```javascript
constructor() {
    // Было:
    this.settings = { frontWidth: 382, ... };
    
    // Стало:
    this.settingsData = new Settings();
    this.settings = this.settingsData.getAll(); // Для обратной совместимости
}
```

**Тестирование:**
- [ ] Приложение запускается
- [ ] Настройки читаются

**Бэкап:** `_backup/iteration_02_settings_init/`

---

### Шаг 2.2: Замена записи настроек

**Что делать:**
Постепенно заменять:
```javascript
// Было:
this.settings.frontWidth = 400;

// Стало:
this.settingsData.set('frontWidth', 400);
this.settings.frontWidth = 400; // Временно для совместимости
```

**Тестирование:**
- [ ] Слайдеры обновляют настройки
- [ ] Настройки сохраняются

**Бэкап:** `_backup/iteration_02_settings_write/`

---

### Шаг 2.3: Использование подписок

**Что делать:**
Добавить подписки на изменения:
```javascript
this.settingsData.subscribe('boxColor', (newColor) => {
    this.updateBackgroundColor();
    this.updateGrid();
});
```

**Тестирование:**
- [ ] Изменения автоматически применяются
- [ ] Подписки работают

**Бэкап:** `_backup/iteration_02_settings_subscriptions/`

---

## 🎯 Итерация 3: GridCalculator (3-4 часа)

**Цель:** Вынести все расчеты сетки в отдельный модуль

### Шаг 3.1: Инициализация

**Что делать:**
1. Добавить импорт:
```javascript
import { GridCalculator } from './src/grid/GridCalculator.js';
```

2. Создать экземпляр:
```javascript
constructor() {
    // ...
    this.gridCalculator = new GridCalculator(this.settingsData);
}
```

**Тестирование:**
- [ ] Калькулятор создается
- [ ] Нет ошибок

**Бэкап:** `_backup/iteration_03_calculator_init/`

---

### Шаг 3.2: Замена методов расчета

**Что делать:**
Заменить методы один за другим:

```javascript
// Было:
calculateRowCount() {
    // 50 строк расчетов
}

// Стало:
calculateRowCount() {
    const rowCount = this.gridCalculator.calculateRowCount();
    this.settings.rowCount = rowCount;
    return rowCount;
}
```

Заменить по очереди:
1. `calculateRowCount()`
2. `calculateRowHeight()`
3. `calculateModule()`
4. `findPerfectRowCombinations()`

**Тестирование после каждого метода:**
- [ ] Расчеты корректны
- [ ] Link mode работает
- [ ] Пресеты генерируются

**Бэкап:** `_backup/iteration_03_calculator_methods/`

---

## 🎯 Итерация 4: GridRenderer (4-5 часов)

**Цель:** Вынести отрисовку сетки в отдельный модуль

### Шаг 4.1: Инициализация

**Что делать:**
```javascript
import { GridRenderer } from './src/grid/GridRenderer.js';

constructor() {
    // ...
    this.gridRenderer = new GridRenderer(this.settingsData, this.gridCalculator);
}
```

**Тестирование:**
- [ ] Рендерер создается

**Бэкап:** `_backup/iteration_04_renderer_init/`

---

### Шаг 4.2: Замена методов отрисовки

**Что делать:**
Заменять методы постепенно:

```javascript
// Было:
drawColumns(container, x, y, width, height, scale) {
    // 100 строк кода
}

// Стало:
drawColumns(container, x, y, width, height, scale) {
    this.gridRenderer.drawColumns(container, x, y, width, height, scale);
}
```

Заменить по очереди:
1. `drawColumns()`
2. `drawRows()`
3. `drawBaseline()`
4. `drawDimensions()`

**Тестирование после каждого:**
- [ ] Колонки отрисовываются
- [ ] Строки отрисовываются
- [ ] Baseline отрисовывается
- [ ] Размеры отрисовываются

**Бэкап:** `_backup/iteration_04_renderer_methods/`

---

### Шаг 4.3: Интеграция главного метода render

**Что делать:**
```javascript
updateGrid() {
    // ...
    // Было: много вызовов отдельных методов
    
    // Стало:
    this.gridRenderer.render(svg);
}
```

**Тестирование:**
- [ ] Вся сетка отрисовывается
- [ ] Боковые панели работают
- [ ] Все опции Show работают

**Бэкап:** `_backup/iteration_04_renderer_complete/`

---

## 🎯 Итерация 5: UI Controllers (5-6 часов)

**Цель:** Унифицировать управление UI

### Шаг 5.1: SliderController

**Что делать:**
1. Импорт:
```javascript
import { SliderController } from './src/ui/SliderController.js';
```

2. Инициализация:
```javascript
constructor() {
    // ...
    this.sliderController = new SliderController(this.settingsData);
}
```

3. Замена инициализации слайдеров:
```javascript
// Было: setupSliders() с кучей addEventListener

// Стало:
setupSliders() {
    this.sliderController.initSlider('frontWidthSlider', {
        valueId: 'frontWidthValue',
        setting: 'frontWidth',
        min: 50,
        max: 1000,
        decimals: 1,
        baseStep: 0.5,
        shiftStep: 10,
        onUpdate: () => this.updateGrid()
    });
    // ... остальные слайдеры
}
```

**Тестирование:**
- [ ] Все слайдеры работают
- [ ] Arrow keys работают
- [ ] Shift+Arrow работает

**Бэкап:** `_backup/iteration_05_sliders/`

---

### Шаг 5.2: ColorPicker

**Что делать:**
```javascript
import { ColorPicker } from './src/ui/ColorPicker.js';

constructor() {
    // ...
    this.colorPicker = new ColorPicker(this.settingsData, {
        onChange: (color) => this.onColorChange(color)
    });
}

init() {
    // ...
    this.colorPicker.init();
}
```

**Тестирование:**
- [ ] HSB picker работает
- [ ] Градиенты обновляются
- [ ] Цвет применяется

**Бэкап:** `_backup/iteration_05_colorpicker/`

---

### Шаг 5.3: PanelManager

**Что делать:**
```javascript
import { PanelManager } from './src/ui/PanelManager.js';

constructor() {
    // ...
    this.panelManager = new PanelManager();
}

init() {
    // ...
    this.panelManager.registerPanel('controlsPanel', {
        headerId: 'panelHeader',
        draggable: true
    });
    // ... остальные панели
}
```

**Тестирование:**
- [ ] Панели перетаскиваются
- [ ] Z-index работает
- [ ] Панели открываются/закрываются

**Бэкап:** `_backup/iteration_05_panels/`

---

## 🎯 Итерация 6: Elements (6-8 часов)

**Цель:** Вынести управление текстом и графикой

### Шаг 6.1: TextBlockManager

**Что делать:**
```javascript
import { TextBlockManager } from './src/elements/TextBlockManager.js';

constructor() {
    // ...
    this.textBlockManager = new TextBlockManager(this.settingsData, this.gridCalculator);
    
    // Миграция данных
    this.textBlocks.forEach(block => {
        this.textBlockManager.createBlock(block);
    });
}
```

**Тестирование:**
- [ ] Текстовые блоки создаются
- [ ] CRUD операции работают
- [ ] Валидация работает

**Бэкап:** `_backup/iteration_06_textmanager/`

---

### Шаг 6.2: TextRenderer

**Что делать:**
```javascript
import { TextRenderer } from './src/elements/TextRenderer.js';

constructor() {
    // ...
    this.textRenderer = new TextRenderer(this.settingsData, this.gridCalculator);
}

// В updateGrid():
renderElements(svg) {
    const textBlocks = this.textBlockManager.getVisibleBlocks();
    this.textRenderer.renderAll(svg, textBlocks);
}
```

**Тестирование:**
- [ ] Текст отрисовывается
- [ ] Переносы работают
- [ ] Стили применяются

**Бэкап:** `_backup/iteration_06_textrenderer/`

---

### Шаг 6.3: GraphicsManager & Renderer

**Что делать:**
Аналогично TextBlockManager и TextRenderer

**Тестирование:**
- [ ] Графика загружается
- [ ] Icons и Claim работают
- [ ] Пользовательские SVG работают

**Бэкап:** `_backup/iteration_06_graphics/`

---

### Шаг 6.4: ElementsNavigator

**Что делать:**
```javascript
import { ElementsNavigator } from './src/elements/ElementsNavigator.js';

constructor() {
    // ...
    this.elementsNavigator = new ElementsNavigator(
        this.textBlockManager,
        this.graphicsManager,
        {
            onSelect: (type, id) => this.onElementSelect(type, id),
            onDelete: (type, id) => this.onElementDelete(type, id),
            onToggleVisibility: (type, id) => this.updateGrid(),
            onUpdate: () => this.updateGrid()
        }
    );
}

init() {
    // ...
    this.elementsNavigator.init('elementsList');
}
```

**Тестирование:**
- [ ] Навигатор отображается
- [ ] Элементы добавляются/удаляются
- [ ] Видимость переключается

**Бэкап:** `_backup/iteration_06_navigator/`

---

## 🎯 Итерация 7: SVG Export (2-3 часа)

**Цель:** Вынести экспорт в отдельный модуль

### Шаг 7.1: SVGExporter

**Что делать:**
```javascript
import { SVGExporter } from './src/svg/SVGExporter.js';

constructor() {
    // ...
    this.svgExporter = new SVGExporter(this.settingsData);
}

exportSVG() {
    const svg = document.getElementById('gridSvg');
    this.svgExporter.exportToFile(svg, 'grid-layout.svg');
}

exportSettings() {
    const data = {
        settings: this.settingsData.getAll(),
        textBlocks: this.textBlockManager.exportData(),
        graphicsBlocks: this.graphicsManager.exportData()
    };
    this.svgExporter.exportSettings(data, 'settings.json');
}
```

**Тестирование:**
- [ ] SVG экспортируется
- [ ] Размеры корректны
- [ ] Настройки экспортируются

**Бэкап:** `_backup/iteration_07_export/`

---

## 🎯 Итерация 8: Финализация (3-4 часа)

**Цель:** Очистка и оптимизация

### Шаг 8.1: Удаление дублирующегося кода

**Что делать:**
1. Удалить старые методы, которые теперь в модулях
2. Оставить только методы координации
3. Проверить что ничего не сломалось

**Тестирование:**
- [ ] Полное тестирование всех функций
- [ ] Проверка производительности

**Бэкап:** `_backup/iteration_08_cleanup/`

---

### Шаг 8.2: Создание главного оркестратора

**Что делать:**
Финальный GridGenerator должен быть ~500-700 строк:

```javascript
class GridGenerator {
    constructor() {
        this.initializeModules();
    }
    
    initializeModules() {
        this.settings = new Settings();
        this.gridCalculator = new GridCalculator(this.settings);
        this.gridRenderer = new GridRenderer(this.settings, this.gridCalculator);
        // ... все модули
    }
    
    async init() {
        this.initializeUI();
        this.initializeEvents();
        await this.initializeBuiltInGraphics();
        this.updateGrid();
    }
    
    // Только методы координации!
}
```

**Тестирование:**
- [ ] Весь функционал работает
- [ ] Код чистый и понятный

**Бэкап:** `_backup/iteration_08_final/`

---

## 📋 Чеклист после каждой итерации

После каждого шага проверяйте:

- [ ] ✅ Приложение запускается без ошибок
- [ ] ✅ Сетка отрисовывается
- [ ] ✅ Слайдеры работают
- [ ] ✅ Чекбоксы работают
- [ ] ✅ Color picker работает
- [ ] ✅ Текстовые блоки работают
- [ ] ✅ Графика работает
- [ ] ✅ Экспорт работает
- [ ] ✅ Нет регрессий

---

## 🔧 Инструменты для каждой итерации

### Перед началом:
```bash
# Создать бэкап
cp -r . _backup/iteration_XX_name/
```

### Во время работы:
```bash
# Запустить сервер
python3 -m http.server 8000

# Открыть в браузере
open http://localhost:8000

# Проверить консоль на ошибки (F12)
```

### После завершения:
```bash
# Коммит изменений
git add .
git commit -m "Iteration XX: название"
```

---

## 📊 Прогресс

| Итерация | Статус | Время | Дата |
|----------|--------|-------|------|
| 1. Утилиты | ⏳ Pending | ~2ч | - |
| 2. Settings | ⏳ Pending | ~3ч | - |
| 3. GridCalculator | ⏳ Pending | ~4ч | - |
| 4. GridRenderer | ⏳ Pending | ~5ч | - |
| 5. UI Controllers | ⏳ Pending | ~6ч | - |
| 6. Elements | ⏳ Pending | ~8ч | - |
| 7. SVG Export | ⏳ Pending | ~3ч | - |
| 8. Финализация | ⏳ Pending | ~4ч | - |
| **ИТОГО** | | **~35ч** | |

---

## 💡 Советы

1. **Не спешите** - лучше медленно но верно
2. **Тестируйте часто** - после каждого маленького изменения
3. **Делайте бэкапы** - перед каждым большим изменением
4. **Коммитьте часто** - чтобы можно было откатиться
5. **Один модуль за раз** - не пытайтесь сделать всё сразу
6. **Документируйте** - записывайте что меняли и почему

---

## 🎯 Конечная цель

После всех итераций:
- ✅ Весь функционал работает
- ✅ Код модульный и понятный
- ✅ ~5000 строк в 20 модулях вместо 7569 в одном
- ✅ Легко тестировать
- ✅ Легко расширять
- ✅ Готов к дальнейшему развитию

---

**Удачи! Начинайте с Итерации 1 когда будете готовы.** 🚀



