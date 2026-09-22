# 🎯 Итерация 7: SVG Export - План

**Сложность:** Низкая (~3 часа)  
**Цель:** Интеграция SVGExporter для упрощения экспорта SVG и настроек  
**Статус:** 📋 Готов к старту

---

## 📋 Что будем делать

Сейчас экспорт SVG реализован напрямую в `script.js` методом `exportSVG()` (~200 строк). Вынесем эту логику в отдельный модуль `SVGExporter`.

---

## 📁 Модуль уже создан

**Файл:** `src/svg/SVGExporter.js`  
**Статус:** ✅ Готов к использованию  
**Размер:** ~200 строк

### Что умеет SVGExporter:

```javascript
class SVGExporter {
    // Экспорт SVG в файл
    exportToFile(svgElement, filename, options)
    
    // Экспорт настроек в JSON
    exportSettings(data, filename)
    
    // Импорт настроек из JSON
    importSettings(file)
    
    // Получение чистого SVG без интерактивных элементов
    getCleanSVG(svgElement)
}
```

---

## 🔧 Шаги интеграции

### Шаг 1: Добавить импорт (~1 мин)

**Файл:** `script.js`  
**Строка:** ~27 (после других импортов)

```javascript
// Итерация 7: SVG Export
import { SVGExporter } from './src/svg/SVGExporter.js';
```

---

### Шаг 2: Инициализировать в конструкторе (~2 мин)

**Файл:** `script.js`  
**Строка:** ~320 (в секции UI Controllers)

```javascript
// ============================================
// SVG Exporter (Итерация 7)
// ============================================
this.svgExporter = new SVGExporter(this.settingsModule);
```

---

### Шаг 3: Заменить метод exportSVG() (~10 мин)

**Файл:** `script.js`  
**Найти:** метод `exportSVG()` (строка ~6900)

**Было (~200 строк):**
```javascript
exportSVG() {
    const { frontWidth, frontHeight, thickness } = this.settings;
    
    // Создаем новый SVG
    const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // ... 180+ строк создания SVG для экспорта
    
    // Сериализация
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(exportSvg);
    // ... обработка, скачивание
}
```

**Стало (~15 строк):**
```javascript
exportSVG() {
    // Итерация 7: используем SVGExporter
    
    // Создаем SVG для экспорта (scale = 1 для точных размеров)
    const exportSvg = this.createExportSVG();
    
    // Экспортируем через модуль
    this.svgExporter.exportToFile(exportSvg, 'grid-layout.svg', {
        removeInteractive: true,
        optimizeSize: true
    });
}
```

---

### Шаг 4: Создать метод createExportSVG() (~30 мин)

**Файл:** `script.js`  
**Место:** После метода `exportSVG()`

```javascript
// Создание SVG для экспорта
createExportSVG() {
    const { frontWidth, frontHeight, thickness } = this.settings;
    const scale = 1; // Для экспорта всегда используем реальные размеры
    
    // Создаем SVG
    const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    // Устанавливаем размеры
    const totalWidth = frontWidth + 2 * thickness;
    const totalHeight = frontHeight + 2 * thickness;
    exportSvg.setAttribute('width', `${totalWidth}mm`);
    exportSvg.setAttribute('height', `${totalHeight}mm`);
    exportSvg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // Рисуем прямоугольники
    this.drawRectangles(exportSvg, 0, 0, frontWidth, frontHeight, thickness, scale);
    
    // Рисуем сетку если включена
    if (this.settings.showColumns) {
        this.drawColumns(exportSvg, thickness, thickness, frontWidth, frontHeight, scale);
    }
    
    if (this.settings.showRows) {
        this.drawRows(exportSvg, thickness, thickness, frontWidth, frontHeight, scale);
    }
    
    if (this.settings.showBaseline) {
        this.drawBaseline(exportSvg, thickness, thickness, frontWidth, frontHeight, scale);
    }
    
    // Рисуем объекты если включены
    if (this.settings.showObjects) {
        // Текст
        this.textBlocks.forEach(block => {
            if (block.visible !== false) {
                this.drawTextBlock(exportSvg, block, thickness, thickness, frontWidth, frontHeight, scale);
            }
        });
        
        // Графика
        if (this.graphicsBlocks) {
            this.graphicsBlocks.forEach(block => {
                if (block.visible !== false) {
                    this.drawGraphicsBlock(exportSvg, block, thickness, thickness, frontWidth, frontHeight, scale);
                }
            });
        }
    }
    
    return exportSvg;
}
```

---

### Шаг 5: Добавить экспорт/импорт настроек (~20 мин)

**Файл:** `script.js`  
**Добавить новые методы:**

```javascript
// Экспорт настроек в JSON
exportSettings() {
    const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings: this.settingsModule.getAll(),
        textBlocks: this.textBlocks,
        graphicsBlocks: this.graphicsBlocks
    };
    
    this.svgExporter.exportSettings(data, 'grid-settings.json');
}

// Импорт настроек из JSON
async importSettings(file) {
    try {
        const data = await this.svgExporter.importSettings(file);
        
        if (data.settings) {
            // Применяем настройки
            Object.entries(data.settings).forEach(([key, value]) => {
                this.settingsModule.set(key, value);
            });
        }
        
        if (data.textBlocks) {
            this.textBlocks = data.textBlocks;
        }
        
        if (data.graphicsBlocks) {
            this.graphicsBlocks = data.graphicsBlocks;
        }
        
        // Обновляем UI
        this.updateGrid();
        this.updateElementsNavigator();
        
        console.log('✅ Settings imported successfully');
    } catch (error) {
        console.error('❌ Failed to import settings:', error);
    }
}
```

