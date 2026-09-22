/**
 * Модуль для генерации паттерна точек по алгоритму Фибоначчи (Золотое сечение)
 */
window.fibonacciModule = (function() {
    // Приватные переменные
    const canvas = document.getElementById('fibonacci-canvas');
    const ctx = canvas.getContext('2d');
    
    // Элементы управления
    const pointCountInput = document.getElementById('fibonacci-pointCount');
    const radiusInput = document.getElementById('fibonacci-radius');
    const pointSizeInput = document.getElementById('fibonacci-pointSize');
    const spiralFactorInput = document.getElementById('fibonacci-spiralFactor');
    const resetBtn = document.getElementById('fibonacci-resetBtn');
    const exportSvgBtn = document.getElementById('fibonacci-exportSvgBtn');
    
    // Элементы отображения значений
    const pointCountValue = document.getElementById('fibonacci-pointCountValue');
    const radiusValue = document.getElementById('fibonacci-radiusValue');
    const pointSizeValue = document.getElementById('fibonacci-pointSizeValue');
    const spiralFactorValue = document.getElementById('fibonacci-spiralFactorValue');
    
    // Исходные значения настроек
    const defaultSettings = {
        pointCount: 300,
        radius: 250,
        pointSize: 3,
        spiralFactor: 1
    };
    
    // Константа для цвета точек
    const pointColor = "#ffffff";
    
    // Инициализация событий
    function init() {
        // Обновление отображения значений при изменении настроек
        pointCountInput.addEventListener('input', () => {
            pointCountValue.textContent = pointCountInput.value;
            generatePattern();
        });
        
        radiusInput.addEventListener('input', () => {
            radiusValue.textContent = radiusInput.value;
            generatePattern();
        });
        
        pointSizeInput.addEventListener('input', () => {
            pointSizeValue.textContent = pointSizeInput.value;
            drawPoints();
        });
        
        spiralFactorInput.addEventListener('input', () => {
            spiralFactorValue.textContent = spiralFactorInput.value;
            generatePattern();
        });
        
        // Кнопка сброса настроек
        resetBtn.addEventListener('click', resetSettings);
        
        // Кнопка экспорта в SVG
        exportSvgBtn.addEventListener('click', exportAsSvg);
        
        // Инициализация
        resizeCanvas();
        generatePattern();
    }
    
    // Массив точек
    let points = [];
    
    // Установка размеров канваса
    function resizeCanvas() {
        const containerWidth = document.querySelector('.content-wrapper').clientWidth;
        const maxWidth = containerWidth - 400; // Отступ для панели управления
        const maxHeight = window.innerHeight - 150;
        const size = Math.min(maxWidth, maxHeight);
        
        canvas.width = size;
        canvas.height = size;
        
        // Подгоняем радиус под размер канваса
        const maxRadius = Math.floor(size / 2) - 10;
        if (parseInt(radiusInput.value) > maxRadius) {
            radiusInput.value = maxRadius;
            radiusValue.textContent = maxRadius;
        }
    }
    
    // Генерация паттерна по алгоритму Фибоначчи
    function generatePattern() {
        const pointCount = parseInt(pointCountInput.value);
        const radius = parseInt(radiusInput.value);
        const spiralFactor = parseFloat(spiralFactorInput.value);
        
        // Точно вычисляем центр канваса
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Константа золотого угла в радианах (приблизительно 137.5 градусов)
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        
        // Создаем массив точек
        points = [];
        
        // Первая точка всегда в центре
        points.push({x: centerX, y: centerY});
        
        // Генерируем остальные точки
        for (let i = 1; i < pointCount; i++) {
            // Вычисляем угол с использованием золотого угла
            const angle = i * goldenAngle * spiralFactor;
            
            // Вычисляем расстояние от центра, используя квадратный корень для равномерного распределения
            const normalizedIndex = i / (pointCount - 1);
            const distance = radius * Math.sqrt(normalizedIndex);
            
            // Вычисляем координаты точки
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // Добавляем точку
            points.push({x, y});
        }
        
        // Рисуем точки
        drawPoints();
    }
    
    // Отрисовка точек
    function drawPoints() {
        const pointSize = parseFloat(pointSizeInput.value);
        
        // Очистка канваса
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Рисуем все точки
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, pointSize, 0, Math.PI * 2);
            ctx.fillStyle = pointColor;
            ctx.fill();
        });
    }
    
    // Сброс настроек к исходным значениям
    function resetSettings() {
        pointCountInput.value = defaultSettings.pointCount;
        radiusInput.value = defaultSettings.radius;
        pointSizeInput.value = defaultSettings.pointSize;
        spiralFactorInput.value = defaultSettings.spiralFactor;
        
        // Обновляем отображаемые значения
        pointCountValue.textContent = defaultSettings.pointCount;
        radiusValue.textContent = defaultSettings.radius;
        pointSizeValue.textContent = defaultSettings.pointSize;
        spiralFactorValue.textContent = defaultSettings.spiralFactor;
        
        // Обновляем паттерн
        generatePattern();
    }
    
    // Экспорт в SVG
    function exportAsSvg() {
        const pointCount = parseInt(pointCountInput.value);
        const pointSize = parseFloat(pointSizeInput.value);
        
        // Определяем размеры SVG
        const width = canvas.width;
        const height = canvas.height;
        
        // Создаем SVG элемент
        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background-color: black;">`;
        
        // Добавляем точки
        points.forEach(point => {
            svg += `<circle cx="${point.x}" cy="${point.y}" r="${pointSize}" fill="${pointColor}" />`;
        });
        
        // Закрываем SVG
        svg += '</svg>';
        
        // Создаем Blob и URL для скачивания
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        // Создаем временную ссылку для скачивания
        const link = document.createElement('a');
        link.href = url;
        link.download = 'fibonacci_dots_pattern.svg';
        document.body.appendChild(link);
        link.click();
        
        // Очистка
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    // Инициализация модуля
    init();
    
    // Публичный API
    return {
        resizeCanvas,
        generatePattern,
        drawPoints,
        resetSettings,
        exportAsSvg
    };
})(); 