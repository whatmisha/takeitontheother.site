# Zoom & Pan Feature

## Обзор

Добавлена функциональность зума и панорамирования canvas как в Figma. Позволяет удобно навигироваться по большим макетам.

## Возможности

### Zoom (Масштабирование)
- **Колесо мыши**: Зум с центром на курсоре
- **Cmd/Ctrl + Plus**: Увеличение
- **Cmd/Ctrl + Minus**: Уменьшение
- **Cmd/Ctrl + 0**: Fit to screen (подогнать под размер экрана)
- **Cmd/Ctrl + 1**: Сброс зума в 100%
- **Двойной клик на индикатор зума**: Сброс в 100%

### Pan (Панорамирование)
- **Пробел + drag**: Перемещение canvas
- **Средняя кнопка мыши + drag**: Перемещение canvas

## Технические детали

### Архитектура

#### ZoomPanManager
Модуль `src/ui/ZoomPanManager.js` управляет всей функциональностью зума и панорамирования.

**Основные методы:**
- `zoomTo(newZoom, mouseX, mouseY)` - Зум к указанной точке
- `zoomIn()` - Увеличение на 20%
- `zoomOut()` - Уменьшение на 20%
- `resetZoom()` - Сброс в 100%
- `fitToScreen()` - Подгонка под размер экрана
- `getZoomPercent()` - Получение текущего уровня зума в процентах

**События:**
- `zoomchange` - Срабатывает при изменении зума, передает `{ zoom, percent }`

### Интеграция

#### HTML
```html
<!-- Zoom Controls -->
<div class="zoom-controls">
    <button class="zoom-btn" id="zoomOutBtn">-</button>
    <div class="zoom-display" id="zoomDisplay">100%</div>
    <button class="zoom-btn" id="zoomInBtn">+</button>
    <button class="zoom-btn" id="fitToScreenBtn">⌘0</button>
    <button class="zoom-btn" id="resetZoomBtn">1:1</button>
</div>
```

#### CSS
Стили находятся в `style.css`, секция "Zoom Controls":
- `.zoom-controls` - Контейнер с кнопками
- `.zoom-btn` - Стили кнопок
- `.zoom-display` - Индикатор зума

#### JavaScript
Инициализация в `script.js`, метод `initUIControllers()`:
```javascript
this.zoomPanManager = new ZoomPanManager(
    this.dom.canvasContainer,
    this.dom.svg
);

// Обработчик изменения зума
this.dom.canvasContainer.addEventListener('zoomchange', (e) => {
    this.dom.zoomDisplay.textContent = `${e.detail.percent}%`;
});
```

### Трансформация

Canvas трансформируется через SVG `viewBox` для настоящего векторного масштабирования:
```javascript
svg.setAttribute('viewBox', `${panX} ${panY} ${width} ${height}`);
```

Где:
- `width = originalWidth / zoom` - уменьшается при приближении
- `height = originalHeight / zoom` - уменьшается при приближении
- `panX, panY` - смещение viewBox для панорамирования

**Преимущества viewBox:**
- ✅ Идеальная четкость на любом уровне зума
- ✅ Настоящее векторное масштабирование
- ✅ Нет размытия или пикселизации
- ✅ Профессиональное качество как в Figma

## Пользовательский опыт

### Курсоры
- **default** - Обычное состояние
- **grab** - При нажатии пробела
- **grabbing** - При активном перетаскивании

### Ограничения
- Минимальный зум: 10%
- Максимальный зум: 1000%

### Производительность
- Используется `will-change: transform` для оптимизации
- Трансформация применяется через GPU

## Клавиатурные сокращения

| Действие | Сокращение |
|----------|-----------|
| Зум с центром на курсоре | Колесо мыши |
| Панорамирование | Пробел + drag |
| Панорамирование (альт.) | Средняя кнопка + drag |
| Увеличение | Cmd/Ctrl + Plus |
| Уменьшение | Cmd/Ctrl + Minus |
| Fit to screen | Cmd/Ctrl + 0 |
| Сброс в 100% | Cmd/Ctrl + 1 |
| Сброс в 100% (альт.) | Двойной клик на индикатор |

## Совместимость

- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Тачпады (pinch-to-zoom не реализован)

## Будущие улучшения

1. **Pinch-to-zoom** на тачпадах (через gesturestart/gesturechange)
2. **Анимация** при Fit to screen и Reset
3. **История зума** для быстрого возврата
4. **Кастомный зум** через ввод процента в поле
5. **Сохранение состояния зума** в preset
6. **Zoom to selection** при выделении объектов

## Примечания

- Зум не влияет на экспорт SVG (экспортируется в реальных размерах)
- При нажатии пробела фокус не должен быть на input элементах
- Контекстное меню на средней кнопке отключено

