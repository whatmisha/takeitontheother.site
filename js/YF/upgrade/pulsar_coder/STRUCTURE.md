# Структура YF UI Framework

```
yf-ui-framework/
│
├── README.md                    # Полная документация
├── QUICK_START.md              # Быстрый старт за 5 минут
├── COMPONENTS.md               # Справочник компонентов
├── VERSION.md                  # История версий
├── STRUCTURE.md                # Этот файл
│
├── css/
│   └── yf-styles.css           # Все стили фреймворка (~2600 строк)
│       ├── CSS Variables       # Цвета, отступы, анимации
│       ├── Layout              # Container, panels, canvas
│       ├── UI Components       # Buttons, sliders, inputs
│       ├── Color Picker        # HSB picker
│       ├── Modals              # Modal overlays
│       └── Responsive          # Media queries
│
├── js/
│   ├── utils/                  # Утилиты
│   │   ├── ColorUtils.js       # HEX ↔ RGB ↔ HSB, контраст
│   │   ├── MathUtils.js        # Конвертация единиц, округление
│   │   └── DOMUtils.js         # Работа с DOM и SVG
│   │
│   └── ui/                     # UI контроллеры
│       ├── SliderController.js # Управление слайдерами
│       ├── ColorPicker.js      # HSB color picker
│       ├── PanelManager.js     # Drag & drop панелей
│       └── ZoomPanManager.js   # Zoom & Pan для canvas
│
├── fonts/                      # Шрифты
│   ├── TT_Commons_Classic_Regular.woff2
│   ├── TT_Commons_Classic_Medium.woff2
│   ├── TT Commons Classic Regular.otf
│   ├── TT Commons Classic Medium.otf
│   ├── LunnenDisplay-VariableVF.woff2
│   └── LunnenDisplay-VariableVF.ttf
│
└── examples/                   # Примеры использования
    ├── example.html            # Полный пример всех компонентов
    └── minimal-template.html   # Минимальный стартовый шаблон
```

## Описание файлов

### Документация

| Файл | Описание |
|------|----------|
| `README.md` | Основная документация с полным руководством |
| `QUICK_START.md` | Быстрый старт для новых проектов |
| `COMPONENTS.md` | Справочник всех UI компонентов с примерами |
| `VERSION.md` | История версий и changelog |
| `STRUCTURE.md` | Описание структуры файлов |

### CSS

| Файл | Размер | Описание |
|------|--------|----------|
| `yf-styles.css` | ~120KB | Все стили фреймворка |

**Секции CSS:**
1. **CSS Variables** (строки 1-76) — Цвета, отступы, анимации
2. **Base Styles** (77-115) — Reset, typography
3. **Layout** (116-358) — Container, canvas, top-links
4. **Panels** (359-532) — Controls panels, headers, content
5. **Control Groups** (533-676) — Базовые контейнеры
6. **Sliders** (677-1023) — Range sliders с кастомным дизайном
7. **Inputs** (1024-1260) — Text inputs, value displays
8. **Color Picker** (1261-1403) — HSB picker с градиентами
9. **Buttons** (1404-1518) — Все типы кнопок
10. **Toggle Chips** (1519-1808) — Переключатели с иконками
11. **Segmented Control** (1809-1843) — Радио-кнопки
12. **Checkboxes** (1844-1892) — Toggle switches
13. **Dropdowns** (1893-2095) — Select и custom dropdowns
14. **Textarea** (2096-2136) — Текстовые поля
15. **Modals** (2137-2273) — Модальные окна
16. **Bottom Buttons** (2274-2372) — Action buttons
17. **Zoom Controls** (2373-2391) — Zoom indicators
18. **Scrollbars** (2392-2436) — Кастомные scrollbars
19. **Responsive** (2437-2557) — Media queries

### JavaScript Утилиты

| Файл | Строк | Описание |
|------|-------|----------|
| `ColorUtils.js` | 165 | Работа с цветами |
| `MathUtils.js` | 117 | Математические операции |
| `DOMUtils.js` | 138 | Работа с DOM |

**ColorUtils:**
- `hexToRgb()` — HEX → RGB
- `rgbToHex()` — RGB → HEX
- `rgbToHsb()` — RGB → HSB
- `hsbToRgb()` — HSB → RGB
- `getLuminance()` — Светимость (WCAG)
- `getContrastColor()` — Контрастный цвет
- `getGridOpacity()` — Прозрачность сетки

**MathUtils:**
- `mmToPt()` — Миллиметры → Пункты
- `ptToMm()` — Пункты → Миллиметры
- `roundTo()` — Округление
- `clamp()` — Ограничение диапазона
- `snapToGrid()` — Привязка к сетке
- `debounce()` — Дебаунс функции
- `throttle()` — Троттлинг функции

