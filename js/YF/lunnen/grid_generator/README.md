# Pizza Boxer — Packaging Layout Tool

**Модульный генератор сетки для дизайна упаковки Lunnen**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Status](https://img.shields.io/badge/status-refactored-success)
![Architecture](https://img.shields.io/badge/architecture-modular-orange)

---

## 🎯 О проекте

Pizza Boxer — это инструмент для создания модульных сеток для дизайна упаковки. Предназначен для работы с Adobe Illustrator и обеспечивает точное соответствие размеров при экспорте в SVG.

### Ключевые возможности:

✨ **Модульная сетка** с настраиваемыми параметрами  
📐 **Точные размеры** в миллиметрах для печати  
🎨 **Управление текстом** с автоматическими переносами  
🖼️ **Графические элементы** (иконки, логотипы, SVG)  
💾 **Экспорт в SVG** с сохранением размеров  
⚙️ **Настраиваемые параметры** с пресетами  
🎨 **HSB Color Picker** для точного подбора цвета  

---

## 🚀 Быстрый старт

### 1. Запустите локальный сервер:

```bash
cd grid_generator
python3 -m http.server 8000
```

### 2. Откройте в браузере:

```
http://localhost:8000
```

### 3. Готово! 

Начните работать с сеткой, добавляйте текст и графику, экспортируйте в SVG.

---

## 📁 Структура проекта

```
grid_generator/
├── index.html              # Главная страница
├── script.js               # Точка входа (ES6 модули)
├── style.css               # Стили
│
├── src/                    # Исходный код (модули)
│   ├── core/               # Ядро приложения
│   │   ├── Constants.js
│   │   ├── Settings.js
│   │   └── GridGenerator.js
│   │
│   ├── utils/              # Утилиты
│   │   ├── ColorUtils.js
│   │   ├── MathUtils.js
│   │   └── DOMUtils.js
│   │
│   ├── grid/               # Модули сетки
│   │   ├── GridCalculator.js
│   │   ├── GridRenderer.js
│   │   └── GridPresets.js
│   │
│   ├── svg/                # SVG и экспорт
│   │   ├── SVGUtils.js
│   │   └── SVGExporter.js
│   │
│   ├── ui/                 # UI компоненты
│   │   ├── SliderController.js
│   │   ├── PanelManager.js
│   │   ├── ColorPicker.js
│   │   └── DragDropManager.js
│   │
│   └── elements/           # Текст и графика
│       ├── TextBlockManager.js
│       ├── TextRenderer.js
│       ├── GraphicsManager.js
│       ├── GraphicsRenderer.js
│       └── ElementsNavigator.js
│
├── fonts/                  # Шрифты
└── graphics/               # Графические ресурсы
```

---

## 🎓 Основные концепции

### Модуль (Module)
Базовая единица сетки в миллиметрах. Все размеры привязаны к модулю:
- Baseline grid = 1 модуль
- Отступы (gutters) = 1 модуль  
- Margins = N модулей
- Row Height = N модулей

### Link Mode
Режим связывания параметров:
- **Off** — все параметры независимы
- **R⇄RH** — связь между количеством строк и их высотой
- **RRH⇄Mod** — автоматический расчет модуля из высоты, строк и их высоты

### Perfect Fit
Система подсказывает идеальные комбинации параметров, где строки идеально вмещаются в высоту без остатков.

---

## ⌨️ Клавиатурные сокращения

| Сочетание | Действие |
|-----------|----------|
| `⌘E` / `Ctrl+E` | Экспорт SVG |
| `⌘Z` / `Ctrl+Z` | Undo (в разработке) |
| `⌘⇧Z` / `Ctrl+⇧Z` | Redo (в разработке) |
| `↑` / `↓` | Изменить значение слайдера |
| `Shift` + `↑` / `↓` | Большой шаг |
| `Enter` | Применить изменения |
| `Esc` | Отменить изменения |

---

## 📊 Технические детали

### Технологии:
- **ES6 Modules** — модульная архитектура
- **SVG API** — векторная графика
- **Canvas** — работа с текстом
- **CSS3** — стили и анимации
- **Vanilla JavaScript** — без фреймворков

### Паттерны проектирования:
- **Module Pattern** — изоляция кода
- **Observer Pattern** — реактивные настройки
- **Strategy Pattern** — разные стратегии рендеринга
- **Factory Pattern** — создание SVG элементов

### Браузеры:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

## 🎨 Использование

### Базовая настройка сетки:

1. **Dimensions** — установите размеры упаковки (мм)
2. **Module** — выберите размер базового модуля
3. **Margins** — установите поля
4. **Columns** — количество колонок
5. **Rows** — количество строк (или используйте пресеты)

### Добавление текста:

1. Нажмите **Add Text**
2. Введите текст в панели редактирования
3. Настройте позицию и ширину
4. Выберите стиль (Headline / Text)

### Добавление графики:

1. Нажмите **Add Graphics**
2. Загрузите SVG файл или выберите встроенные элементы
3. Настройте размер и позицию

### Экспорт:

1. Нажмите **Export SVG** (или `⌘E`)
2. Откройте файл в Adobe Illustrator
3. Все размеры будут точно соответствовать настройкам в мм

---

## 🔧 API для разработчиков

### Доступ к приложению в консоли:

```javascript
// Главный экземпляр
window.app

// Информация о сетке
window.app.gridCalculator.getGridInfo()

// Все настройки
window.app.settings.getAll()

// Изменить настройку
window.app.settings.set('columnCount', 16)

// Текстовые блоки
window.app.textBlockManager.getAllBlocks()

// Создать текстовый блок
window.app.textBlockManager.createBlock({
    content: 'Hello World',
    x: 1,
    row: 0,
    width: 6
})
```

---

## 📚 Документация

- [REFACTORING_COMPLETE.md](REFACTORING_COMPLETE.md) — полное описание рефакторинга
- [TESTING_GUIDE.md](TESTING_GUIDE.md) — руководство по тестированию
- [REFACTORING.md](REFACTORING.md) — план рефакторинга
- [README_REFACTORING.md](README_REFACTORING.md) — статус рефакторинга

---

## 🚧 В разработке

- [ ] Unit тесты для всех модулей
- [ ] E2E тесты
- [ ] Полная поддержка Drag & Drop
- [ ] Undo/Redo функциональность
- [ ] TypeScript миграция (опционально)
- [ ] PWA версия

---

## 📝 История версий

### v2.0.0 (13.11.2025) - Рефакторинг
- ✨ Полный рефакторинг на модульную архитектуру
- ✨ 20+ независимых модулей
- ✨ ES6 Modules
- ✨ Улучшенная производительность
- ✨ Готов к расширению

### v1.0.0 - Первый релиз
- Базовая функциональность
- Монолитная архитектура (7568 строк)

---

## 👥 Команда

**YF Team** — разработка и дизайн

---

## 📄 Лицензия

Внутренний проект Яндекса для работы с брендом Lunnen.

---

## 🔗 Полезные ссылки

- [Lunnen Brand Guidelines](../../../) (internal)
- [Adobe Illustrator Tips](https://helpx.adobe.com/illustrator.html)
- [SVG Specification](https://www.w3.org/TR/SVG2/)

---

**Сделано с ❤️ в YF**

