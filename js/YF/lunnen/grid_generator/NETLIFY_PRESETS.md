# Автоматическая генерация списка пресетов на Netlify

## Как это работает

При публикации на Netlify список пресетов генерируется **автоматически**.

### Что происходит при деплое:

1. Netlify читает файл `netlify.toml` в **корне репозитория** (не в папке grid_generator!)
2. Переходит в папку `js/YF/lunnen/grid_generator/` (указана в параметре `base`)
3. Запускает команду `node generate-presets-manifest.js`
4. Скрипт сканирует папку `presets/` и находит все `.json` файлы
5. Создаётся файл `presets/manifest.json` со списком всех найденных пресетов
6. Сайт grid_generator публикуется с актуальным списком

### Что делать после добавления нового пресета:

**Ничего!** Просто:
1. Добавьте новый `.json` файл в папку `js/YF/lunnen/grid_generator/presets/`
2. Запушьте изменения на GitHub:
   ```bash
   git add .
   git commit -m "Добавлен новый пресет"
   git push
   ```
3. Netlify автоматически обновит список пресетов при деплое

### Если хотите проверить manifest.json локально:

```bash
cd js/YF/lunnen/grid_generator
npm run presets
```

или

```bash
cd js/YF/lunnen/grid_generator
node generate-presets-manifest.js
```

Это обновит `presets/manifest.json` на вашем компьютере.

---

## Важные файлы

### В корне репозитория:
- **netlify.toml** — главный конфиг для Netlify (указывает путь к проекту)

### В папке js/YF/lunnen/grid_generator/:
- **generate-presets-manifest.js** — скрипт генерации manifest.json
- **package.json** — в нём есть команда `npm run presets`

---

## Важно

⚠️ **netlify.toml должен быть в КОРНЕ репозитория**, а не в папке grid_generator!

❗ Файл `presets/manifest.json` можно коммитить в Git, но он всё равно будет перегенерирован при каждом деплое на Netlify, так что если вы его забудете обновить локально — не страшно.

---

## Что было сделано

1. Создан `netlify.toml` в корне репозитория с параметром `base = "js/YF/lunnen/grid_generator"`
2. Настроена команда сборки: `command = "node generate-presets-manifest.js"`
3. Теперь при каждом пуше на GitHub, Netlify автоматически обновляет список пресетов
