/**
 * Модуль для генерации паттерна Фибоначчи в прямоугольнике
 */
window.fibonacciRectModule = (function() {
    // Приватные переменные
    const canvas = document.getElementById('fibonacci-rect-canvas');
    const ctx = canvas.getContext('2d');
    
    // Элементы управления
    const pointCountInput = document.getElementById('fibonacci-rect-pointCount');
    const pointCountValue = document.getElementById('fibonacci-rect-pointCountValue');
    const ratioInput = document.getElementById('fibonacci-rect-ratio');
    const ratioValue = document.getElementById('fibonacci-rect-ratioValue');
    const pointSizeInput = document.getElementById('fibonacci-rect-pointSize');
    const pointSizeValue = document.getElementById('fibonacci-rect-pointSizeValue');
    const spiralFactorInput = document.getElementById('fibonacci-rect-spiralFactor');
    const spiralFactorValue = document.getElementById('fibonacci-rect-spiralFactorValue');
    const resetBtn = document.getElementById('fibonacci-rect-resetBtn');
    const exportSvgBtn = document.getElementById('fibonacci-rect-exportSvgBtn');
    
    // Состояние модуля
    let points = [];
    const width = 400; // Фиксированная ширина прямоугольника
    let ratio = parseFloat(ratioInput.value);
    let height = width / ratio;
    let pointCount = parseInt(pointCountInput.value);
    let pointSize = parseFloat(pointSizeInput.value);
    const pointColor = "#ffffff"; // Фиксированный белый цвет точек
    let spiralFactor = parseFloat(spiralFactorInput.value);
    
    // Исходные значения настроек
    const defaultSettings = {
        pointCount: 300,
        ratio: 2.0,
        pointSize: 3,
        spiralFactor: 1
    };
    
    /**
     * Инициализация событий
     */
    function init() {
        // Обработчики событий для элементов управления
        pointCountInput.addEventListener('input', () => {
            pointCount = parseInt(pointCountInput.value);
            pointCountValue.textContent = pointCount;
            generatePattern();
        });
        
        ratioInput.addEventListener('input', () => {
            ratio = parseFloat(ratioInput.value);
            ratioValue.textContent = ratio.toFixed(1);
            height = width / ratio;
            resizeCanvas();
            generatePattern();
        });
        
        pointSizeInput.addEventListener('input', () => {
            pointSize = parseFloat(pointSizeInput.value);
            pointSizeValue.textContent = pointSize;
            drawPoints();
        });
        
        spiralFactorInput.addEventListener('input', () => {
            spiralFactor = parseFloat(spiralFactorInput.value);
            spiralFactorValue.textContent = spiralFactor.toFixed(2);
            generatePattern();
        });
        
        resetBtn.addEventListener('click', resetSettings);
        exportSvgBtn.addEventListener('click', exportSvg);
        
        // Начальная инициализация
        resizeCanvas();
        generatePattern();
    }
    
    /**
     * Изменение размера холста
     */
    function resizeCanvas() {
        const containerWidth = document.querySelector('.content-wrapper').clientWidth;
        const maxWidth = containerWidth - 400; // Отступ для панели управления
        const maxHeight = window.innerHeight - 150;
        const size = Math.min(maxWidth, maxHeight);
        
        // Определяем размеры холста с учетом соотношения сторон
        const canvasWidth = size;
        const canvasHeight = size / ratio;
        
        // Устанавливаем размеры холста
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Перерисовываем холст
        drawPoints();
    }
    
    /**
     * Генерация паттерна Фибоначчи для прямоугольника
     */
    function generatePattern() {
        // Очищаем массив точек
        points = [];
        
        // Константа золотого угла в радианах (приблизительно 137.5 градусов)
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        
        // Центр прямоугольника
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Первая точка всегда в центре
        points.push({x: centerX, y: centerY});
        
        // Генерируем остальные точки
        for (let i = 1; i < pointCount; i++) {
            // Нормализованный индекс для равномерного распределения
            const normalizedIndex = i / (pointCount - 1);
            
            // Вычисляем угол с использованием золотого угла
            const angle = i * goldenAngle * spiralFactor;
            
            // Направляющий вектор луча
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            
            // Находим расстояние до границы прямоугольника в направлении луча
            // Рассчитываем множители для каждой границы
            let tx = dx === 0 ? Infinity : dx > 0 ? (width - centerX) / dx : -centerX / dx;
            let ty = dy === 0 ? Infinity : dy > 0 ? (height - centerY) / dy : -centerY / dy;
            
            // Выбираем минимальное положительное значение - это будет расстояние до границы
            const borderDistance = Math.min(
                tx > 0 ? tx : Infinity,
                ty > 0 ? ty : Infinity
            );
            
            // Рассчитываем расстояние для текущей точки
            // Используем квадратный корень для более равномерного распределения
            const distance = borderDistance * Math.sqrt(normalizedIndex);
            
            // Вычисляем координаты точки
            const x = centerX + dx * distance;
            const y = centerY + dy * distance;
            
            // Добавляем точку, если она внутри прямоугольника
            // (это страховка от погрешностей вычислений)
            if (x >= 0 && x <= width && y >= 0 && y <= height) {
                points.push({x, y});
            }
        }
        
        // Рисуем точки
        drawPoints();
    }
    
    /**
     * Отрисовка точек на холсте
     */
    function drawPoints() {
        // Очищаем холст
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Рисуем рамку прямоугольника
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // Масштабируем для отображения на холсте
        const scaleX = canvas.width / width;
        const scaleY = canvas.height / height;
        
        // Рисуем каждую точку
        ctx.fillStyle = pointColor;
        
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(
                point.x * scaleX, 
                point.y * scaleY, 
                pointSize, 
                0, 
                Math.PI * 2
            );
            ctx.fill();
        });
    }
    
    /**
     * Сброс настроек к исходным значениям
     */
    function resetSettings() {
        pointCountInput.value = defaultSettings.pointCount;
        ratioInput.value = defaultSettings.ratio;
        pointSizeInput.value = defaultSettings.pointSize;
        spiralFactorInput.value = defaultSettings.spiralFactor;
        
        // Обновляем отображаемые значения
        pointCountValue.textContent = defaultSettings.pointCount;
        ratioValue.textContent = defaultSettings.ratio.toFixed(1);
        pointSizeValue.textContent = defaultSettings.pointSize;
        spiralFactorValue.textContent = defaultSettings.spiralFactor.toFixed(2);
        
        // Обновляем переменные
        pointCount = defaultSettings.pointCount;
        ratio = defaultSettings.ratio;
        height = width / ratio;
        pointSize = defaultSettings.pointSize;
        spiralFactor = defaultSettings.spiralFactor;
        
        // Обновляем холст и паттерн
        resizeCanvas();
        generatePattern();
    }
    
    /**
     * Экспорт паттерна в формате SVG
     */
    function exportSvg() {
        // Создаем SVG элемент
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNamespace, 'svg');
        
        // Устанавливаем атрибуты SVG
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        
        // Добавляем каждую точку как круг
        points.forEach(point => {
            const circle = document.createElementNS(svgNamespace, 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', pointSize);
            circle.setAttribute('fill', pointColor);
            svg.appendChild(circle);
        });
        
        // Преобразуем SVG в строку
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        
        // Создаем URL для скачивания
        const url = URL.createObjectURL(svgBlob);
        
        // Создаем ссылку для скачивания и активируем её
        const link = document.createElement('a');
        link.href = url;
        link.download = 'fibonacci_rectangle_pattern.svg';
        link.click();
        
        // Очищаем URL
        URL.revokeObjectURL(url);
    }
    
    // Инициализация модуля
    init();
    
    // Публичный API
    return {
        resizeCanvas,
        generatePattern,
        drawPoints,
        resetSettings,
        exportSvg
    };
})(); 