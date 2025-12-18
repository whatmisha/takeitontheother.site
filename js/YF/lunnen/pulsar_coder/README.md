# YF Tools UI Framework

Переиспользуемый UI/UX фреймворк для создания инструментов YF Tools в едином стиле.

## 📦 Что включено

Этот фреймворк содержит все необходимые компоненты для быстрого создания веб-приложений в стиле YF Tools:

### Стили (CSS)
- **yf-styles.css** — Полный набор UI компонентов
  - Панели с перетаскиванием и сворачиванием
  - Слайдеры с кастомным дизайном
  - Кнопки (primary, secondary, toggle chips)
  - Дропдауны и селекты
  - Color picker (HSB)
  - Модальные окна
  - Чекбоксы и переключатели
  - Zoom controls
  - Адаптивный дизайн
  - Темная тема по умолчанию

### JavaScript модули

#### Утилиты (`js/utils/`)
- **ColorUtils.js** — Работа с цветами (HEX ↔ RGB ↔ HSB, контраст, светимость)
- **MathUtils.js** — Математические операции (конвертация единиц, округление, привязка к сетке, debounce, throttle)
- **DOMUtils.js** — Работа с DOM (создание SVG, манипуляция классами, градиенты для слайдеров)

#### UI контроллеры (`js/ui/`)
- **SliderController.js** — Универсальный контроллер слайдеров
  - Синхронизация slider ↔ input
  - Клавиатурное управление (↑↓, Shift+↑↓)
  - Умное округление с учетом шага
  - Валидация значений
- **ColorPicker.js** — HSB color picker с градиентами
- **PanelManager.js** — Управление панелями (drag & drop, z-index, открытие/закрытие)
- **ZoomPanManager.js** — Навигация по canvas (zoom, pan) в стиле Figma

### Шрифты
- TT Commons Classic (Regular, Medium)
- Lunnen Display Variable

### Примеры
- **example.html** — Демонстрация всех компонентов

## 🚀 Быстрый старт

### 1. Скопируйте папку в новый проект

```bash
cp -r yf-ui-framework /path/to/your/new-project/
```

### 2. Подключите стили и шрифты

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Tool Name</title>
    <link rel="stylesheet" href="yf-ui-framework/css/yf-styles.css">
</head>
<body>
    <!-- Ваш контент -->
</body>
</html>
```

### 3. Импортируйте необходимые модули

```javascript
// Утилиты
import { ColorUtils } from './yf-ui-framework/js/utils/ColorUtils.js';
import { MathUtils } from './yf-ui-framework/js/utils/MathUtils.js';
import { DOMUtils } from './yf-ui-framework/js/utils/DOMUtils.js';

// UI контроллеры
import { SliderController } from './yf-ui-framework/js/ui/SliderController.js';
import { ColorPicker } from './yf-ui-framework/js/ui/ColorPicker.js';
import { PanelManager } from './yf-ui-framework/js/ui/PanelManager.js';
import { ZoomPanManager } from './yf-ui-framework/js/ui/ZoomPanManager.js';
```

## 📚 Руководство по использованию

### SliderController

Универсальный контроллер для всех слайдеров с автоматической синхронизацией и валидацией.

```javascript
// Создайте Settings объект (простой геттер/сеттер)
const settings = {
    values: {},
    get(key) { return this.values[key]; },
    set(key, value) { this.values[key] = value; }
};

// Инициализация контроллера
const sliderController = new SliderController(settings);

// Конфигурация слайдера
sliderController.initSlider('mySlider', {
    valueId: 'mySliderValue',     // ID текстового input
    setting: 'myParameter',       // Ключ в settings
    min: 0,
    max: 100,
    decimals: 2,                  // Знаков после запятой
    baseStep: 1,                  // Шаг для стрелок ↑↓
    shiftStep: 10,                // Шаг для Shift+↑↓
    onUpdate: (value) => {
        // Обновление UI/логики
        console.log('New value:', value);
    }
});
```

**Фичи:**
- Автоматическая синхронизация slider ↔ text input
- Клавиатурное управление: ↑↓ (baseStep), Shift+↑↓ (shiftStep)
- Enter — применить, Escape — отменить
- Умное округление с "прилипанием" к шагам
- Программное обновление: `sliderController.setValue('mySlider', 50)`

### ColorPicker

HSB color picker с динамическими градиентами на слайдерах.

```javascript
const colorPicker = new ColorPicker(settings, {
    onChange: (hex) => {
        console.log('New color:', hex);
        // Обновите UI
    }
});

colorPicker.init();

// Программная установка цвета
colorPicker.setColorFromHex('#ff0000');

// Получение текущего цвета
const currentColor = colorPicker.getColor(); // '#ff0000'
```

**HTML разметка:**
```html
<div class="control-group">
    <div class="color-input-group">
        <button type="button" class="color-preview" id="colorPreview"></button>
        <input type="text" id="hexColorInput" value="#808080">
    </div>
