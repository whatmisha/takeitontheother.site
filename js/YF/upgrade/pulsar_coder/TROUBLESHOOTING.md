# 🔧 Troubleshooting - Pulsar Coder

## Проблема: "Темный экран с одним слайдером"

Если вы видите только темный экран и один элемент управления, попробуйте следующее:

### 1. Жесткая перезагрузка страницы

**Mac:**
```
Cmd + Shift + R
```

**Windows/Linux:**
```
Ctrl + F5
```

Или:
```
Ctrl + Shift + R
```

Это очистит кэш браузера и загрузит свежую версию.

---

### 2. Проверьте правильный URL

Убедитесь что открываете:

```
http://localhost:8888/index.html
```

А не старую версию или другой файл.

---

### 3. Используйте тестовую страницу

Откройте диагностическую страницу:

```
http://localhost:8888/test-interface.html
```

**Что проверяет:**
- ✅ CSS загружается
- ✅ Панель управления видна
- ✅ Элементы работают
- ✅ JavaScript инициализирован

**Если тестовая страница работает:**
→ Значит проблема в основном `index.html`

**Если тестовая страница тоже не работает:**
→ Проблема в браузере или кэше

---

### 4. Очистите кэш браузера полностью

**Chrome:**
1. Откройте DevTools (F12)
2. Правый клик на кнопке обновления
3. Выберите "Empty Cache and Hard Reload"

**Firefox:**
1. Preferences → Privacy & Security
2. Clear Data → Cached Web Content
3. Clear Now

**Safari:**
1. Develop → Empty Caches
2. Или: Cmd + Option + E

---

### 5. Проверьте консоль браузера

1. Откройте DevTools (F12)
2. Перейдите на вкладку "Console"
3. Обновите страницу (Cmd+Shift+R)
4. Смотрите ошибки красным цветом

**Частые ошибки:**

**"Failed to load module":**
→ Проверьте что сервер запущен и работает

**"CORS error":**
→ Убедитесь что открываете через `http://localhost:8888`, а не `file://`

**"404 Not Found":**
→ Проверьте пути к CSS/JS файлам

---

### 6. Проверьте что сервер работает

```bash
curl http://localhost:8888/index.html | head -20
```

Должен вернуть HTML код.

Или откройте в браузере:
```
http://localhost:8888/
```

Должен показать список файлов.

---

### 7. Перезапустите сервер

В терминале:

**Остановите** (Ctrl+C)

**Запустите заново:**
```bash
cd "/Users/mishaivanov/Library/Mobile Documents/com~apple~CloudDocs/Documents/GitHub/takeitontheother.site/js/YF/lunnen/pulsar_coder"
python3 -m http.server 8888
```

---

### 8. Попробуйте другой браузер

Если проблема в одном браузере:
- Chrome → попробуйте Firefox
- Firefox → попробуйте Chrome
- Safari → попробуйте Chrome

---

### 9. Проверьте панель управления не свернута

Возможно панель справа свернута:
- Найдите стрелочку `▼` в заголовке панели
- Кликните на нее чтобы развернуть

---

### 10. Откройте в режиме инкогнито

**Chrome:** Cmd+Shift+N (Mac) / Ctrl+Shift+N (Win)
**Firefox:** Cmd+Shift+P (Mac) / Ctrl+Shift+P (Win)
**Safari:** Cmd+Shift+N

Режим инкогнито не использует кэш.

---

## ✅ Что должно работать

После исправления вы должны видеть:

### Сверху:
- Кнопка "←YF Tools"
- Dropdown "Voyager 14"
- Кнопка "100%" (zoom)

### Справа:
- Панель "Pulsar Coder"
- Поле ввода с текстом: `0° 41'15" / 23° 26'`
- Множество слайдеров (Ray Count, Ray Length, etc.)
- Чекбоксы и кнопки

### В центре:
- Черный фон
- SVG canvas для отображения карты

### Снизу:
- Кнопки: Generate, Verify, Copy, Download

---

## 🐛 Если ничего не помогло

### Шаг 1: Проверьте файлы

```bash
cd "/Users/mishaivanov/Library/Mobile Documents/com~apple~CloudDocs/Documents/GitHub/takeitontheother.site/js/YF/lunnen/pulsar_coder"

ls -la css/yf-styles.css
ls -la pulsar-styles.css
ls -la pulsar-main.js
ls -la js/ui/SliderController.js
```

Все файлы должны существовать.

### Шаг 2: Проверьте размер файлов

```bash
wc -l index.html pulsar-main.js
```

Должно быть:
- `index.html`: ~230+ строк
- `pulsar-main.js`: ~1100+ строк

### Шаг 3: Проверьте содержимое

```bash
grep "0° 41'15" index.html
```

Должно найти новое дефолтное значение.

---

## 📞 Быстрая диагностика

Запустите эту команду:

```bash
cd "/Users/mishaivanov/Library/Mobile Documents/com~apple~CloudDocs/Documents/GitHub/takeitontheother.site/js/YF/lunnen/pulsar_coder" && \
echo "=== DIAGNOSTICS ===" && \
echo "CSS exists: $(test -f css/yf-styles.css && echo YES || echo NO)" && \
echo "JS exists: $(test -f pulsar-main.js && echo YES || echo NO)" && \
echo "Server running: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:8888/ && echo YES || echo NO)" && \
echo "HTML lines: $(wc -l < index.html)" && \
echo "Default value: $(grep -o "0° 41'15" index.html | head -1)"
```

---

## 🎯 Проверочный чек-лист

- [ ] Сервер запущен на порту 8888
- [ ] Открываю `http://localhost:8888/index.html`
- [ ] Нажал Cmd+Shift+R для жесткой перезагрузки
- [ ] Консоль браузера (F12) не показывает ошибок
- [ ] Вижу панель справа с полем ввода
- [ ] Поле содержит: `0° 41'15" / 23° 26'`
- [ ] Вижу несколько слайдеров
- [ ] Вижу кнопки внизу

---

## ✅ Новое дефолтное значение

**Подтверждено:**
```
0° 41'15" / 23° 26'
```

Это значение теперь:
- ✅ В HTML файле
- ✅ В JavaScript settings
- ✅ Отдается сервером
- ✅ Можно редактировать

**Просто обновите страницу с очисткой кэша!**

---

Если проблема сохраняется, опишите подробнее:
1. Какой браузер используете
2. Что видите на экране (скриншот)
3. Какие ошибки в консоли (F12 → Console)


