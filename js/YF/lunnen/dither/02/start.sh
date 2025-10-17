#!/bin/bash

# Скрипт для запуска локального веб-сервера
# Запускайте: ./start.sh

echo "🚀 Запуск локального веб-сервера..."
echo "📂 Директория: $(pwd)"
echo ""
echo "✨ Откройте в браузере: http://localhost:8000"
echo ""
echo "⏹️  Для остановки нажмите Ctrl+C"
echo ""

python3 -m http.server 8000