**DOMUtils:**
- `createSVGElement()` — Создание SVG элементов
- `cacheElements()` — Кэширование DOM элементов
- `clearElement()` — Очистка контейнера
- `addClass/removeClass/toggleClass()` — Работа с классами
- `updateSliderGradient()` — Динамические градиенты
- `getElementRect()` — Координаты элемента
- `isElementInViewport()` — Проверка видимости

### JavaScript UI Контроллеры

| Файл | Строк | Описание |
|------|-------|----------|
| `SliderController.js` | 417 | Управление слайдерами |
| `ColorPicker.js` | 305 | HSB color picker |
| `PanelManager.js` | 316 | Drag & drop панелей |
| `ZoomPanManager.js` | 461 | Zoom & Pan для canvas |

**SliderController:**
- Инициализация слайдеров с конфигурацией
- Синхронизация slider ↔ text input
- Клавиатурное управление (↑↓, Shift+↑↓, Enter, Escape)
- Умное округление с "прилипанием" к шагам
- Валидация значений
- Программное обновление значений

**ColorPicker:**
- HSB модель (Hue 0-360°, Saturation 0-100%, Brightness 0-100%)
- Динамические градиенты на слайдерах
- HEX input с валидацией
- Preset colors
- Event callbacks для onChange

**PanelManager:**
- Регистрация панелей
- Drag & drop перетаскивание
- Автоматическое управление z-index
- Открытие/закрытие панелей
- Центрирование и позиционирование
- Event callbacks (onOpen, onClose)

**ZoomPanManager:**
- Векторное масштабирование через SVG viewBox
- Zoom: Cmd/Ctrl + Scroll (centered on cursor)
- Pan: Space + drag, средняя кнопка мыши, Scroll/Swipe
- Keyboard shortcuts (Cmd+0, Cmd+1, Cmd+Plus/Minus)
- Fit to screen с фиксированными отступами
- Event callbacks для zoomchange

### Шрифты

| Файл | Формат | Размер | Использование |
|------|--------|--------|---------------|
| `TT_Commons_Classic_Regular.woff2` | WOFF2 | ~40KB | Интерфейс, текст |
| `TT_Commons_Classic_Medium.woff2` | WOFF2 | ~40KB | Заголовки, кнопки |
| `TT Commons Classic Regular.otf` | OTF | ~80KB | Fallback |
| `TT Commons Classic Medium.otf` | OTF | ~80KB | Fallback |
| `LunnenDisplay-VariableVF.woff2` | WOFF2 | ~60KB | Декоративные элементы |
| `LunnenDisplay-VariableVF.ttf` | TTF | ~120KB | Fallback |

**Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
```

### Примеры

| Файл | Описание |
|------|----------|
| `example.html` | Демонстрация всех компонентов с рабочими примерами |
| `minimal-template.html` | Минимальный шаблон для быстрого старта |

## Зависимости

**Нет внешних зависимостей!**

Фреймворк использует только:
- Vanilla JavaScript (ES6 modules)
- CSS3 с переменными
- SVG для графики
- Web APIs (DOM, Events)

## Совместимость

- **JavaScript:** ES6+ (modules, arrow functions, destructuring)
- **CSS:** Variables, Grid, Flexbox, Custom properties
- **SVG:** Inline SVG, viewBox, transforms

**Требуется:**
- Modern browser с поддержкой ES6 modules
- CSS Variables support
- SVG support

**Проверено в:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Размер файлов

| Категория | Размер | Gzipped |
|-----------|--------|---------|
| CSS | ~120KB | ~30KB |
| JavaScript | ~45KB | ~12KB |
| Fonts (WOFF2) | ~140KB | ~140KB |
| Fonts (OTF/TTF) | ~280KB | — |
| **Total (WOFF2)** | **~305KB** | **~182KB** |
| **Total (with OTF)** | **~585KB** | **~462KB** |

**Рекомендация:** Используйте только WOFF2 файлы для production (~305KB).

## Производительность

- **Первая отрисовка:** < 50ms
- **Время загрузки CSS:** < 100ms (gzipped)
- **Время загрузки JS:** < 50ms (gzipped)
- **Инициализация контроллеров:** < 10ms
- **Плавность анимаций:** 60 FPS

## Лучшие практики

1. **Импортируйте только нужное:**
   ```javascript
   import { SliderController } from './yf-ui-framework/js/ui/SliderController.js';
   ```

2. **Используйте CSS переменные:**
   ```css
   .my-component {
       padding: var(--spacing-lg);
       border-radius: var(--radius);
   }
   ```

3. **Следуйте паттернам:**
   - Используйте `control-group` для всех контролов
   - Всегда добавляйте `aria-label` для accessibility
   - Используйте семантический HTML

4. **Оптимизация:**
   - Используйте WOFF2 шрифты
   - Минифицируйте CSS/JS для production
   - Используйте gzip/brotli сжатие

---

**Version:** 1.0.0  
**Last Updated:** December 2025  
**Maintainer:** YF Tools Team

