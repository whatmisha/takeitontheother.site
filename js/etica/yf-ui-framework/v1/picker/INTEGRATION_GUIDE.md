# Быстрая интеграция Color Picker в ваш проект

## 🚀 За 3 минуты

### Шаг 1: Скопируйте файлы
Скопируйте всю папку `picker` в корень вашего проекта.

### Шаг 2: Подключите CSS
```html
<link rel="stylesheet" href="picker/ColorPicker.css">
```

### Шаг 3: Добавьте контейнер
```html
<div id="myColorPicker"></div>
```

### Шаг 4: Инициализируйте
```html
<script type="module">
    import { ColorPicker } from './picker/ColorPicker.js';

    const picker = new ColorPicker({
        containerId: 'myColorPicker',
        initialColor: '#808080',
        onChange: (color) => {
            console.log('Выбран цвет:', color);
            // Ваш код здесь
        }
    });

    picker.init();
</script>
```

## 💡 Что вы получаете

```
picker/
├── ColorPicker.js      ← Основной класс (автономный)
├── ColorUtils.js       ← Конвертация цветов HEX/RGB/HSB
├── ColorPicker.css     ← Стили (легко кастомизировать)
├── demo.html           ← Рабочий пример
├── README.md           ← Полная документация
└── INTEGRATION_GUIDE.md ← Этот файл
```

## 🎨 Интерфейс

- **Круглое превью** - показывает текущий цвет
- **HEX поле** - ручной ввод цвета (#ff5733)
- **3 слайдера HSB:**
  - **Hue** (оттенок) - радужный градиент
  - **Saturation** (насыщенность) - от серого к яркому
  - **Brightness** (яркость) - от черного к светлому

Градиенты меняются динамически в зависимости от выбранного цвета!

## 📝 Минимальный пример

Создайте файл `test.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Тест Color Picker</title>
    <link rel="stylesheet" href="picker/ColorPicker.css">
    <style>
        body {
            background: #000;
            color: #fff;
            font-family: system-ui;
            padding: 50px;
        }
        #preview {
            width: 200px;
            height: 200px;
            margin-top: 20px;
            border-radius: 10px;
            transition: background 0.3s;
        }
    </style>
</head>
<body>
    <h1>Color Picker Test</h1>
    <div id="picker"></div>
    <div id="preview"></div>

    <script type="module">
        import { ColorPicker } from './picker/ColorPicker.js';

        const picker = new ColorPicker({
            containerId: 'picker',
            initialColor: '#3498db',
            onChange: (color) => {
                document.getElementById('preview').style.background = color;
            }
        });

        picker.init();
        
        // Начальное состояние
        document.getElementById('preview').style.background = '#3498db';
    </script>
</body>
</html>
```

Откройте `test.html` в браузере - готово! 🎉

## 🔧 API Шпаргалка

```javascript
// Создание
const picker = new ColorPicker({ 
    containerId: 'id', 
    initialColor: '#hex',
    onChange: (color) => {} 
});

picker.init();              // Инициализация
picker.setColor('#ff0000'); // Установить цвет
picker.getColor();          // Получить цвет
picker.open();              // Открыть панель
picker.close();             // Закрыть панель
picker.toggle();            // Переключить
picker.isOpen();            // Проверить состояние
```

## ⚠️ Важно

1. **Используйте `type="module"`** в script теге
2. **Работает только на веб-сервере** (не file://)
   - Используйте Live Server в VS Code
   - Или `python -m http.server 8000`
3. **ID контейнера должен существовать** до вызова `init()`

## 🎯 Полезные примеры

### Изменить фон страницы
```javascript
const picker = new ColorPicker({
    containerId: 'picker',
    onChange: (color) => {
        document.body.style.backgroundColor = color;
    }
});
```

### Несколько пикеров
```javascript
const picker1 = new ColorPicker({ containerId: 'picker1' });
const picker2 = new ColorPicker({ containerId: 'picker2' });
picker1.init();
picker2.init();
```

### Кнопка случайного цвета
```javascript
button.onclick = () => {
    const random = '#' + Math.random().toString(16).slice(2, 8).padEnd(6, '0');
    picker.setColor(random);
};
```

## 📚 Дальше

- Откройте `demo.html` для полной демонстрации
- Читайте `README.md` для подробной документации
- Редактируйте `ColorPicker.css` для кастомизации стилей

---

**Готово!** Теперь у вас есть профессиональный колор-пикер в проекте 🎨

