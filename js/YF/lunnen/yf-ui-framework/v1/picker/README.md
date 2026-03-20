# HSB Color Picker

Автономный колор-пикер с красивым интерфейсом и динамическими градиентами, извлеченный из проекта Pizza Boxer.

## Особенности

✨ **Красивый дизайн:**
- Круглое превью с текущим цветом
- Минималистичный темный интерфейс
- Плавные анимации и переходы

🎨 **HSB модель:**
- Три слайдера: Hue (оттенок), Saturation (насыщенность), Brightness (яркость)
- Динамические градиенты, меняющиеся в реальном времени
- Удобная работа с цветом

💻 **Автономность:**
- Не требует внешних библиотек
- Только два файла JavaScript
- Легкая интеграция в любой проект

⚡ **Функциональность:**
- Поддержка HEX ввода/вывода
- Клик вне области автоматически закрывает пикер
- Callback при изменении цвета
- API для программного управления

## Структура файлов

```
picker/
├── ColorPicker.js      # Основной класс колор-пикера
├── ColorUtils.js       # Утилиты конвертации цветов (HEX ↔ RGB ↔ HSB)
├── ColorPicker.css     # Стили компонента
├── demo.html           # Демо-страница с примерами
└── README.md           # Документация (этот файл)
```

## Быстрый старт

### 1. Подключение файлов

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Мой проект</title>
    <link rel="stylesheet" href="picker/ColorPicker.css">
</head>
<body>
    <!-- Контейнер для пикера -->
    <div id="colorPickerContainer"></div>

    <script type="module">
        import { ColorPicker } from './picker/ColorPicker.js';

        // Создание и инициализация пикера
        const picker = new ColorPicker({
            containerId: 'colorPickerContainer',
            initialColor: '#808080',
            onChange: (color) => {
                console.log('Выбран цвет:', color);
            }
        });

        picker.init();
    </script>
</body>
</html>
```

### 2. Демонстрация

Откройте `demo.html` в браузере, чтобы увидеть пикер в действии.

## API

### Создание экземпляра

```javascript
const picker = new ColorPicker(options);
```

#### Опции (options)

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `containerId` | `string` | `'colorPickerContainer'` | ID контейнера для пикера |
| `initialColor` | `string` | `'#808080'` | Начальный цвет в HEX |
| `onChange` | `function` | `null` | Callback при изменении цвета |

### Методы

#### `init()`
Инициализация пикера (создание HTML и привязка событий).

```javascript
picker.init();
```

#### `setColor(hex)`
Программная установка цвета.

```javascript
picker.setColor('#ff5733');
```

#### `getColor()`
Получение текущего цвета в HEX.

```javascript
const currentColor = picker.getColor(); // '#ff5733'
```

#### `open()`
Открыть панель HSB слайдеров.

```javascript
picker.open();
```

#### `close()`
Закрыть панель HSB слайдеров.

```javascript
picker.close();
```

#### `toggle()`
Переключить видимость панели.

```javascript
picker.toggle();
```

#### `isOpen()`
Проверка, открыта ли панель.

```javascript
if (picker.isOpen()) {
    console.log('Пикер открыт');
}
```

## Примеры использования

### Пример 1: Базовое использование

```javascript
const picker = new ColorPicker({
    containerId: 'myColorPicker',
    initialColor: '#3498db',
    onChange: (color) => {
        document.body.style.backgroundColor = color;
    }
});

picker.init();
```

### Пример 2: Несколько пикеров на странице

```html
<div id="picker1"></div>
<div id="picker2"></div>

<script type="module">
    import { ColorPicker } from './picker/ColorPicker.js';

    const picker1 = new ColorPicker({
        containerId: 'picker1',
        initialColor: '#e74c3c',
        onChange: (color) => console.log('Пикер 1:', color)
    });

    const picker2 = new ColorPicker({
        containerId: 'picker2',
        initialColor: '#2ecc71',
        onChange: (color) => console.log('Пикер 2:', color)
    });

    picker1.init();
    picker2.init();
</script>
```

### Пример 3: Программное управление

```javascript
const picker = new ColorPicker({
    containerId: 'picker',
    onChange: (color) => {
        console.log('Новый цвет:', color);
    }
});

picker.init();

// Установка цвета через 2 секунды
setTimeout(() => {
    picker.setColor('#9b59b6');
}, 2000);

// Случайный цвет по клику
document.getElementById('randomBtn').addEventListener('click', () => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    picker.setColor(randomColor);
});
```

### Пример 4: Интеграция с формой

```html
<form id="myForm">
    <label>Цвет фона:</label>
    <div id="bgColorPicker"></div>
    
    <button type="submit">Сохранить</button>
</form>

<script type="module">
    import { ColorPicker } from './picker/ColorPicker.js';

    let selectedColor = '#ffffff';

    const picker = new ColorPicker({
        containerId: 'bgColorPicker',
        initialColor: selectedColor,
        onChange: (color) => {
            selectedColor = color;
        }
    });

    picker.init();

    document.getElementById('myForm').addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Сохранен цвет:', selectedColor);
        // Отправка на сервер и т.д.
    });
</script>
```

## Кастомизация

### Изменение цветовой схемы

Вы можете изменить CSS переменные в начале файла `ColorPicker.css`:

```css
:root {
    --color-bg: #000;           /* Основной фон */
    --color-bg-panel: #1a1a1a;  /* Фон панелей */
    --color-bg-input: #0a0a0a;  /* Фон инпутов */
    --color-text: #fff;         /* Основной текст */
    --color-text-secondary: #ccc; /* Вторичный текст */
    --color-text-muted: #888;   /* Приглушенный текст */
    --color-border: #333;       /* Цвет границ */
}
```

### Изменение размеров

```css
:root {
    --spacing-md: 8px;          /* Отступы */
    --radius: 12px;             /* Скругления */
    --slider-thumb-size: 8px;   /* Размер ползунка */
}
```

## ColorUtils

Класс `ColorUtils` содержит статические методы для работы с цветами и может использоваться независимо:

```javascript
import { ColorUtils } from './picker/ColorUtils.js';

// HEX → RGB
const rgb = ColorUtils.hexToRgb('#ff5733');
console.log(rgb); // { r: 255, g: 87, b: 51 }

// RGB → HEX
const hex = ColorUtils.rgbToHex(255, 87, 51);
console.log(hex); // '#ff5733'

// RGB → HSB
const hsb = ColorUtils.rgbToHsb(255, 87, 51);
console.log(hsb); // { h: 11, s: 80, b: 100 }

// HSB → RGB
const rgb2 = ColorUtils.hsbToRgb(11, 80, 100);
console.log(rgb2); // { r: 255, g: 87, b: 51 }
```

## Технические детали

- **ES6 Modules:** Используются современные модули JavaScript
- **No Dependencies:** Нет внешних зависимостей
- **HSB Color Space:** Более удобная для человека модель цвета
- **Dynamic Gradients:** Градиенты слайдеров меняются в зависимости от текущего цвета
- **Event Handling:** Правильная обработка событий с предотвращением рекурсии

## Браузерная совместимость

Работает во всех современных браузерах, поддерживающих:
- ES6 Modules
- CSS Custom Properties (переменные)
- CSS Gradients
- Range Input

Тестировалось в:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Авторство

Извлечено из проекта **Pizza Boxer** — инструмента для создания упаковочных макетов.

---

**Лицензия:** Свободное использование в личных и коммерческих проектах.

**Обратная связь:** Если найдете баги или захотите что-то улучшить, просто отредактируйте код — он полностью автономный и легко модифицируется!

