# Presets Auto-Generator Scripts

Автоматически сканирует папку `presets/` и создаёт `manifest.json` со списком всех пресетов.

## Зачем это нужно?

При добавлении нового пресета в папку `presets/`, браузер не может автоматически увидеть новые файлы. Эти скрипты решают проблему:

1. Сканируют папку `presets/`
2. Находят все `.json` файлы (кроме `manifest.json`)
3. Автоматически генерируют `manifest.json`
4. Используют имя файла как название пресета в интерфейсе

## Быстрый старт

### Вариант 1: Python (Рекомендуется)

```bash
python3 generate-presets-manifest.py
```

### Вариант 2: Node.js

```bash
npm run presets
# или
node generate-presets-manifest.js
```

### Вариант 3: Shell скрипт (универсальный)

```bash
./UPDATE_PRESETS.sh
```

Скрипт автоматически определит, что доступно (Python или Node.js) и запустит нужный вариант.

## Рабочий процесс

### Добавление нового пресета:

1. **Создайте макет** в Pizza Boxer
2. **Экспортируйте** через "Export Settings"
3. **Переименуйте** файл (например, `Product Name.json`)
4. **Переместите** в папку `presets/`
5. **Запустите скрипт**:
   ```bash
   python3 generate-presets-manifest.py
   ```
6. **Обновите** страницу в браузере

### Результат:
- Новый пресет появится в выпадающем списке
- Имя в интерфейсе = имя файла (без .json)

## Что делает скрипт?

### Python версия (`generate-presets-manifest.py`):
- ✅ Не требует установки зависимостей
- ✅ Работает на Mac/Linux/Windows
- ✅ Python 3 обычно предустановлен

### Node.js версия (`generate-presets-manifest.js`):
- ✅ Идентичная функциональность
- ⚠️ Требует установленный Node.js

### Обе версии:
- Сканируют папку `presets/`
- Читают каждый JSON файл
- Извлекают название (используют имя файла)
- Создают `manifest.json` с метаданными
- Сортируют пресеты по алфавиту

## Формат manifest.json

Генерируется автоматически:

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

## Логика определения имён

1. **Если имя файла осмысленное** (не `grid-settings...`):
   - Используется имя файла → `"Outer 16\" Back.json"` → `"Outer 16\" Back"`

2. **Если файл называется generic** (`grid-settings_...`):
   - Используется `presetName` из JSON файла

3. **Если имена дублируются**:
   - Добавляется номер → `"Product (2)"`

## Требования

### Python версия:
- Python 3.6+
- Стандартные библиотеки (json, os, pathlib, datetime)

### Node.js версия:
- Node.js 12+
- Стандартные модули (fs, path)

## Использование в команде

### Один человек настраивает пресеты:
```bash
# После добавления новых пресетов
python3 generate-presets-manifest.py
git add presets/
git commit -m "Add new presets"
git push
```

### Другие получают обновления:
```bash
git pull
# Обновить страницу в браузере
```

## Автоматизация (опционально)

### Git Hook (автоматический запуск при коммите)

Создайте `.git/hooks/pre-commit`:

```bash
#!/bin/bash
python3 generate-presets-manifest.py
git add presets/manifest.json
```

### GitHub Actions (CI/CD)

```yaml
name: Update Presets Manifest
on:
  push:
    paths:
      - 'presets/*.json'
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Generate manifest
        run: python3 generate-presets-manifest.py
      - name: Commit changes
        run: |
          git config --local user.name "GitHub Action"
          git add presets/manifest.json
          git commit -m "Auto-update presets manifest" || true
          git push
```

## Устранение проблем

### Скрипт не запускается

**Python:**
```bash
# Проверить установку
python3 --version

# Если нет Python
# Mac: brew install python3
# Ubuntu: sudo apt install python3
```

**Node.js:**
```bash
# Проверить установку
node --version

# Если нет Node.js
# Mac: brew install node
# Ubuntu: sudo apt install nodejs
```

### Пресеты не появляются

1. Убедитесь, что скрипт выполнился успешно
2. Проверьте `presets/manifest.json` - файл должен обновиться
3. Обновите страницу в браузере (Cmd+R / Ctrl+R)
4. Проверьте консоль браузера на ошибки

### Неправильные имена пресетов

- Имя берётся из названия файла
- Переименуйте файл и запустите скрипт снова
- Если нужно custom имя - добавьте вручную в manifest.json

## Производительность

- ⚡ Очень быстро даже для сотен пресетов
- 📦 Пример: 100 пресетов = ~0.1 секунды
- 💾 Размер manifest.json: ~50 байт на пресет

## Совместимость

- ✅ macOS
- ✅ Linux  
- ✅ Windows (с Python/Node.js)
- ✅ Работает в CI/CD
- ✅ Работает на любом сервере

---

**Вопросы?** См. `HOW_TO_ADD_PRESETS.md` или `presets/README.md`