</div>

<div class="hsb-picker" id="hsbPicker" style="display: none;">
    <div class="hsb-controls">
        <!-- Hue -->
        <div class="hsb-control-group">
            <label for="hueSlider">
                <span>Hue</span>
                <input type="text" class="value-display hsb-value" id="hueValue" value="0">
            </label>
            <input type="range" id="hueSlider" min="0" max="360" value="0">
        </div>
        <!-- Saturation, Brightness аналогично -->
    </div>
</div>
```

### PanelManager

Управление панелями с drag & drop и z-index.

```javascript
const panelManager = new PanelManager();

// Регистрация панели
panelManager.registerPanel('myPanel', {
    headerId: 'myPanelHeader',    // ID заголовка для drag
    draggable: true,
    initialPosition: { x: 20, y: 20 },
    persistent: false,            // false = закрывается кликом вне
    onOpen: () => console.log('Panel opened'),
    onClose: () => console.log('Panel closed')
});

// Управление панелью
panelManager.open('myPanel');
panelManager.close('myPanel');
panelManager.toggle('myPanel');
panelManager.bringToFront('myPanel');
panelManager.center('myPanel');
```

**HTML разметка:**
```html
<aside class="controls-panel" id="myPanel">
    <div class="panel-header" id="myPanelHeader">
        <span>Panel Title</span>
        <span class="collapse-icon">▼</span>
    </div>
    <div class="panel-content">
        <!-- Содержимое панели -->
    </div>
</aside>
```

### ZoomPanManager

Навигация по canvas в стиле Figma/Illustrator.

```javascript
const zoomPanManager = new ZoomPanManager('canvasContainer', {
    onZoomChange: (zoom) => {
        console.log('Zoom:', zoom);
        updateZoomIndicator(zoom);
    },
    onPan: (x, y) => {
        console.log('Pan:', x, y);
    }
});

zoomPanManager.init();

// Управление zoom
zoomPanManager.setZoom(1.5);      // 150%
zoomPanManager.zoomIn();           // +10%
zoomPanManager.zoomOut();          // -10%
zoomPanManager.resetZoom();        // 100%
zoomPanManager.fitToScreen();      // Fit canvas
```

**Навигация:**
- Scroll/Swipe — Pan
- Cmd/Ctrl + Scroll — Zoom (centered on cursor)
- Space + drag — Pan
- Middle mouse + drag — Pan
- Cmd/Ctrl + 0 — Fit to screen
- Cmd/Ctrl + 1 — Reset to 100%
- Cmd/Ctrl + Plus/Minus — Zoom in/out

## 🎨 CSS Компоненты

### Панели

```html
<aside class="controls-panel" id="panel1">
    <div class="panel-header">
        <span>Panel Title <span class="panel-params">optional subtitle</span></span>
        <span class="collapse-icon">▼</span>
    </div>
    <div class="panel-content">
        <section class="control-section">
            <!-- Контент -->
        </section>
    </div>
</aside>
```

**Классы:**
- `controls-panel` — базовый класс панели
- `controls-panel-left` — панель слева
- `controls-panel-text` — панель снизу слева
- `panel-collapsed` — свернутая панель

### Слайдеры

```html
<div class="control-group">
    <label for="mySlider">
        <span>Parameter Name <span class="unit">mm</span></span>
        <input type="text" class="value-display" id="myValue" value="5.00">
    </label>
    <input type="range" id="mySlider" min="0" max="100" step="1" value="5">
</div>
```

### Кнопки

```html
<!-- Primary -->
<button class="btn-primary">Primary Action</button>

<!-- Secondary -->
<button class="btn-secondary">Secondary Action</button>

<!-- Fixed (для bottom bar) -->
<button class="btn-fixed">Export</button>

<!-- Toggle Chips -->
<div class="toggle-chip-group">
    <label class="toggle-chip">
        <input type="checkbox" id="option1">
        <span>Option 1</span>
    </label>
</div>
```

### Segmented Control

```html
<fieldset>
    <div class="segmented-control">
        <input type="radio" name="mode" value="off" id="modeOff">
        <label for="modeOff">Off</label>
        
        <input type="radio" name="mode" value="on" id="modeOn" checked>
        <label for="modeOn">On</label>
    </div>
</fieldset>
```

### Дропдауны

```html
<select class="style-select">
    <option value="1">Option 1</option>
    <option value="2">Option 2</option>
</select>
```

### Модальные окна

```html
<div class="modal-overlay" id="modalOverlay">
    <div class="modal-content">
        <button class="modal-close" id="modalClose">&times;</button>
        <h2>Modal Title</h2>
        <div class="modal-body">
            <p>Content here...</p>
        </div>
    </div>
