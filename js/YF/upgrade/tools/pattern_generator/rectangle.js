/**
 * Модуль для генерации паттерна точек в прямоугольнике
 * с использованием алгоритма Blue Noise (отталкивания)
 */
window.rectangleModule = (function() {
    // Элементы управления
    const canvas = document.getElementById('rectangle-canvas');
    const ctx = canvas.getContext('2d');
    
    // Инициализация входных элементов
    const pointCountInput = document.getElementById('rectangle-pointCount');
    const pointCountValue = document.getElementById('rectangle-pointCountValue');
    const ratioInput = document.getElementById('rectangle-ratio');
    const ratioValue = document.getElementById('rectangle-ratioValue');
    const pointSizeInput = document.getElementById('rectangle-pointSize');
    const pointSizeValue = document.getElementById('rectangle-pointSizeValue');
    const iterationsInput = document.getElementById('rectangle-iterations');
    const iterationsValue = document.getElementById('rectangle-iterationsValue');
    const regenerateBtn = document.getElementById('rectangle-regenerateBtn');
    const exportSvgBtn = document.getElementById('rectangle-exportSvgBtn');
    
    // Состояние модуля
    let points = [];
    const width = 400; // Фиксированная ширина прямоугольника
    let ratio = parseFloat(ratioInput.value);
    let height = width / ratio;
    let pointCount = parseInt(pointCountInput.value);
    let pointSize = parseFloat(pointSizeInput.value);
    const pointColor = "#ffffff"; // Фиксированный белый цвет точек
    let iterations = parseInt(iterationsInput.value);
    
    /**
     * Инициализация событий
     */
    function init() {
        // Обработчики событий для элементов управления
        pointCountInput.addEventListener('input', () => {
            pointCount = parseInt(pointCountInput.value);
            pointCountValue.textContent = pointCount;
            generatePoints();
        });
        
        ratioInput.addEventListener('input', () => {
            ratio = parseFloat(ratioInput.value);
            ratioValue.textContent = ratio.toFixed(1);
            height = width / ratio;
            resizeCanvas();
            generatePoints();
        });
        
        pointSizeInput.addEventListener('input', () => {
            pointSize = parseFloat(pointSizeInput.value);
            pointSizeValue.textContent = pointSize;
            drawPoints();
        });
        
        iterationsInput.addEventListener('input', () => {
            iterations = parseInt(iterationsInput.value);
            iterationsValue.textContent = iterations;
            generatePoints();
        });
        
        regenerateBtn.addEventListener('click', generatePoints);
        exportSvgBtn.addEventListener('click', exportSvg);
        
        // Начальная инициализация
        resizeCanvas();
        generatePoints();
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
     * Генерация точек с использованием алгоритма Blue Noise (отталкивания)
     */
    function generatePoints() {
        // Очищаем массив точек
        points = [];
        
        // Сначала генерируем случайные точки в прямоугольнике
        for (let i = 0; i < pointCount; i++) {
            points.push({
                x: Math.random() * width,
                y: Math.random() * height
            });
        }
        
        // Применяем алгоритм отталкивания для оптимизации распределения точек
        if (iterations > 0) {
            for (let iter = 0; iter < iterations; iter++) {
                for (let i = 0; i < points.length; i++) {
                    let forceX = 0;
                    let forceY = 0;
                    
                    for (let j = 0; j < points.length; j++) {
                        if (i !== j) {
                            // Рассчитываем вектор отталкивания
                            const dx = points[i].x - points[j].x;
                            const dy = points[i].y - points[j].y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            // Предотвращаем деление на ноль
                            if (distance > 0) {
                                // Сила отталкивания обратно пропорциональна расстоянию
                                const force = 1 / Math.max(distance, 0.1);
                                forceX += (dx / distance) * force;
                                forceY += (dy / distance) * force;
                            }
                        }
                    }
                    
                    // Применяем силы, ограничивая максимальное смещение
                    const maxMove = Math.min(width, height) * 0.01;
                    const forceLength = Math.sqrt(forceX * forceX + forceY * forceY);
                    
                    if (forceLength > 0) {
                        const scale = Math.min(maxMove / forceLength, 1);
                        points[i].x += forceX * scale;
                        points[i].y += forceY * scale;
                    }
                    
                    // Обеспечиваем, чтобы точки оставались внутри прямоугольника
                    points[i].x = Math.max(0, Math.min(width, points[i].x));
                    points[i].y = Math.max(0, Math.min(height, points[i].y));
                }
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
        link.download = 'rectangle_pattern.svg';
        link.click();
        
        // Очищаем URL
        URL.revokeObjectURL(url);
    }
    
    // Инициализация модуля
    init();
    
    // Публичный API
    return {
        resizeCanvas,
        generatePoints,
        drawPoints
    };
})(); 