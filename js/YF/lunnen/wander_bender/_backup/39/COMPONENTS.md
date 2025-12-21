# Справочник компонентов YF UI Framework

Быстрая шпаргалка по всем доступным UI компонентам.

## 🎚️ Слайдеры (Range Sliders)

### Базовый слайдер

```html
<div class="control-group">
    <label for="mySlider">
        <span>Parameter Name <span class="unit">mm</span></span>
        <input type="text" class="value-display" id="myValue" value="50.0">
    </label>
    <input type="range" id="mySlider" min="0" max="100" step="1" value="50">
</div>
```

### С переключателями единиц измерения

```html
<div class="control-group">
    <label for="sizeSlider">
        <span>Size 
            <span class="unit-buttons">
                <button class="unit-btn active" data-unit="mod">mod</button>
                <button class="unit-btn" data-unit="mm">mm</button>
            </span>
        </span>
        <input type="text" class="value-display" id="sizeValue" value="2.00">
    </label>
    <input type="range" id="sizeSlider" min="0" max="10" step="0.25" value="2">
</div>
```

### С кнопкой блокировки

```html
<div class="control-group">
    <label for="moduleSlider">
        <span>Module</span>
        <div class="value-display-wrapper">
            <input type="text" class="value-display" id="moduleValue" value="5.05">
            <button class="lock-btn" id="lockModuleBtn">
                <svg class="lock-icon lock-icon-open" width="14" height="14" viewBox="0 0 14 14">
                    <path d="M4 6V4C4 2.34315 5.34315 1 7 1C8.65685 1 10 2.34315 10 4V6M3.5 6H10.5C11.3284 6 12 6.67157 12 7.5V11.5C12 12.3284 11.3284 13 10.5 13H3.5C2.67157 13 2 12.3284 2 11.5V7.5C2 6.67157 2.67157 6 3.5 6Z" stroke="currentColor" stroke-width="1.2"/>
                </svg>
            </button>
        </div>
    </label>
    <input type="range" id="moduleSlider" min="0.5" max="20" step="0.01" value="5.05">
</div>
```

**Особенности:**
- Тонкий трек (1px), круглый thumb (8px)
- Hover: thumb увеличивается до 10px
- Клавиатурное управление: ↑↓ (baseStep), Shift+↑↓ (shiftStep)
- Enter — применить, Escape — отменить

---

## 🎨 Color Picker

### HTML структура

```html
<div class="control-group">
    <div class="control-group-header">
        <span class="control-label">Background Color</span>
        <button class="color-preset" id="presetBtn">Preset</button>
    </div>
    <div class="color-input-group">
        <button class="color-preview" id="colorPreview"></button>
        <input type="text" id="hexColorInput" value="#808080" maxlength="7">
    </div>
</div>

<!-- HSB Picker (выпадающий) -->
<div class="hsb-picker" id="hsbPicker" style="display: none;">
    <div class="hsb-controls">
        <div class="hsb-control-group">
            <label for="hueSlider">
                <span>Hue</span>
                <input type="text" class="value-display hsb-value" id="hueValue" value="0">
            </label>
            <input type="range" id="hueSlider" min="0" max="360" value="0">
        </div>
        <!-- Аналогично для Saturation и Brightness -->
    </div>
</div>
```

### JavaScript

```javascript
import { ColorPicker } from './yf-ui-framework/js/ui/ColorPicker.js';

const colorPicker = new ColorPicker(settings, {
    onChange: (hex) => {
        // Применить цвет
    }
});
colorPicker.init();
```

---

## 🔘 Кнопки

### Primary Button

```html
<button class="btn-primary">Primary Action</button>
```

### Secondary Button

```html
<button class="btn-secondary">Secondary Action</button>
```

### Fixed Button (для bottom bar)

```html
<button class="btn-fixed">Export</button>
```

### Add Object Buttons

```html
<div class="button-group">
    <button class="btn-add-object">Add Text</button>
    <button class="btn-add-object">Add Graphics</button>
</div>
```

---

## 🎛️ Toggle Chips

Переключатели с иконками (Show/Hide опции).

```html
<div class="toggle-chip-group">
    <label class="toggle-chip">
        <input type="checkbox" id="showColumns" checked>
        <span>
            <span class="toggle-chip-icon-wrapper">
                <svg class="toggle-chip-icon toggle-chip-icon-open" width="14" height="14">
                    <!-- Eye icon -->
                </svg>
                <svg class="toggle-chip-icon toggle-chip-icon-crossed" width="14" height="14">
                    <!-- Eye crossed icon -->
                </svg>
            </span>
            Columns
        </span>
    </label>
</div>
```

