# Автоматическая генерация списка пресетов

## ⚠️ ВАЖНО: Включите GitHub Actions в настройках репозитория

Для автоматической работы нужно **ОДИН РАЗ** настроить права в GitHub:

### Шаги:

1. Откройте ваш репозиторий на GitHub: https://github.com/ВАШ_USERNAME/takeitontheother.site
2. Перейдите в **Settings** (настройки)
3. Слева выберите **Actions** → **General**
4. Прокрутите вниз до раздела **"Workflow permissions"**
5. Выберите **"Read and write permissions"** (вместо "Read repository contents and packages permissions")
6. Нажмите **Save**

**Без этого GitHub Actions не сможет автоматически коммитить manifest.json!**

---

## Как это работает

Список пресетов генерируется **автоматически через GitHub Actions**.

### Что происходит при пуше на GitHub:

1. GitHub Actions обнаруживает изменения в папке `presets/`
2. Запускается workflow (`.github/workflows/generate-presets.yml`)
3. Скрипт `generate-presets-manifest.js` сканирует папку `presets/`
4. Создаётся обновлённый файл `presets/manifest.json`
5. Файл автоматически коммитится и пушится обратно в репозиторий
6. Netlify обнаруживает новый коммит и публикует обновлённый сайт

**Структура сайта остаётся прежней!** Все проекты доступны по старым ссылкам:
- `https://takeitontheother.site/js/YF/lunnen/grid_generator/`
- `https://takeitontheother.site/js/YF/` и т.д.

---

## Что делать после добавления нового пресета:

### Вариант 1: Автоматически (если настроили права GitHub Actions)

1. Добавьте новый `.json` файл в папку `presets/`
2. Запушьте:
   ```bash
   git add .
   git commit -m "Добавлен новый пресет"
   git push
   ```
3. **GitHub Actions автоматически обновит manifest.json**
4. Netlify автоматически опубликует обновлённый сайт

### Вариант 2: Вручную (если GitHub Actions не настроен)

1. Добавьте новый `.json` файл в папку `presets/`
2. Обновите manifest.json:
   ```bash
   cd js/YF/lunnen/grid_generator
   npm run presets
   ```
3. Запушьте всё:
   ```bash
   git add .
   git commit -m "Добавлен новый пресет"
   git push
   ```

---

## Проверка работы GitHub Actions

После пуша на GitHub:
1. Откройте репозиторий на GitHub
2. Перейдите на вкладку **Actions**
3. Найдите workflow "Auto-generate Presets Manifest"
4. Проверьте, что он запустился и завершился успешно (зелёная галочка ✅)

Если workflow провалился ❌ — проверьте права в настройках (см. выше).

---

## Важные файлы

- **`.github/workflows/generate-presets.yml`** — GitHub Actions workflow
- **`generate-presets-manifest.js`** — скрипт генерации manifest.json
- **`package.json`** — команда `npm run presets`

---

## Что изменилось

✅ Удалён `netlify.toml` (он ломал структуру сайта)  
✅ Создан GitHub Actions workflow с правами на запись  
✅ manifest.json обновляется автоматически ДО публикации  
✅ Структура сайта не меняется, все ссылки работают  

---

## Текущее состояние

📊 **Пресетов в manifest.json: 8**
- GREEN
- Ground 10.4" Back
- Ground 14" Back  
- Ground 8.4" Back
- Outer 16" Back
- Outer 16" Front
- Template 500×500×50mm, Module 5mm
- RED
