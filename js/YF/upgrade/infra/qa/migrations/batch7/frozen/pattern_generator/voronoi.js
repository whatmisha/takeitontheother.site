/**
 * Модуль для генерации паттерна точек с алгоритмом отталкивания (Blue Noise)
 */
window.voronoiModule = (function() {
    // Приватные переменные
    const canvas = document.getElementById('voronoi-canvas');
    const ctx = canvas.getContext('2d');
    
    // Элементы управления
    const pointCountInput = document.getElementById('voronoi-pointCount');
    const radiusInput = document.getElementById('voronoi-radius');
    const pointSizeInput = document.getElementById('voronoi-pointSize');
    const iterationsInput = document.getElementById('voronoi-iterations');
    const regenerateBtn = document.getElementById('voronoi-regenerateBtn');
    const exportSvgBtn = document.getElementById('voronoi-exportSvgBtn');
    
    // Элементы отображения значений
    const pointCountValue = document.getElementById('voronoi-pointCountValue');
    const radiusValue = document.getElementById('voronoi-radiusValue');
    const pointSizeValue = document.getElementById('voronoi-pointSizeValue');
    const iterationsValue = document.getElementById('voronoi-iterationsValue');
    
    // Константа для цвета точек
    const pointColor = "#ffffff";
    
    // Инициализация событий
    function init() {
        // Обновление отображения значений при изменении настроек
        pointCountInput.addEventListener('input', () => {
            pointCountValue.textContent = pointCountInput.value;
            generatePoints();
        });
        
        radiusInput.addEventListener('input', () => {
            radiusValue.textContent = radiusInput.value;
            generatePoints();
        });
        
        pointSizeInput.addEventListener('input', () => {
            pointSizeValue.textContent = pointSizeInput.value;
            drawPoints();
        });
        
        iterationsInput.addEventListener('input', () => {
            iterationsValue.textContent = iterationsInput.value;
            generatePoints();
        });
        
        // Кнопка регенерации
        regenerateBtn.addEventListener('click', generatePoints);
        
        // Кнопка экспорта в SVG
        exportSvgBtn.addEventListener('click', exportAsSvg);
        
        // Инициализация
        resizeCanvas();
        generatePoints();
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
    
    // Генерация точек с алгоритмом отталкивания для равномерного распределения
    function generatePoints() {
        const pointCount = parseInt(pointCountInput.value);
        const radius = parseInt(radiusInput.value);
        const iterations = parseInt(iterationsInput.value);
        
        // Получаем центр канваса
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Инициализируем точки с случайными позициями внутри окружности
        points = [];
        
        // Начинаем с точек, случайно распределенных внутри окружности
        for (let i = 0; i < pointCount; i++) {
            // Используем отбраковку для получения равномерного распределения внутри окружности
            let x, y, distanceFromCenter;
            do {
                // Случайная точка в квадрате
                x = (Math.random() * 2 - 1) * radius;
                y = (Math.random() * 2 - 1) * radius;
                
                // Проверяем, находится ли точка внутри окружности
                distanceFromCenter = Math.sqrt(x * x + y * y);
            } while (distanceFromCenter > radius);
            
            points.push({
                x: centerX + x,
                y: centerY + y
            });
        }
        
        // Применяем алгоритм отталкивания для равномерного распределения (Blue Noise)
        for (let iter = 0; iter < iterations; iter++) {
            // Для каждой точки вычисляем отталкивание от других точек
            for (let i = 0; i < points.length; i++) {
                let fx = 0, fy = 0;
                
                for (let j = 0; j < points.length; j++) {
                    if (i === j) continue;
                    
                    const dx = points[i].x - points[j].x;
                    const dy = points[i].y - points[j].y;
                    
                    // Квадрат расстояния
                    const distSq = dx * dx + dy * dy;
                    
                    // Избегаем деления на ноль
                    if (distSq < 1) continue;
                    
                    // Сила отталкивания обратно пропорциональна расстоянию
                    const force = 100 / distSq;
                    
                    // Накапливаем силы
                    fx += dx * force;
                    fy += dy * force;
                }
                
                // Применяем силу с коэффициентом затухания
                const damping = 0.5 / (iter + 1);
                points[i].x += fx * damping;
                points[i].y += fy * damping;
                
                // Держим точки внутри окружности
                const dx = points[i].x - centerX;
                const dy = points[i].y - centerY;
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                if (distFromCenter > radius) {
                    // Масштабируем обратно к границе окружности
                    points[i].x = centerX + (dx / distFromCenter) * radius;
                    points[i].y = centerY + (dy / distFromCenter) * radius;
                }
            }
        }
        
        drawPoints();
    }
    
    // Отрисовка точек
    function drawPoints() {
        const pointSize = parseFloat(pointSizeInput.value);
        
        // Очистка канваса
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Рисуем все точки
        for (const point of points) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, pointSize, 0, Math.PI * 2);
            ctx.fillStyle = pointColor;
            ctx.fill();
        }
    }
    
    // Экспорт в SVG
    function exportAsSvg() {
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
        link.download = 'voronoi_dots_pattern.svg';
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
        generatePoints,
        drawPoints,
        exportAsSvg
    };
})(); 