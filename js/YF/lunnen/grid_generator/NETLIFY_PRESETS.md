# Автоматическая генерация списка пресетов

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

### Что делать после добавления нового пресета:

**Ничего!** Просто:
1. Добавьте новый `.json` файл в папку `presets/`
2. Запушьте изменения на GitHub:
   ```bash
   git add .
   git commit -m "Добавлен новый пресет"
   git push
   ```
3. GitHub Actions автоматически обновит `manifest.json`
4. Netlify автоматически опубликует обновлённый сайт

### Если хотите проверить manifest.json локально:

```bash
npm run presets
```

или

```bash
node generate-presets-manifest.js
```

---

## Важные файлы

- **`.github/workflows/generate-presets.yml`** — GitHub Actions workflow (в корне репозитория)
- **`generate-presets-manifest.js`** — скрипт генерации manifest.json
- **`package.json`** — в нём есть команда `npm run presets`

---

## Важно

✅ Структура сайта НЕ меняется  
✅ Netlify просто публикует весь репозиторий как есть  
✅ GitHub Actions обновляет только `manifest.json`  
✅ Всё работает автоматически

❗ Файл `presets/manifest.json` коммитится автоматически через GitHub Actions

---

## Как это настроено

1. При пуше в `main` ветку GitHub Actions запускает workflow
2. Workflow запускает `node generate-presets-manifest.js`
3. Если `manifest.json` изменился, он автоматически коммитится
4. Netlify видит новый коммит и публикует сайт
5. Готово! Все ссылки работают как раньше.
