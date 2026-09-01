# Network policy

Runtime-код восьми инструментов по умолчанию работает только с файлами внутри `upgrade`.

Единственное разрешённое внешнее подключение — явный импорт данных из Google Sheets в Sticky Fingers. Пользователь сам вводит или выбирает URL таблицы; приложение запрашивает CSV только у `docs.google.com`.

Paper.js, jsPDF, svg2pdf.js, opentype.js и CoFo Sans закреплены локально в `framework/vendor` и `framework/fonts`. Их размеры и SHA-256 проверяет `npm run assets:check`.

Directory listing и GitHub API fallback для пресетов Sticky Fingers не используются: `label_generator/presets/manifest.json` является единственным реестром встроенных пресетов.