**Поведение:**
- Неактивные: перечеркнутая иконка, hover — неперечеркнутая
- Активные: неперечеркнутая иконка, hover — перечеркнутая

---

## 📻 Segmented Control

Радио-кнопки с современным дизайном.

```html
<fieldset>
    <legend class="sr-only">Mode selection</legend>
    <div class="segmented-control">
        <input type="radio" name="mode" value="off" id="modeOff">
        <label for="modeOff">Off</label>
        
        <input type="radio" name="mode" value="auto" id="modeAuto" checked>
        <label for="modeAuto">Auto</label>
        
        <input type="radio" name="mode" value="manual" id="modeManual">
        <label for="modeManual">Manual</label>
    </div>
</fieldset>
```

### Компактный вариант

```html
<div class="segmented-control segmented-control-compact">
    <!-- Меньшая высота кнопок -->
</div>
```

---

## ☑️ Checkboxes

### Toggle Switch

```html
<div class="control-group">
    <label class="checkbox-label">
        <input type="checkbox" id="enableFeature" checked>
        <span>Enable Feature</span>
    </label>
</div>
```

**Стиль:** iOS-like toggle switch (33×18px)

---

## 📦 Panels

### Базовая панель (справа)

```html
<aside class="controls-panel" id="myPanel">
    <div class="panel-header" id="myPanelHeader">
        <span>Panel Title <span class="panel-params">subtitle</span></span>
        <span class="collapse-icon">▼</span>
    </div>
    <div class="panel-content">
        <!-- Содержимое -->
    </div>
</aside>
```

### Панель слева

```html
<aside class="controls-panel controls-panel-left" id="leftPanel">
    <!-- ... -->
</aside>
```

### Панель снизу слева

```html
<aside class="controls-panel controls-panel-text" id="textPanel">
    <!-- ... -->
</aside>
```

### JavaScript инициализация

```javascript
const panelManager = new PanelManager();

panelManager.registerPanel('myPanel', {
    headerId: 'myPanelHeader',
    draggable: true,
    persistent: false,
    onOpen: () => {},
    onClose: () => {}
});
```

---

## 🔽 Складные секции

```html
<section class="control-section">
    <h3 class="collapsible-header" id="advancedHeader">
        <span>Advanced Settings <span class="font-size-display">12/14 pt</span></span>
        <button class="collapse-toggle" aria-expanded="false">
            <svg width="12" height="12">
                <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5"/>
            </svg>
        </button>
    </h3>
    
    <div class="collapsible-content collapsed" id="advancedContent">
        <!-- Содержимое -->
    </div>
</section>
```

### JavaScript

```javascript
document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', function() {
        const toggle = this.querySelector('.collapse-toggle');
        const content = this.nextElementSibling;
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        
        toggle.setAttribute('aria-expanded', !isExpanded);
        content.classList.toggle('collapsed');
    });
});
```

---

## 📝 Dropdown & Select

### Styled Select

```html
<select class="style-select">
    <option value="default">Default</option>
    <option value="option1">Option 1</option>
    <option value="option2">Option 2</option>
</select>
```

### Custom Dropdown (в top-links)

```html
<div class="preset-dropdown" id="presetDropdown">
    <button class="preset-dropdown-toggle" id="presetDropdownToggle" aria-haspopup="listbox" aria-expanded="false">
        <span class="preset-dropdown-text">Select</span>
        <svg class="preset-dropdown-arrow" width="12" height="8">
            <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="1.5"/>
        </svg>
    </button>
    <ul class="preset-dropdown-menu" id="presetDropdownMenu">
        <li class="preset-dropdown-item selected" data-value="1">Option 1</li>
        <li class="preset-dropdown-item" data-value="2">Option 2</li>
    </ul>
</div>
```

---

## 📄 Textarea

```html
<textarea id="myText" placeholder="Enter text..." rows="5"></textarea>
<div class="textarea-footer">
    <span class="char-counter" id="charCounter">0 characters</span>
    <div class="button-group">
        <button class="btn-apply">Apply</button>
        <button class="btn-close">Cancel</button>
    </div>
</div>
```

---

## 🪟 Модальные окна

```html
<div class="modal-overlay" id="myModal">
    <div class="modal-content">
        <button class="modal-close" id="modalClose">&times;</button>
        <h2>Modal Title</h2>
        <div class="modal-body">
            <p>Content here...</p>
        </div>
    </div>
</div>
```

