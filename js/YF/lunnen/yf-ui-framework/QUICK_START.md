# Quick Start Guide

## Минимальный проект за 5 минут

### 1. Скопируйте фреймворк

```bash
cp -r yf-ui-framework /path/to/your/project/
```

### 2. Используйте пример

Откройте `yf-ui-framework/index.html` — это демонстрация всех компонентов фреймворка с рабочими примерами.

### 3. Структура минимального проекта

```
your-project/
├── yf-ui-framework/        # Копия фреймворка
│   ├── css/
│   │   └── yf-styles.css
│   ├── js/
│   │   ├── utils/
│   │   └── ui/
│   └── fonts/
├── index.html              # Ваш главный файл (скопируйте minimal-template.html)
└── app.js                  # Ваша логика (опционально)
```

### 4. Основной код (index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Tool - YF Tools</title>
    <link rel="stylesheet" href="yf-ui-framework/css/yf-styles.css">
</head>
<body>
    <div class="container">
        <div class="top-links">
            <a href="/js/YF/" class="yf-tools-link">←YF Tools</a>
        </div>

        <div class="main-content">
            <div class="canvas-container" id="canvasContainer">
                <!-- Your content -->
            </div>

            <aside class="controls-panel" id="panel">
                <div class="panel-header" id="panelHeader">
                    <span>Controls</span>
                    <span class="collapse-icon">▼</span>
                </div>
                <div class="panel-content">
                    <!-- Your controls -->
                </div>
            </aside>
        </div>
    </div>

    <script type="module" src="app.js"></script>
</body>
</html>
```

### 5. JavaScript (app.js)

```javascript
import { SliderController } from './yf-ui-framework/js/ui/SliderController.js';
import { PanelManager } from './yf-ui-framework/js/ui/PanelManager.js';

// Settings
const settings = {
    values: {},
    get(key) { return this.values[key]; },
    set(key, value) { this.values[key] = value; }
};

// Initialize controllers
const sliderController = new SliderController(settings);
const panelManager = new PanelManager();

// Your logic here
```

## Часто используемые паттерны

### Добавить слайдер

```html
<div class="control-group">
    <label for="mySlider">
        <span>My Parameter</span>
        <input type="text" class="value-display" id="myValue" value="50">
    </label>
    <input type="range" id="mySlider" min="0" max="100" value="50">
</div>
```

```javascript
sliderController.initSlider('mySlider', {
    valueId: 'myValue',
    setting: 'myParam',
    min: 0,
    max: 100,
    decimals: 1,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: (value) => {
        // Обновите UI
    }
});
```

### Добавить цветовой пикер

```html
<div class="control-group">
    <div class="color-input-group">
        <button class="color-preview" id="colorPreview"></button>
        <input type="text" id="hexColorInput" value="#808080">
    </div>
</div>

<div class="hsb-picker" id="hsbPicker" style="display: none;">
    <!-- HSB sliders (скопируйте из example.html) -->
</div>
```

```javascript
import { ColorPicker } from './yf-ui-framework/js/ui/ColorPicker.js';

const colorPicker = new ColorPicker(settings, {
    onChange: (hex) => {
        // Обновите UI
    }
});
colorPicker.init();
```

### Добавить зум и пан

```javascript
import { ZoomPanManager } from './yf-ui-framework/js/ui/ZoomPanManager.js';

const zoomPanManager = new ZoomPanManager(
    document.getElementById('canvasContainer'),
    document.getElementById('yourSvg')
);
```

## Работа с Cursor AI

При создании нового инструмента используйте этот prompt:

```
Я создаю новый инструмент для YF Tools. У меня есть готовый UI фреймворк 
в папке yf-ui-framework/. Используй существующие компоненты:

- SliderController для всех слайдеров (с поддержкой ↑↓, Shift+↑↓)
- ColorPicker для выбора цветов (HSB с градиентами)
- PanelManager для управления панелями (drag & drop)
- ZoomPanManager для навигации по canvas (zoom, pan)

Дизайн-система:
- Темная тема (#000, #1a1a1a, #fff)
- Радиусы: 12px (панели), 20px (кнопки)
- Шрифт: SF Pro / система
- Все значения привязаны к модульной сетке

Задача: [опишите свою задачу]
```

## Полезные ссылки

- **Полная документация:** `README.md`
- **Примеры всех компонентов:** `index.html`
- **Автономный Color Picker:** `picker/README.md` (для использования в других проектах)

## Чеклист для нового проекта

- [ ] Скопировать yf-ui-framework/
- [ ] Изучить примеры в index.html
- [ ] Настроить SliderController для ваших параметров
- [ ] Добавить логику обновления визуализации
- [ ] Настроить экспорт (SVG/PDF)
- [ ] Протестировать на разных размерах экрана
- [ ] (Опционально) Использовать автономный Color Picker из `picker/` для других проектов

---

**Готово!** Теперь у вас есть полноценный инструмент YF Tools с профессиональным UI.

