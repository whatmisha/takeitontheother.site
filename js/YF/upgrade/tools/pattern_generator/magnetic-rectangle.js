/**
 * Модуль Diagonal Grid
 */
(function() {
    // Переменные для хранения параметров
    let canvas, ctx;
    let canvasWidth = 800;   // Ширина холста
    let canvasHeight = 800;  // Высота холста
    
    // Параметры для сетки
    let lineLength = 15;        // Длина линий (px)
    let lineWidth = 1;          // Толщина линий (px)
    let cellSpacing = 25;       // Расстояние между ячейками (px)
    let lineAngle = 45;         // Угол наклона линий (в градусах)
    let roundedLineCaps = false; // Скругление концов линий
    let segments = [];          // Массив сегментов
    
    // Параметры для магнитного эффекта
    let magneticForce = 50;     // Сила магнитного поля (0-100)
    let magneticRadius = 200;   // Радиус действия магнитного поля (px)
    let mouseX = -1000;         // Начальная позиция курсора за пределами холста
    let mouseY = -1000;
    let isMouseOverCanvas = false; // Флаг нахождения курсора над холстом
    
    // Минимальный радиус магнитного поля
    const MIN_MAGNETIC_RADIUS = 1;
    
    // Минимальная и максимальная сила магнитного поля
    const MIN_MAGNETIC_FORCE = 0;
    const MAX_MAGNETIC_FORCE = 100;
    
    // Массив магнитных точек и история для отмены
    let magneticPoints = [];
    let pointsHistory = []; // История состояний массива точек для отмены действий
    
    /**
     * Интерполирует между двумя углами по кратчайшему пути
     * @param {number} a1 - Первый угол в радианах
     * @param {number} a2 - Второй угол в радианах
     * @param {number} t - Коэффициент интерполяции от 0 до 1
     * @returns {number} - Интерполированный угол в радианах
     */
    function interpolateAngles(a1, a2, t) {
        return interpolateAnglesAlternative(a1, a2, t);
    }
    
    /**
     * Альтернативный метод интерполяции углов - через разложение на компоненты
     * @param {number} a1 - Первый угол в радианах
     * @param {number} a2 - Второй угол в радианах
     * @param {number} t - Коэффициент интерполяции от 0 до 1
     * @returns {number} - Интерполированный угол в радианах
     */
    function interpolateAnglesAlternative(a1, a2, t) {
        // Преобразуем углы в компоненты векторов направления
        const x1 = Math.cos(a1);
        const y1 = Math.sin(a1);
        
        const x2 = Math.cos(a2);
        const y2 = Math.sin(a2);
        
        // Интерполируем компоненты
        const x = x1 * (1 - t) + x2 * t;
        const y = y1 * (1 - t) + y2 * t;
        
        // Преобразуем обратно в угол
        return Math.atan2(y, x);
    }
    
    /**
     * Инициализация модуля
     */
    function initialize() {
        // Получаем ссылки на DOM-элементы
        canvas = document.getElementById('magnetic-rect-canvas');
        ctx = canvas.getContext('2d');
        
        // Создаем и настраиваем элементы управления
        setupControls();
        
        // Устанавливаем размер холста
        setCanvasSize();
        
        // Настраиваем обработчики событий мыши
        setupMouseEvents();
        
        // Начальная инициализация
        generateSegments();
        drawCanvas();
    }
    
    /**
     * Настройка обработчиков событий мыши
     */
    function setupMouseEvents() {
        canvas.addEventListener('mousemove', function(event) {
            // Получаем координаты курсора относительно холста
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvasWidth / rect.width;
            const scaleY = canvasHeight / rect.height;
            
            // Корректно вычисляем позицию мыши с учетом масштабирования и DPI
            mouseX = (event.clientX - rect.left) * scaleX;
            mouseY = (event.clientY - rect.top) * scaleY;
            
            // Перерисовываем холст
            drawCanvas();
        });
        
        canvas.addEventListener('mouseenter', function() {
            isMouseOverCanvas = true;
        });
        
        canvas.addEventListener('mouseleave', function() {
            isMouseOverCanvas = false;
            // Сбрасываем позицию мыши и перерисовываем холст без магнитного эффекта
            mouseX = -1000;
            mouseY = -1000;
            drawCanvas();
        });
        
        // Добавляем обработчик клика для размещения магнитных точек
        canvas.addEventListener('click', function(event) {
            // Получаем координаты клика относительно холста
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvasWidth / rect.width;
            const scaleY = canvasHeight / rect.height;
            
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;
            
            // Сохраняем текущее состояние в истории перед изменением
            pointsHistory.push([...magneticPoints]);
            
            // Ограничиваем размер истории для экономии памяти
            if (pointsHistory.length > 50) {
                pointsHistory.shift(); // Удаляем самые старые состояния
            }
            
            // Добавляем новую магнитную точку
            magneticPoints.push({
                x: x,
                y: y,
                force: magneticForce,  // Используем текущую настройку силы магнитного поля
                radius: magneticRadius  // Используем текущую настройку радиуса магнитного поля
            });
            
            // Перерисовываем холст
            drawCanvas();
        });
        
        // Добавляем обработчик клавиш для управления
        document.addEventListener('keydown', function(event) {
            let needsRedraw = false;
            
            // Ctrl+Z - отмена последнего действия (удаление последней точки)
            if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault(); // Предотвращаем стандартное действие браузера
                
                if (pointsHistory.length > 0) {
                    // Восстанавливаем предыдущее состояние из истории
                    magneticPoints = pointsHistory.pop();
                    needsRedraw = true;
                }
            }
            
            // Клавиша 'Escape' - очистка всех магнитных точек
            if (event.key === 'Escape') {
                // Сохраняем текущее состояние в истории перед очисткой
                if (magneticPoints.length > 0) {
                    pointsHistory.push([...magneticPoints]);
                }
                
                magneticPoints = [];
                needsRedraw = true;
            }
            
            // Клавиша '{' - уменьшение радиуса магнитного поля
            if (event.key === '{') {
                // Уменьшаем радиус на 10px, но не меньше минимального
                magneticRadius = Math.max(MIN_MAGNETIC_RADIUS, magneticRadius - 10);
                
                // Обновляем отображение в элементе управления
                const radiusInput = document.getElementById('magnetic-rect-magneticRadius');
                if (radiusInput) {
                    radiusInput.value = magneticRadius;
                }
                
                needsRedraw = true;
            }
            
            // Клавиша '}' - увеличение радиуса магнитного поля
            if (event.key === '}') {
                // Увеличиваем радиус на 10px
                magneticRadius += 10;
                
                // Обновляем отображение в элементе управления
                const radiusInput = document.getElementById('magnetic-rect-magneticRadius');
                if (radiusInput) {
                    radiusInput.value = magneticRadius;
                }
                
                needsRedraw = true;
            }
            
            // Клавиша '!' - уменьшение силы магнитного поля
            if (event.key === '!') {
                // Уменьшаем силу на 5%, но не меньше минимальной
                magneticForce = Math.max(MIN_MAGNETIC_FORCE, magneticForce - 5);
                
                // Обновляем отображение в элементе управления
                const forceInput = document.getElementById('magnetic-rect-magneticForce');
                const forceValue = document.getElementById('magnetic-rect-magneticForceValue');
                if (forceInput && forceValue) {
                    forceInput.value = magneticForce;
                    forceValue.textContent = magneticForce;
                }
                
                needsRedraw = true;
            }
            
            // Клавиша '@' - увеличение силы магнитного поля
            if (event.key === '@') {
                // Увеличиваем силу на 5%, но не больше максимальной
                magneticForce = Math.min(MAX_MAGNETIC_FORCE, magneticForce + 5);
                
                // Обновляем отображение в элементе управления
                const forceInput = document.getElementById('magnetic-rect-magneticForce');
                const forceValue = document.getElementById('magnetic-rect-magneticForceValue');
                if (forceInput && forceValue) {
                    forceInput.value = magneticForce;
                    forceValue.textContent = magneticForce;
                }
                
                needsRedraw = true;
            }
            
            if (needsRedraw) {
                drawCanvas();
            }
        });
    }
    
    /**
     * Установка размера холста
     */
    function setCanvasSize() {
        // Получаем текущее соотношение пикселей устройства (для ретина-дисплеев)
        const dpr = window.devicePixelRatio || 1;
        
        // Устанавливаем размеры канваса с учетом плотности пикселей устройства
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        
        // Фиксированный размер для отображения на странице
        const fixedSize = 800;
        
        // Вычисляем масштаб для отображения на странице
        const scaleX = fixedSize / canvasWidth;
        const scaleY = fixedSize / canvasHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Устанавливаем фиксированный размер внешнего контейнера
        const container = canvas.parentElement;
        container.style.width = `${fixedSize}px`;
        container.style.height = `${fixedSize}px`;
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.overflow = 'hidden';
        
        // Масштабируем canvas для отображения
        const displayWidth = canvasWidth * scale;
        const displayHeight = canvasHeight * scale;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        
        // Масштабируем контекст для рисования с учетом ретина-дисплея
        ctx.scale(dpr, dpr);
        
        // Сбрасываем настройки линий для ретина-дисплея
        ctx.lineWidth = lineWidth;
    }
    
    /**
     * Настройка элементов управления
     */
    function setupControls() {
        // Очищаем контейнер с настройками
        const controlsContainer = document.querySelector('#magnetic-rect-tab .controls');
        controlsContainer.innerHTML = `
            <h2>Settings</h2>
            <div class="control-group text-input-group">
                <label for="magnetic-rect-canvasWidth">Canvas width (px):</label>
                <input type="number" id="magnetic-rect-canvasWidth" value="${canvasWidth}" min="1">
            </div>
            
            <div class="control-group text-input-group">
                <label for="magnetic-rect-canvasHeight">Canvas height (px):</label>
                <input type="number" id="magnetic-rect-canvasHeight" value="${canvasHeight}" min="1">
            </div>
            
            <div class="control-group text-input-group">
                <label for="magnetic-rect-cellSpacing">Cell spacing (px):</label>
                <input type="number" id="magnetic-rect-cellSpacing" value="${cellSpacing}" min="1">
            </div>
            
            <div class="control-group text-input-group">
                <label for="magnetic-rect-lineLength">Line length (px):</label>
                <input type="number" id="magnetic-rect-lineLength" value="${lineLength}" min="1">
            </div>
            
            <div class="control-group text-input-group">
                <label for="magnetic-rect-lineWidth">Line width (px):</label>
                <input type="number" id="magnetic-rect-lineWidth" value="${lineWidth}" min="0.1" step="0.1">
            </div>
            
            <div class="control-group">
                <label for="magnetic-rect-lineAngle">Line angle: <span id="magnetic-rect-lineAngleValue" class="value-display">${lineAngle}</span>°</label>
                <input type="range" id="magnetic-rect-lineAngle" min="0" max="180" value="${lineAngle}" step="5">
            </div>
            
            <div class="control-group">
                <label for="magnetic-rect-magneticForce">Magnetic force: <span id="magnetic-rect-magneticForceValue" class="value-display">${magneticForce}</span>%</label>
                <input type="range" id="magnetic-rect-magneticForce" min="0" max="100" value="${magneticForce}" step="1">
            </div>
            
            <div class="control-group text-input-group">
                <label for="magnetic-rect-magneticRadius">Magnetic radius (px):</label>
                <input type="number" id="magnetic-rect-magneticRadius" value="${magneticRadius}" min="${MIN_MAGNETIC_RADIUS}">
            </div>
            
            <div class="control-group checkbox-control">
                <input type="checkbox" id="magnetic-rect-roundedLineCaps" ${roundedLineCaps ? 'checked' : ''}>
                <label for="magnetic-rect-roundedLineCaps">Rounded line caps</label>
            </div>
            
            <button id="magnetic-rect-exportSvgBtn" class="export-btn">Export as SVG (⌘E)</button>
        `;
        
        // Настраиваем обработчики событий для элементов управления
        document.getElementById('magnetic-rect-canvasWidth').addEventListener('input', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                canvasWidth = value;
            }
        });
        
        document.getElementById('magnetic-rect-canvasWidth').addEventListener('change', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                canvasWidth = value;
                setCanvasSize();
                generateSegments();
                drawCanvas();
            } else {
                // Возвращаем предыдущее корректное значение
                this.value = canvasWidth;
            }
        });
        
        document.getElementById('magnetic-rect-canvasHeight').addEventListener('input', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                canvasHeight = value;
            }
        });
        
        document.getElementById('magnetic-rect-canvasHeight').addEventListener('change', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                canvasHeight = value;
                setCanvasSize();
                generateSegments();
                drawCanvas();
            } else {
                // Возвращаем предыдущее корректное значение
                this.value = canvasHeight;
            }
        });
        
        document.getElementById('magnetic-rect-cellSpacing').addEventListener('input', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                cellSpacing = value;
            }
        });
        
        document.getElementById('magnetic-rect-cellSpacing').addEventListener('change', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                cellSpacing = value;
                generateSegments();
                drawCanvas();
            } else {
                this.value = cellSpacing;
            }
        });
        
        document.getElementById('magnetic-rect-lineLength').addEventListener('input', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                lineLength = value;
            }
        });
        
        document.getElementById('magnetic-rect-lineLength').addEventListener('change', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value > 0) {
                lineLength = value;
                drawCanvas();
            } else {
                this.value = lineLength;
            }
        });
        
        document.getElementById('magnetic-rect-lineWidth').addEventListener('input', function() {
            const value = parseFloat(this.value);
            if (!isNaN(value) && value > 0) {
                lineWidth = value;
            }
        });
        
        document.getElementById('magnetic-rect-lineWidth').addEventListener('change', function() {
            const value = parseFloat(this.value);
            if (!isNaN(value) && value > 0) {
                lineWidth = value;
                drawCanvas();
            } else {
                this.value = lineWidth;
            }
        });
        
        document.getElementById('magnetic-rect-lineAngle').addEventListener('input', function() {
            lineAngle = parseInt(this.value);
            document.getElementById('magnetic-rect-lineAngleValue').textContent = lineAngle;
            drawCanvas();
        });
        
        document.getElementById('magnetic-rect-magneticForce').addEventListener('input', function() {
            magneticForce = parseInt(this.value);
            document.getElementById('magnetic-rect-magneticForceValue').textContent = magneticForce;
            drawCanvas();
        });
        
        document.getElementById('magnetic-rect-magneticRadius').addEventListener('input', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value >= MIN_MAGNETIC_RADIUS) {
                magneticRadius = value;
                drawCanvas();
            }
        });
        
        document.getElementById('magnetic-rect-magneticRadius').addEventListener('change', function() {
            const value = parseInt(this.value);
            if (!isNaN(value) && value >= MIN_MAGNETIC_RADIUS) {
                magneticRadius = value;
                drawCanvas();
            } else {
                this.value = magneticRadius;
            }
        });
        
        document.getElementById('magnetic-rect-roundedLineCaps').addEventListener('change', function() {
            roundedLineCaps = this.checked;
            drawCanvas();
        });
        
        document.getElementById('magnetic-rect-exportSvgBtn').addEventListener('click', exportSvg);
    }
    
    /**
     * Генерация сегментов по модульной сетке
     */
    function generateSegments() {
        segments = [];
        
        // Вычисляем количество строк и столбцов на основе расстояния между ячейками
        const cols = Math.floor(canvasWidth / cellSpacing);
        const rows = Math.floor(canvasHeight / cellSpacing);
        
        // Вычисляем отступы, чтобы сетка была по центру
        const offsetX = (canvasWidth - cols * cellSpacing) / 2;
        const offsetY = (canvasHeight - rows * cellSpacing) / 2;
        
        // Угол поворота хранится в градусах, но для расчетов не преобразуем в радианы
        // это будет происходить в функции drawCanvas
        
        // Создаем точки в узлах сетки
        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
                const x = offsetX + (col + 0.5) * cellSpacing;
                const y = offsetY + (row + 0.5) * cellSpacing;
                
                segments.push({
                    x,
                    y
                    // угол будет устанавливаться в drawCanvas
                });
            }
        }
    }
    
    /**
     * Отрисовка канваса
     */
    function drawCanvas() {
        // Получаем DPR для правильной отрисовки
        const dpr = window.devicePixelRatio || 1;
        
        // Очищаем холст с учетом размеров в пикселях устройства
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Базовый угол в радианах
        const baseAngleRad = (lineAngle * Math.PI) / 180;
        
        // Настраиваем стиль линий
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = roundedLineCaps ? 'round' : 'butt';
        
        // Рисуем каждый сегмент
        for (const segment of segments) {
            // Вычисляем базовые координаты концов линии
            const halfLength = lineLength / 2;
            let startX = segment.x - Math.cos(baseAngleRad) * halfLength;
            let startY = segment.y - Math.sin(baseAngleRad) * halfLength;
            let endX = segment.x + Math.cos(baseAngleRad) * halfLength;
            let endY = segment.y + Math.sin(baseAngleRad) * halfLength;
            
            // Применяем эффект от магнитных точек и курсора
            const allMagneticSources = [...magneticPoints];
            
            // Добавляем курсор как временную магнитную точку, если он над холстом
            if (isMouseOverCanvas) {
                allMagneticSources.push({
                    x: mouseX,
                    y: mouseY,
                    force: magneticForce,
                    radius: magneticRadius
                });
            }
            
            // Обрабатываем все магнитные источники (точки и курсор)
            for (const source of allMagneticSources) {
                // Находим ближайший к магнитному источнику конец линии
                const distanceToStart = Math.sqrt(
                    Math.pow(startX - source.x, 2) + Math.pow(startY - source.y, 2)
                );
                const distanceToEnd = Math.sqrt(
                    Math.pow(endX - source.x, 2) + Math.pow(endY - source.y, 2)
                );
                
                // Определяем, какой конец ближе к источнику
                const closerToStart = distanceToStart < distanceToEnd;
                
                // Вычисляем расстояние от ближайшего конца до источника
                const closestDistance = closerToStart ? distanceToStart : distanceToEnd;
                
                // Если ближайший конец находится в зоне действия магнитного поля
                if (closestDistance < source.radius) {
                    // Вычисляем коэффициент влияния в зависимости от расстояния
                    // Используем плавную функцию затухания (квадратичную)
                    // 0 - на краю поля, 1 - в центре поля
                    const normalizedDistance = closestDistance / source.radius;
                    const influence = Math.pow(1 - normalizedDistance, 2) * (source.force / 100);
                    
                    // Вычисляем новую позицию ближайшего конца с учетом притяжения
                    if (closerToStart) {
                        // Притягиваем начало линии к источнику, сохраняя конец неподвижным
                        const newStartX = startX + (source.x - startX) * influence;
                        const newStartY = startY + (source.y - startY) * influence;
                        
                        // Обновляем начальную точку
                        startX = newStartX;
                        startY = newStartY;
                        
                        // Корректируем длину линии, перемещая конечную точку
                        const currentLength = Math.sqrt(
                            Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
                        );
                        
                        if (currentLength > 0) {
                            const directionX = (endX - startX) / currentLength;
                            const directionY = (endY - startY) / currentLength;
                            
                            endX = startX + directionX * lineLength;
                            endY = startY + directionY * lineLength;
                        }
                    } else {
                        // Притягиваем конец линии к источнику, сохраняя начало неподвижным
                        const newEndX = endX + (source.x - endX) * influence;
                        const newEndY = endY + (source.y - endY) * influence;
                        
                        // Обновляем конечную точку
                        endX = newEndX;
                        endY = newEndY;
                        
                        // Корректируем длину линии, перемещая начальную точку
                        const currentLength = Math.sqrt(
                            Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
                        );
                        
                        if (currentLength > 0) {
                            const directionX = (startX - endX) / currentLength;
                            const directionY = (startY - endY) / currentLength;
                            
                            startX = endX + directionX * lineLength;
                            startY = endY + directionY * lineLength;
                        }
                    }
                }
            }
            
            // Рисуем линию с обновленными координатами
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        
        // Рисуем магнитные точки
        for (const point of magneticPoints) {
            // Рисуем точку
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fill();
            
            // Показываем радиус действия магнитного поля (полупрозрачный круг)
            ctx.beginPath();
            ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.stroke();
        }
        
        // Показываем радиус действия курсора, если он над холстом
        if (isMouseOverCanvas) {
            // Рисуем круг, показывающий радиус действия
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, magneticRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.stroke();
            
            // Отображаем текущую силу магнитного поля
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`Force: ${magneticForce}%, Radius: ${magneticRadius}px`, mouseX, mouseY - magneticRadius - 5);
        }
    }
    
    /**
     * Экспорт в SVG
     */
    function exportSvg() {
        // Базовый угол в радианах
        const baseAngleRad = (lineAngle * Math.PI) / 180;
        
        // Массив для хранения актуальных координат концов линий для каждого сегмента
        const segmentCoords = segments.map(segment => {
            // Вычисляем базовые координаты концов линии
            const halfLength = lineLength / 2;
            let startX = segment.x - Math.cos(baseAngleRad) * halfLength;
            let startY = segment.y - Math.sin(baseAngleRad) * halfLength;
            let endX = segment.x + Math.cos(baseAngleRad) * halfLength;
            let endY = segment.y + Math.sin(baseAngleRad) * halfLength;
            
            // Применяем эффект от магнитных точек
            for (const point of magneticPoints) {
                // Находим ближайший к магнитной точке конец линии
                const distanceToStart = Math.sqrt(
                    Math.pow(startX - point.x, 2) + Math.pow(startY - point.y, 2)
                );
                const distanceToEnd = Math.sqrt(
                    Math.pow(endX - point.x, 2) + Math.pow(endY - point.y, 2)
                );
                
                // Определяем, какой конец ближе к точке
                const closerToStart = distanceToStart < distanceToEnd;
                
                // Вычисляем расстояние от ближайшего конца до точки
                const closestDistance = closerToStart ? distanceToStart : distanceToEnd;
                
                // Если ближайший конец находится в зоне действия магнитного поля
                if (closestDistance < point.radius) {
                    // Вычисляем коэффициент влияния в зависимости от расстояния
                    const normalizedDistance = closestDistance / point.radius;
                    const influence = Math.pow(1 - normalizedDistance, 2) * (point.force / 100);
                    
                    // Вычисляем новую позицию ближайшего конца с учетом притяжения
                    if (closerToStart) {
                        // Притягиваем начало линии к точке, сохраняя конец неподвижным
                        startX = startX + (point.x - startX) * influence;
                        startY = startY + (point.y - startY) * influence;
                        
                        // Корректируем длину линии, перемещая конечную точку
                        const currentLength = Math.sqrt(
                            Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
                        );
                        
                        if (currentLength > 0) {
                            const directionX = (endX - startX) / currentLength;
                            const directionY = (endY - startY) / currentLength;
                            
                            endX = startX + directionX * lineLength;
                            endY = startY + directionY * lineLength;
                        }
                    } else {
                        // Притягиваем конец линии к точке, сохраняя начало неподвижным
                        endX = endX + (point.x - endX) * influence;
                        endY = endY + (point.y - endY) * influence;
                        
                        // Корректируем длину линии, перемещая начальную точку
                        const currentLength = Math.sqrt(
                            Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
                        );
                        
                        if (currentLength > 0) {
                            const directionX = (startX - endX) / currentLength;
                            const directionY = (startY - endY) / currentLength;
                            
                            startX = endX + directionX * lineLength;
                            startY = endY + directionY * lineLength;
                        }
                    }
                }
            }
            
            return {
                startX,
                startY,
                endX,
                endY
            };
        });
        
        // Создаем SVG-документ без отображения магнитных точек
        const svgContent = `<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${canvasWidth}" height="${canvasHeight}" fill="black" />
            ${segmentCoords.map(coords => {
                return `<line x1="${coords.startX}" y1="${coords.startY}" x2="${coords.endX}" y2="${coords.endY}" stroke="white" stroke-width="${lineWidth}" stroke-linecap="${roundedLineCaps ? 'round' : 'butt'}" />`;
            }).join('\n')}
        </svg>`;
        
        // Создаем Blob и URL для скачивания
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        // Создаем ссылку для скачивания и активируем её
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagonal-grid.svg';
        link.click();
        
        // Очищаем URL
        URL.revokeObjectURL(url);
    }
    
    // Инициализация модуля при загрузке страницы
    document.addEventListener('DOMContentLoaded', initialize);
    
    // Экспортируем публичное API
    window.magneticRectModule = {
        drawCanvas,
        exportSvg
    };
})(); 