### JavaScript

```javascript
const modal = document.getElementById('myModal');

// Открыть
modal.classList.add('active');

// Закрыть
modal.classList.remove('active');

// Закрыть по клику на overlay
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});
```

---

## 🔍 Zoom Controls

### Zoom Indicator (в top-links)

```html
<button class="zoom-indicator" id="zoomIndicator">100%</button>
```

### Zoom Controls (в bottom-buttons)

```html
<div class="zoom-controls zoom-controls-inline">
    <button class="zoom-btn" id="zoomOut">−</button>
    <div class="zoom-display" id="zoomDisplay">100%</div>
    <button class="zoom-btn" id="zoomIn">+</button>
</div>
```

### JavaScript

```javascript
import { ZoomPanManager } from './yf-ui-framework/js/ui/ZoomPanManager.js';

const zoomPanManager = new ZoomPanManager(containerEl, svgEl);

// Обновление индикатора
containerEl.addEventListener('zoomchange', (e) => {
    document.getElementById('zoomIndicator').textContent = e.detail.percent + '%';
});

// Клик на индикатор — reset zoom
document.getElementById('zoomIndicator').addEventListener('click', () => {
    zoomPanManager.resetZoom();
});
```

---

## 📎 File Upload

```html
<div class="file-upload-area" id="fileUploadArea">
    <input type="file" id="fileInput" accept=".svg" style="display: none;">
    <div class="upload-placeholder">
        <p>Click or drag & drop file here</p>
    </div>
</div>
```

### JavaScript

```javascript
const uploadArea = document.getElementById('fileUploadArea');
const fileInput = document.getElementById('fileInput');

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    // Обработка файла
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    // Обработка файла
});
```

---

## 🔗 Bottom Buttons

```html
<nav class="bottom-buttons">
    <button class="btn-fixed btn-export-settings">Export Settings</button>
    <button class="btn-fixed btn-import-settings">Import Settings</button>
    
    <div class="export-group-right">
        <button class="btn-fixed btn-export">Export SVG ⌘E</button>
        <label class="toggle-label">
            <div class="toggle-switch">
                <input type="checkbox" id="convertToOutlines">
                <span class="toggle-slider"></span>
            </div>
            <span class="toggle-label-text">Outline fonts</span>
        </label>
    </div>
</nav>
```

---

## 📐 Layout Components

### Container

```html
<div class="container">
    <!-- Весь контент приложения -->
</div>
```

### Top Links

```html
<div class="top-links">
    <a href="/js/YF/" class="yf-tools-link">←YF Tools</a>
    <!-- Другие элементы -->
</div>
```

### Main Content

```html
<div class="main-content">
    <div class="canvas-container" id="canvasContainer">
        <!-- Canvas/SVG -->
    </div>
    <!-- Panels -->
</div>
```

---

## 🎨 CSS Variables

### Цвета

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
--radius: 12px;           /* Панели */
--radius-button: 20px;    /* Кнопки */
--radius-input: 6px;      /* Inputs */
```

### Transitions

```css
--transition-fast: 0.15s ease;
--transition-normal: 0.2s ease;
--transition-slow: 0.3s ease;

--easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
--easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
```

---

## ♿ Accessibility

### Screen Reader Only

```html
<span class="sr-only">Hidden from visual users</span>
```

### ARIA Labels

```html
<button aria-label="Close panel">×</button>
<input type="range" aria-label="Width slider" aria-valuemin="0" aria-valuemax="100">
```

### Keyboard Navigation

Все интерактивные элементы доступны через Tab, Enter, Escape, Arrow keys.

---

## 📱 Responsive Breakpoints

- **Desktop:** > 1024px
- **Tablet:** 768px - 1024px
- **Mobile:** < 768px

Панели автоматически адаптируются к размеру экрана.

---

## 🔧 Полезные классы

| Класс | Описание |
|-------|----------|
| `.sr-only` | Скрывает элемент для screen readers |
| `.panel-collapsed` | Свернутая панель |
| `.collapsed` | Свернутая секция |
| `.active` | Активное состояние (modal, dropdown) |
| `.selected` | Выбранный элемент |
| `.locked` | Заблокированный параметр |
| `.disabled` | Отключенное состояние |
| `.dragover` | Состояние при drag & drop |

---

**Полная документация:** `README.md`  
**Примеры:** `examples/example.html`  
**Быстрый старт:** `QUICK_START.md`