</div>
```

**JavaScript:**
```javascript
const modal = document.getElementById('modalOverlay');
modal.classList.add('active');    // Открыть
modal.classList.remove('active'); // Закрыть
```

## 🎯 Ключевые особенности дизайна

### Типографика
- Шрифт интерфейса: SF Pro / Segoe UI / система
- Шрифт контента: TT Commons Classic
- Размеры: 0.85rem (labels), 0.9rem (buttons)

### Цвета (CSS переменные)
```css
--color-bg: #000;
--color-bg-panel: #1a1a1a;
--color-bg-input: #0a0a0a;
--color-text: #fff;
--color-text-secondary: #ccc;
--color-text-muted: #888;
--color-border: #333;
```

### Отступы
```css
--spacing-xs: 2px;
--spacing-sm: 4px;
--spacing-md: 8px;
--spacing-lg: 10px;
--spacing-xl: 12px;
--spacing-2xl: 15px;
--spacing-3xl: 20px;
--spacing-4xl: 30px;
```

### Радиусы
```css
--radius: 12px;
--radius-button: 20px;
--radius-input: 6px;
```

### Анимации
```css
--transition-fast: 0.15s ease;
--transition-normal: 0.2s ease;
--transition-slow: 0.3s ease;
--easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
--easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
```

## 💡 Паттерны и Best Practices

### 1. Привязка текста к сетке по x-height

```javascript
// Используйте MathUtils для привязки к модульной сетке
const xHeightRatio = 0.52; // Для TT Commons Classic
const fontSize = gridModule * modulesCount;
const actualFontSize = fontSize / xHeightRatio;
```

### 2. Округление значений при клавиатурном управлении

SliderController автоматически округляет значения с "прилипанием" к шагам. При использовании Shift+↑↓ значение привязывается к ближайшему shiftStep.

### 3. Динамические градиенты для HSB слайдеров

ColorPicker автоматически обновляет градиенты:
- Saturation: от серого к чистому цвету
- Brightness: от черного к яркому цвету

### 4. Адаптивный дизайн

Панели автоматически адаптируются к размеру экрана (breakpoints: 768px, 1024px).

### 5. Accessibility

- Все интерактивные элементы имеют aria-label
- Клавиатурная навигация (Tab, Enter, Escape, Arrow keys)
- Класс `.sr-only` для screen readers

## 📝 Примеры использования

### Базовый проект

```javascript
// main.js
import { SliderController } from './yf-ui-framework/js/ui/SliderController.js';
import { PanelManager } from './yf-ui-framework/js/ui/PanelManager.js';

class MyTool {
    constructor() {
        this.settings = {
            values: { width: 100, height: 100 },
            get(key) { return this.values[key]; },
            set(key, value) { this.values[key] = value; }
        };
        
        this.sliderController = new SliderController(this.settings);
        this.panelManager = new PanelManager();
        
        this.init();
    }
    
    init() {
        // Инициализация слайдеров
        this.sliderController.initSlider('widthSlider', {
            valueId: 'widthValue',
            setting: 'width',
            min: 50,
            max: 500,
            decimals: 1,
            baseStep: 1,
            shiftStep: 10,
            onUpdate: (value) => this.updateCanvas()
        });
        
        // Инициализация панелей
        this.panelManager.registerPanel('controlsPanel', {
            headerId: 'controlsPanelHeader',
            draggable: true
        });
    }
    
    updateCanvas() {
        // Ваша логика обновления
    }
}

new MyTool();
```

## 🔧 Кастомизация

### Изменение цветовой схемы

Отредактируйте CSS переменные в `:root`:

```css
:root {
    --color-bg: #ffffff;           /* Светлая тема */
    --color-bg-panel: #f5f5f5;
    --color-text: #000000;
    /* ... */
}
```

### Добавление новых компонентов

Следуйте существующей структуре классов и используйте CSS переменные для консистентности.

## 🤝 Интеграция с AI (Claude/Cursor)

При работе с AI используйте следующий prompt:

```
Я создаю новый инструмент для YF Tools. У меня есть готовый UI фреймворк 
в папке yf-ui-framework/. Используй существующие компоненты и паттерны 
из этого фреймворка. Следуй дизайн-системе: темная тема, шрифты TT Commons 
Classic, радиусы 12px для панелей, 20px для кнопок, привязка к модульной 
сетке. Все слайдеры должны использовать SliderController с поддержкой 
клавиатурного управления (↑↓, Shift+↑↓).
```

## 📄 Лицензия

Этот фреймворк создан для внутреннего использования в проектах YF Tools.

---

**Версия:** 1.0.0  
**Последнее обновление:** Декабрь 2025  
**Базовый проект:** Pizza Boxer (Lunnen Grid Generator)

