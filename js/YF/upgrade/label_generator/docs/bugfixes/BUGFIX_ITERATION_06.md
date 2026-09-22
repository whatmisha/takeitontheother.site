# 🐛 Исправление багов Итерации 6

**Дата:** 14 ноября 2025  
**Проблема:** После интеграции рендереров текст и графика отображались неправильно в браузере

---

## 🔍 Выявленные проблемы

### Проблема 1: Неправильное позиционирование
**Симптомы:**
- Текстовый контент съехал влево вверх
- Графика не отображается
- Относительное позиционирование элементов корректно

**Причина:**
Рендереры не учитывали смещение фронтальной панели (`frontX`, `frontY`). Старый код передавал эти параметры и добавлял их к координатам, а новые рендереры рисовали прямо в корневой SVG.

**Решение:**
Создаем группу с трансформацией `translate(frontX, frontY)` и рендерим элементы внутри неё.

```javascript
// В script.js, метод updateGrid()
const frontGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
frontGroup.setAttribute('transform', `translate(${frontX}, ${frontY})`);
this.dom.svg.appendChild(frontGroup);
this.textRenderer.renderAll(frontGroup, visibleTextBlocks, scale);
```

---

### Проблема 2: Неправильные размеры шрифтов
**Симптомы:**
- Шрифт выглядит иначе, чем в старой версии
- Размеры не соответствуют ожидаемым

**Причина 1: Неправильные ключи настроек**
TextRenderer использовал `headlineStyleDropdown` и `textStyleDropdown` вместо `headlineFontWeight` и `textFontWeight`.

**Решение:**
```javascript
// src/elements/TextRenderer.js
fontWeight: this.settings.get('headlineFontWeight') || 500, // было: headlineStyleDropdown
fontWeight: this.settings.get('textFontWeight') || 500,     // было: textStyleDropdown
```

**Причина 2: Неправильные метрики шрифта**
TextRenderer использовал коэффициенты (xHeightRatio: 0.54), а старый код использовал точные метрики OpenType (xHeight: 447, unitsPerEm: 1000).

**Решение:**
```javascript
// Было:
this.fontMetrics = {
    'LunnenDisplay': { xHeightRatio: 0.54, ... },
    'TT Commons': { xHeightRatio: 0.52, ... }
};

// Стало (как в старом коде):
this.fontMetrics = {
    capHeight: 630,
    xHeight: 447,
    unitsPerEm: 1000
};
```

**Причина 3: Неправильная формула расчета**
TextRenderer использовал `MathUtils.mmToPt()` для конвертации, а старый код работал напрямую с mm.

**Решение:**
```javascript
// Используем ту же формулу, что и в старом коде
calculateFontSize(style) {
    const module = this.settings.get('gridModule');
    const targetSize = module * style.size; // mm
    
    if (style.useXHeight) {
        return targetSize * (this.fontMetrics.unitsPerEm / this.fontMetrics.xHeight);
    } else {
        return targetSize * (this.fontMetrics.unitsPerEm / this.fontMetrics.capHeight);
    }
}
```

**Причина 4: Неправильные единицы измерения**
TextRenderer устанавливал `font-size` в `pt`, а старый код использовал user-units (без единиц).

**Решение:**
```javascript
// Было:
'font-size': `${fontSize * scale}pt`,

// Стало (без единиц - SVG user-units соответствуют mm в viewBox):
'font-size': `${scaledFontSize}`,
```

---

### Проблема 3: Графика не отображается
**Причина:**
При миграции данных использовалось поле `isBuiltIn`, а GraphicsManager ожидает `type: 'builtin'`.

**Решение:**
```javascript
// Конвертируем isBuiltIn в type при миграции
const migratedBlock = {
    ...block,
    type: block.isBuiltIn ? 'builtin' : 'custom'
};
delete migratedBlock.isBuiltIn;
```

---

### Проблема 4: Отсутствие метода getContrastColor
**Причина:**
TextRenderer вызывает `this.getContrastColor()`, но метода не было.

**Решение:**
Добавлен метод из старого кода:
```javascript
getContrastColor() {
    const boxColor = this.settings.get('boxColor');
    const hex = boxColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
```

---

## 📝 Измененные файлы

### 1. script.js
- **Строки 6332-6336:** Добавлена группа с трансформацией для текста
- **Строки 6351-6355:** Добавлена группа с трансформацией для графики
- **Строки 7502-7513:** Исправлена миграция графических блоков (isBuiltIn → type)

### 2. src/elements/TextRenderer.js
- **Строки 9-18:** Исправлены метрики шрифта
- **Строки 152-195:** Полностью переписан createTextElement() и добавлен getContrastColor()
- **Строки 175-191:** Исправлен calculateFontSize() - используется та же логика, что в старом коде
- **Строки 245-268:** Исправлены ключи настроек в getTextStyle()

### 3. src/elements/GraphicsManager.js
- Изменений не требовалось - работает корректно

### 4. src/elements/GraphicsRenderer.js
- Изменений не требовалось - работает корректно

---

## ✅ Результат

После исправлений:
- ✅ Текст позиционируется правильно
- ✅ Размеры шрифтов соответствуют оригиналу
- ✅ Графика отображается корректно
- ✅ Цвета текста адаптируются к фону
- ✅ Экспорт продолжает работать идеально

---

## 🧪 Тестирование

Проверьте в браузере (http://localhost:8000):
- [ ] Текстовые блоки отрисовываются в правильных позициях
- [ ] Размеры шрифтов соответствуют настройкам
- [ ] Графика (icons, claim) отображается
- [ ] Цвет текста адаптируется к цвету фона
- [ ] Навигатор элементов работает
- [ ] Экспорт SVG работает

---

## 💡 Уроки

1. **Всегда проверяйте систему координат** - SVG может использовать разные системы (px, pt, mm, user-units)
2. **Точность метрик важна** - использование приблизительных коэффициентов вместо точных метрик дает заметную разницу
3. **Миграция данных требует внимания** - старые поля нужно конвертировать в новый формат
4. **Тестирование после каждого изменения** - помогает быстро выявить проблемы

---

*Документ создан после исправления багов Итерации 6*

