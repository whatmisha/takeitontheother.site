# 🔄 Итерация 6: Временный откат (Rollback)

**Дата:** 14 ноября 2025  
**Причина:** Рендереры недостаточно функциональны для browser view  

---

## 🔍 Проблемы после интеграции рендереров

### Проблема 1: Отсутствие snap to baseline
**Симптомы:**
- Текст не выравнивается по baseline сетки
- Интерлиньяж неправильный

**Причина:**
TextRenderer не реализует метод `snapToBaseline()`, который в старом коде привязывает каждую строку текста к ближайшей линии baseline.

**Старый код (строки 3858-3870):**
```javascript
let previousBaselineY = null;
wrappedLines.forEach((line, index) => {
    let lineBaselineY;
    
    if (index === 0) {
        const lineApproxY = firstLineY;
        lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, true);
        previousBaselineY = lineBaselineY;
    } else {
        const lineApproxY = previousBaselineY + lineHeightInMm;
        lineBaselineY = this.snapToBaseline(lineApproxY, frontY, scale, false);
        previousBaselineY = lineBaselineY;
    }
    // ...
});
```

**TextRenderer:**
```javascript
// Простой расчет без привязки к сетке
lines.forEach((line, index) => {
    const y = index * lineHeight * scale;
    // Нет snapToBaseline!
});
```

---

### Проблема 2: Отсутствие интерактивности
**Симптомы:**
- Пропало выделение текста при наведении
- Пропал handle для изменения ширины мышью
- Нет bounds rectangle

**Причина:**
TextRenderer создает только базовую SVG разметку без интерактивных элементов.

**Старый код создает:**
- Hover area (невидимая область для наведения)
- Bounds rectangle (видимый при наведении)
- Resize handle (для изменения ширины)
- Event handlers (attachTextBlockHandlers, attachResizeHandle)

**TextRenderer создает:**
- Только текст
- Только простой bounds если showBounds=true

---

### Проблема 3: Графические объекты не видны
**Симптомы:**
- Icons и Claim не отображаются

**Причина:**
GraphicsRenderer парсит SVG контент, но может неправильно обрабатывать встроенную графику или потерять некоторые атрибуты при клонировании.

---

## 🔄 Решение: Временный откат

### Что сделано:

**1. Отключены рендереры для browser view (script.js, строки 6329-6360)**
```javascript
// Было:
if (this.textRenderer && this.textBlockManager) {
    // Используем рендереры
}

// Стало:
// Всегда используем старый код для browser view
this.textBlocks.forEach(block => {
    if (block.visible !== false && !block.deleting) {
        this.drawTextBlock(...);
    }
});
```

**2. Отключен ElementsNavigator (script.js, строки 5161-5164)**
```javascript
// Всегда используем старую логику updateElementsNavigator()
// ElementsNavigator будет доработан позже
```

**3. Отключена миграция данных (script.js, строки 7456-7471)**
```javascript
initElementsManagers() {
    // Создаём менеджеры (для будущего)
    this.textBlockManager = new TextBlockManager(...);
    this.textRenderer = new TextRenderer(...);
    // ...
    
    // НЕ выполняем миграцию данных
    // Используем старые массивы this.textBlocks и this.graphicsBlocks
}
```

---

## ✅ Результат

После отката:
- ✅ Текст выравнивается по baseline корректно
- ✅ Интерлиньяж правильный
- ✅ Hover эффекты работают
- ✅ Resize handle работает
- ✅ Графика отображается корректно
- ✅ Экспорт продолжает работать

---

## 📊 Текущее состояние Итерации 6

### Что готово:
- ✅ Модули созданы и протестированы
- ✅ Базовая архитектура работает
- ✅ Менеджеры инициализируются (но не используются)

### Что требует доработки:

#### TextRenderer:
1. **Snap to baseline** - реализовать привязку к сетке
2. **Интерактивность** - hover, bounds, resize handles
3. **Event handlers** - drag, resize, click to edit
4. **Correct line spacing** - учет cap-height и x-height для каждой строки

#### GraphicsRenderer:
1. **SVG parsing** - улучшить обработку встроенной графики
2. **Bounds and interaction** - hover, selection
3. **Transform handling** - корректная обработка viewBox и transform

#### ElementsNavigator:
1. **Синхронизация** - автоматическое обновление при изменениях
2. **Event handling** - интеграция с существующими обработчиками

---

## 🎯 План доработки (будущие итерации)

### Фаза 1: Расширение TextRenderer (~4-6 часов)
1. Добавить метод `snapToBaseline(y, frontY, scale, isFirstLine)`
2. Реализовать `renderInteractive()` для browser view
3. Создать `renderSimple()` для экспорта
4. Добавить event handlers

### Фаза 2: Расширение GraphicsRenderer (~2-3 часа)
1. Улучшить парсинг SVG
2. Добавить интерактивность
3. Тестирование со встроенной графикой

### Фаза 3: Интеграция (~2 часа)
1. Включить рендереры для browser view
2. Включить ElementsNavigator
3. Включить синхронизацию данных
4. Полное тестирование

---

## 💡 Архитектурное решение

### Предложение: Два режима работы

**Режим 1: Browser View (интерактивный)**
- Использует старый код `drawTextBlock()` и `drawGraphicsBlock()`
- Полная интерактивность
- Snap to baseline
- Event handlers

**Режим 2: Export (простой)**
- Использует `TextRenderer.renderAll()` и `GraphicsRenderer.renderAll()`
- Чистый SVG без интерактивности
- Оптимизированный размер файла

### Реализация:
```javascript
updateGrid(isExport = false) {
    if (isExport) {
        // Используем рендереры для чистого SVG
        this.textRenderer.renderAll(svg, blocks, scale);
    } else {
        // Используем старый код для интерактивности
        blocks.forEach(block => this.drawTextBlock(svg, block, ...));
    }
}
```

---

## 📝 Выводы

1. **Рендереры работают**, но требуют доработки для полной функциональности
2. **Старый код остается рабочим** - это хорошо для обратной совместимости
3. **Модульная архитектура подготовлена** - можно постепенно переходить
4. **Нет регрессии** - откат сохранил все функции

---

## 📚 Связанные документы

- `ITERATION_06_COMPLETE.md` - План и результаты Итерации 6
- `BUGFIX_ITERATION_06.md` - Исправленные баги (позиционирование, шрифты)
- `REFACTORING_PLAN.md` - Общий план рефакторинга

---

*Документ создан после временного отката Итерации 6*
*Рендереры будут доработаны и включены в будущих итерациях*