---

### Шаг 6: Подключить кнопки в UI (~10 мин)

**Файл:** `script.js`  
**Метод:** `initEventListeners()`

**Добавить обработчики:**
```javascript
// Export settings button
if (this.dom.exportSettingsBtn) {
    this.dom.exportSettingsBtn.addEventListener('click', () => {
        this.exportSettings();
    });
}

// Import settings button
if (this.dom.importSettingsBtn) {
    this.dom.importSettingsBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importSettings(file);
            }
        };
        input.click();
    });
}
```

---

## 🧪 Тестирование

### Чек-лист функций:

- [ ] **Экспорт SVG работает**
  - [ ] Кнопка "Export SVG" создает файл
  - [ ] Размеры в экспорте корректны (mm)
  - [ ] Сетка экспортируется если включена
  - [ ] Текст экспортируется
  - [ ] Графика экспортируется
  - [ ] Нет интерактивных элементов в экспорте

- [ ] **Экспорт настроек работает**
  - [ ] Кнопка "Export Settings" создает JSON
  - [ ] Все настройки сохраняются
  - [ ] Текстовые блоки сохраняются
  - [ ] Графические блоки сохраняются

- [ ] **Импорт настроек работает**
  - [ ] Кнопка "Import Settings" открывает диалог
  - [ ] JSON файл загружается
  - [ ] Настройки применяются
  - [ ] Элементы восстанавливаются
  - [ ] UI обновляется

### Как тестировать:

1. **Запустить сервер:**
```bash
cd grid_generator
python3 -m http.server 8000
```

2. **Открыть в браузере:**
```
http://localhost:8000
```

3. **Протестировать экспорт:**
   - Нажать "Export SVG"
   - Открыть файл в Illustrator/Figma
   - Проверить размеры и содержимое

4. **Протестировать настройки:**
   - Изменить настройки
   - Экспортировать настройки
   - Сбросить настройки
   - Импортировать настройки
   - Проверить восстановление

---

## 📊 Ожидаемый результат

### Код:

**Было:**
- `exportSVG()` — 200 строк в `script.js`
- Логика экспорта смешана с UI

**Стало:**
- `exportSVG()` — 15 строк (вызов модуля)
- `createExportSVG()` — 50 строк (подготовка данных)
- `SVGExporter` — 200 строк в отдельном модуле
- **Чистая экономия:** ~135 строк в `script.js`

### Архитектура:

```
GridGenerator (координация)
  ├─ createExportSVG() → создает SVG с данными
  └─ SVGExporter (модуль)
      ├─ exportToFile() → сериализация и скачивание
      ├─ exportSettings() → сохранение настроек
      └─ importSettings() → загрузка настроек
```

---

## 💾 Бэкапы

### Перед началом:
```bash
mkdir -p _backup/29_iteration_07_start
cp script.js _backup/29_iteration_07_start/
```

### После завершения:
```bash
mkdir -p _backup/30_iteration_07_complete
cp script.js _backup/30_iteration_07_complete/
cp -r src/ _backup/30_iteration_07_complete/
```

---

## 📝 Документация

После завершения обновить:

1. **REFACTORING_PROGRESS.md**
   - Отметить Итерацию 7 как завершенную
   - Обновить статистику

2. **CONTINUE_HERE.md**
   - Обновить прогресс (75% → 87%)
   - Указать следующий шаг (Итерация 8)

3. **Создать ITERATION_07_COMPLETE.md**
   - Описание выполненных работ
   - Результаты тестирования
   - Ссылки на бэкапы

---

## 🎯 Польза Итерации 7

### Что получим:

✅ **Модульность** — экспорт вынесен в отдельный модуль  
✅ **Переиспользование** — SVGExporter можно использовать в других проектах  
✅ **Упрощение** — метод exportSVG() станет в 10 раз короче  
✅ **Новые функции** — экспорт/импорт настроек  
✅ **Тестируемость** — можно тестировать экспорт отдельно  

### Время:

- Интеграция: ~1 час
- Создание createExportSVG(): ~30 мин
- Экспорт/импорт настроек: ~30 мин
- Тестирование: ~1 час
- **ИТОГО: ~3 часа**

---

## 🚀 Готовность

- ✅ Модуль `SVGExporter` создан
- ✅ API продуман
- ✅ План готов
- ✅ Чек-лист тестирования готов
- ✅ Инструкции написаны

**Можно начинать в любой момент!**

---

## 💡 Советы

1. **Начните с простого** — сначала интегрируйте базовый экспорт, потом добавьте настройки
2. **Тестируйте часто** — экспортируйте SVG после каждого изменения
3. **Сохраняйте старый код** — не удаляйте сразу, закомментируйте
4. **Делайте бэкапы** — перед большими изменениями

---

*Документ подготовлен для старта Итерации 7*  
*Все готово к работе! 🚀*

