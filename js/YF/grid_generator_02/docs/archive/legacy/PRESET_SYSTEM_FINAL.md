# Preset System — Final Implementation

## 🎯 Проблема

Нужна система пресетов, которая:
1. ✅ Сохраняет **ВСЮ** информацию из макета (размеры, сетка, текст, графика, позиции)
2. ✅ **Автоматически обнаруживает** новые файлы в папке presets
3. ✅ Имеет **красивый UI** - дропдаун в стиле кнопки YF Tools

## ✅ Решение

### 1. Полный формат данных
- Пресеты = те же файлы, что генерирует "Export Settings"
- Содержат ВСЁ: settings, textBlocks, graphicsBlocks, icons, claim
- Ничего не теряется при загрузке

### 2. Автоматическое обнаружение
- **Скрипт-генератор** сканирует папку `presets/`
- Создаёт `manifest.json` автоматически
- Имя пресета = имя файла (без .json)

### 3. Красивый UI
- Серая скругленная плашка (как YF Tools)
- Без лейбла, без обводки
- Первый пресет загружается автоматически
- Dropdown со стрелочкой вниз

## 📂 Структура

```
grid_generator/
├── presets/
│   ├── manifest.json          ← генерируется автоматически
│   ├── Outer 16" Back.json    ← ваш пресет
│   ├── Brutal.json            ← ваш пресет
│   └── README.md
├── generate-presets-manifest.py   ← скрипт Python
├── generate-presets-manifest.js   ← скрипт Node.js
├── UPDATE_PRESETS.sh              ← универсальный запускатор
├── HOW_TO_ADD_PRESETS.md          ← краткая инструкция
└── PRESETS_SCRIPTS_README.md      ← полная документация скриптов
```

## 🚀 Рабочий процесс

### Добавление нового пресета:

```bash
# 1. Создать макет в Pizza Boxer
# 2. Export Settings → получить JSON файл

# 3. Переименовать и переместить
mv grid-settings_*.json presets/"My New Product.json"

# 4. Запустить генератор
python3 generate-presets-manifest.py
# или
./UPDATE_PRESETS.sh

# 5. Обновить браузер
# Готово! Пресет появился в дропдауне
```

### Результат:
- ✅ Пресет "My New Product" в списке
- ✅ Все настройки, текст, графика загружаются
- ✅ UI обновляется автоматически

## 💻 Технические детали

### Скрипт-генератор

**Python версия** (рекомендуется):
```bash
python3 generate-presets-manifest.py
```

**Node.js версия**:
```bash
npm run presets
```

**Что делает:**
1. Сканирует `presets/*.json` (кроме manifest.json)
2. Для каждого файла:
   - Читает JSON
   - Берёт имя из filename (или presetName)
   - Добавляет в список
3. Сортирует по алфавиту
4. Записывает `manifest.json`

### Формат manifest.json

```json
{
  "presets": [
    {
      "name": "Brutal",
      "file": "Brutal.json"
    },
    {
      "name": "Outer 16\" Back",
      "file": "Outer 16\" Back.json"
    }
  ],
  "generated": "2025-11-14T23:01:59.013918",
  "count": 2
}
```

### Загрузка пресета (JavaScript)

```javascript
// 1. Загрузить manifest.json
const manifest = await fetch('presets/manifest.json').json();

// 2. Заполнить dropdown
manifest.presets.forEach(preset => {
    dropdown.add(new Option(preset.name, preset.file));
});

// 3. Загрузить первый пресет по умолчанию
await loadPreset(manifest.presets[0].file);

// 4. При выборе - загрузить выбранный
dropdown.onchange = () => loadPreset(dropdown.value);
```

## 🎨 UI Компоненты

### Дропдаун (CSS)

```css
.preset-select {
    padding: 8px 15px;
    background: #1a1a1a;        /* серая плашка */
    border: none;               /* без обводки */
    border-radius: 20px;        /* скругление */
    font-size: 0.9rem;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
}
```

### Стрелка (SVG в CSS)

```css
background-image: url("data:image/svg+xml,...");
background-position: right 15px center;
```

## 📖 Документация

### Для пользователей:
- **`HOW_TO_ADD_PRESETS.md`** - пошаговая инструкция (5 минут)

### Для разработчиков:
- **`PRESETS_SCRIPTS_README.md`** - документация скриптов
- **`presets/README.md`** - полная документация системы
- **`PRESET_SYSTEM_FINAL.md`** - этот файл (обзор)

## ✨ Преимущества решения

### Для пользователя:
1. ✅ Просто бросить файл в папку
2. ✅ Запустить один скрипт
3. ✅ Обновить браузер
4. ✅ Всё работает

### Для разработчика:
1. ✅ Нет ручного редактирования JSON
2. ✅ Нет копипасты
3. ✅ Нет ошибок в именах файлов
4. ✅ Автоматическая сортировка

### Для команды:
1. ✅ Единый формат пресетов
2. ✅ Версионность в git
3. ✅ Можно автоматизировать (CI/CD)
4. ✅ Легко делиться пресетами

## 🔧 Расширенные возможности

### Автоматизация с Git

**.git/hooks/pre-commit:**
```bash
#!/bin/bash
python3 generate-presets-manifest.py
git add presets/manifest.json
```

### CI/CD с GitHub Actions

```yaml
on:
  push:
    paths: ['presets/*.json']
jobs:
  update-manifest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: python3 generate-presets-manifest.py
      - run: git commit -am "Update manifest" && git push
```

### Валидация пресетов

```python
# Добавить в скрипт проверку формата
def validate_preset(data):
    required = ['version', 'dimensions', 'grid', 'colors']
    return all(key in data for key in required)
```

## 🎓 Примеры использования

### Проект с несколькими продуктами

```
presets/
├── manifest.json
├── Product A - Front.json
├── Product A - Back.json
├── Product A - Side.json
├── Product B - Small.json
├── Product B - Large.json
└── Product C - Special.json
```

### Версионирование дизайна

```
presets/
├── manifest.json
├── Outer 16 - v1.json
├── Outer 16 - v2.json
├── Outer 16 - v3 (current).json
└── Outer 16 - experimental.json
```

## 🐛 Решение проблем

### Пресет не появляется

```bash
# 1. Проверить, что файл в правильной папке
ls presets/

# 2. Запустить генератор
python3 generate-presets-manifest.py

# 3. Проверить manifest.json
cat presets/manifest.json

# 4. Обновить браузер (Cmd+R)
```

### Неправильное имя

```bash
# Переименовать файл
mv "presets/old name.json" "presets/New Name.json"

# Перегенерировать
python3 generate-presets-manifest.py
```

## 🎯 Итоговые метрики

- ✅ **100%** данных сохраняется
- ✅ **0** ручных правок JSON
- ✅ **5** секунд на добавление пресета
- ✅ **2** команды (переместить + скрипт)
- ✅ **Бесконечное** количество пресетов

## 🚀 Что дальше?

### Возможные улучшения:
1. **Web UI** для управления пресетами
2. **Превью** пресетов (скриншоты)
3. **Теги** для категоризации
4. **Поиск** по пресетам
5. **Избранное**
6. **История** использования
7. **Экспорт в другие форматы**
8. **Облачное хранилище**

---

**Статус:** ✅ Production Ready  
**Версия:** 1.10  
**Дата:** 14 ноября 2025  
**Автор:** Pizza Boxer Team




