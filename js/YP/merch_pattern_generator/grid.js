// Скрипт для вкладки Grid
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gridCanvas');
    if (!canvas) {
        console.error("Canvas not found!");
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Could not get canvas context!");
        return;
    }
    
    // Получаем элементы управления
    const sizeSlider = document.getElementById('gridSizeSlider');
    const sizeInput = document.getElementById('gridSizeInput');
    const spacingSlider = document.getElementById('gridSpacingSlider');
    const spacingInput = document.getElementById('gridSpacingInput');
    const radiusSlider = document.getElementById('gridRadiusSlider');
    const radiusInput = document.getElementById('gridRadiusInput');
    const strengthSlider = document.getElementById('gridStrengthSlider');
    const strengthInput = document.getElementById('gridStrengthInput');
    const gravityMode = document.getElementById('gridGravityMode');
    const randomMode = document.getElementById('gridRandomMode');
    const exportSVGButton = document.getElementById('gridExportSVG');
    const downloadButton = document.getElementById('gridExportSVG'); // Используем экспорт SVG кнопку как downloadButton
    
    // Проверяем, получены ли все необходимые элементы управления
    if (!sizeSlider || !sizeInput || !spacingSlider || !spacingInput || 
        !radiusSlider || !radiusInput || !strengthSlider || !strengthInput ||
        !gravityMode || !randomMode || !exportSVGButton) {
        console.error("Some UI controls were not found!");
        // Продолжаем работу, так как большинство функций не зависят от UI
    }

    // Устанавливаем размеры холста
    // Сначала проверяем parentElement
    if (!canvas.parentElement) {
        console.error("Canvas parent element not found!");
        canvas.width = 1000;
        canvas.height = 1000; // Делаем квадратным, чтобы избежать искажений
    } else {
        const parentWidth = canvas.parentElement.clientWidth;
        console.log(`Parent element width: ${parentWidth}`);
        
        // Устанавливаем размеры холста как квадрат
        canvas.width = Math.max(parentWidth, 1000);
        canvas.height = canvas.width; // Делаем высоту равной ширине для квадратного соотношения
        
        // Проверяем фактические размеры с учетом CSS
        const computedStyle = window.getComputedStyle(canvas);
        console.log(`Canvas CSS dimensions: ${computedStyle.width} x ${computedStyle.height}`);
        
        // Если в CSS заданы пропорции, отличные от квадрата, корректируем
        // логический размер холста, чтобы соответствовать физическому соотношению сторон
        const cssWidth = parseFloat(computedStyle.width);
        const cssHeight = parseFloat(computedStyle.height);
        
        if (cssWidth && cssHeight && Math.abs(cssWidth - cssHeight) > 10) {
            // Если есть существенная разница в размерах по CSS, корректируем логический размер
            const ratio = cssHeight / cssWidth;
            canvas.height = canvas.width * ratio;
            console.log(`Adjusted canvas dimensions based on CSS ratio: ${canvas.width} x ${canvas.height}`);
        }
    }
    
    console.log(`Canvas logical size: ${canvas.width}x${canvas.height}`);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Изменяем инициализацию позиции мыши - устанавливаем начальное положение за пределами холста
    let mouseX = -1000; // За пределами холста
    let mouseY = -1000; // За пределами холста
    let isRandom = false;
    let points = [];
    let lastTime = 0;
    let deltaTime = 0;
    let isMouseOverCanvas = false;
    let isCursorActive = false;
    let mouseEverMoved = false; // Флаг, показывающий, двигал ли пользователь мышь над холстом

    // Добавляем переменные для отслеживания движения мыши
    let prevMouseX = -1000;
    let prevMouseY = -1000;
    let mouseVelocityX = 0;
    let mouseVelocityY = 0;

    // Синхронизация слайдеров и числовых полей
    function syncInputs(slider, input) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            if (slider === spacingSlider) {
                // При изменении расстояния между точками пересоздаем сетку
                points = [];
            }
            redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
            
            // Если изменились параметры курсора, сразу применяем изменения
            if (slider === radiusSlider || slider === strengthSlider) {
                applyForceToPoints();
                redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
            }
        });

        input.addEventListener('input', () => {
            slider.value = input.value;
            if (input === spacingInput) {
                // При изменении расстояния между точками пересоздаем сетку
                points = [];
            }
            redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
            
            // Если изменились параметры курсора, сразу применяем изменения
            if (input === radiusInput || input === strengthInput) {
                applyForceToPoints();
                redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
            }
        });
    }

    syncInputs(sizeSlider, sizeInput);
    syncInputs(spacingSlider, spacingInput);
    syncInputs(radiusSlider, radiusInput);
    syncInputs(strengthSlider, strengthInput);

    // Добавляем обработчики для событий мыши
    canvas.addEventListener('mouseenter', function(e) {
        isMouseOverCanvas = true;
        const rect = canvas.getBoundingClientRect();
        
        // Получаем точные координаты мыши относительно холста
        // Учитываем масштабирование холста, если оно есть
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
        
        mouseEverMoved = true; // Устанавливаем, что мышь двигалась над холстом
    });
    
    canvas.addEventListener('mousedown', function(e) {
        console.log('Mousedown event on canvas');
        isCursorActive = true;
        mouseEverMoved = true; // Устанавливаем, что мышь двигалась над холстом
        
        // Если нажаты модификаторы, обрабатываем активацию точек
        if (e.ctrlKey || e.shiftKey || e.altKey) {
            console.log('Modifier key pressed, activating points');
            
            const rect = canvas.getBoundingClientRect();
            
            // Учитываем масштабирование холста, если оно есть
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;
            const radius = parseInt(radiusInput.value);
            
            // Активируем или деактивируем точки
            points.forEach(point => {
                const dx = clickX - point.x;
                const dy = clickY - point.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < radius) {
                    // Инвертируем состояние active
                    point.active = !point.active;
                    
                    if (point.active) {
                        // Даем точке импульс в случайном направлении
                        const angle = Math.random() * Math.PI * 2;
                        const impulse = 2 + Math.random() * 3;
                        point.vx = Math.cos(angle) * impulse;
                        point.vy = Math.sin(angle) * impulse;
                    } else {
                        // Останавливаем точку
                        point.vx = 0;
                        point.vy = 0;
                    }
                }
            });
        }
    });
    
    canvas.addEventListener('mouseup', function(e) {
        isCursorActive = false;
    });
    
    canvas.addEventListener('mousemove', function(e) {
        // Сохраняем предыдущие координаты
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        
        // Получаем координаты мыши относительно холста
        const rect = canvas.getBoundingClientRect();
        
        // Учитываем масштабирование холста, если оно есть
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
        
        // Вычисляем скорость движения мыши
        mouseVelocityX = mouseX - prevMouseX;
        mouseVelocityY = mouseY - prevMouseY;
        
        isMouseOverCanvas = true;
        mouseEverMoved = true; // Устанавливаем, что мышь двигалась над холстом
    });
    
    canvas.addEventListener('mouseleave', function() {
        isMouseOverCanvas = false;
        isCursorActive = false;
        
        // При выходе с холста убираем точку притяжения, переместив координаты мыши 
        // за пределы холста, чтобы они не влияли на точки
        prevMouseX = mouseX; // Сохраняем последнюю позицию для расчета инерции
        prevMouseY = mouseY;
        mouseX = -1000;
        mouseY = -1000;
        
        // Не сбрасываем mouseEverMoved, так как мышь уже была над холстом
        // Это позволит сразу отобразить курсор, когда мышь вернется на холст
    });

    // Обработка клавиши 'e' для экспорта SVG
    document.addEventListener('keydown', (e) => {
        const gridContentActive = document.getElementById('grid-content')?.classList.contains('active');
        
        if (e.key === 'e' && (e.metaKey || e.ctrlKey) && gridContentActive) {
            console.log('Комбинация Cmd+E нажата и вкладка Grid активна');
            e.preventDefault();
            downloadSVG(parseInt(sizeInput.value) / 2);
        }
    });

    // Обработка режима случайного движения
    randomMode.addEventListener('click', () => {
        isRandom = !isRandom;
        randomMode.textContent = isRandom ? "Stop Random" : "Random";
    });

    // Обработка режима отталкивания
    gravityMode.addEventListener('change', () => {
        applyForceToPoints();
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });

    // Обработка экспорта SVG
    exportSVGButton.addEventListener('click', () => {
        // Делим размер пополам, как при экспорте через шорткат
        downloadSVG(parseInt(sizeInput.value) / 2);
    });

    // Обработка события экспорта из основного скрипта
    window.addEventListener('grid-export-svg', function() {
        console.log('grid-export-svg event received in grid.js');
        downloadSVG(parseInt(sizeInput.value) / 2);
    });

    // Функция обновления для анимации
    function update(currentTime) {
        // Вычисляем deltaTime в секундах
        if (!lastTime) lastTime = currentTime;
        deltaTime = (currentTime - lastTime) / 1000; // в секундах
        lastTime = currentTime;
        
        // Обновляем случайное положение мыши, если активен режим random
        updateRandomWalker();
        
        // Обновляем положение точек
        updatePoints();
        
        // Отрисовываем сцену
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
        
        // Запрашиваем следующий кадр
        requestAnimationFrame(update);
    }

    function checkActivePoints() {
        // Проверяем, есть ли активные точки
        for (let i = 0; i < points.length; i++) {
            if (points[i].active) {
                return true;
            }
        }
        return false;
    }

    function checkControlsState() {
        const hasActivePoints = checkActivePoints();
        
        // Если есть активные точки, деактивируем контролы spacing
        // Но оставляем активными контролы размера точек (size)
        spacingSlider.disabled = hasActivePoints;
        spacingInput.disabled = hasActivePoints;
        
        // Добавляем или убираем класс disabled-control в зависимости от состояния
        if (hasActivePoints) {
            spacingSlider.classList.add('disabled-control');
            spacingInput.classList.add('disabled-control');
        } else {
            spacingSlider.classList.remove('disabled-control');
            spacingInput.classList.remove('disabled-control');
        }
        
        // Элементы управления размером всегда активны
        sizeSlider.disabled = false;
        sizeInput.disabled = false;
    }

    class Point {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.originalX = x;
            this.originalY = y;
            this.vx = 0;
            this.vy = 0;
            this.active = false;
            this.activationTime = 0;
            this.mass = 0.5 + Math.random() * 0.5; // Более легкие точки
            this.inactivityCounter = 0; // Счетчик для отслеживания времени неактивности
        }

        update() {
            // Обновляем position если точка активна
            if (this.active) {
                // Применяем очень мягкое затухание для эффекта "пыльцы"
                this.vx *= 0.995; // Еще меньше затухание для более длительного движения
                this.vy *= 0.995;
                
                // Обновляем позицию
                this.x += this.vx;
                this.y += this.vy;
                
                // Возвращение к исходной позиции
                const dx = this.originalX - this.x;
                const dy = this.originalY - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Еще больше уменьшаем силу возврата для очень медленного возвращения
                const returnForce = 0.00005 / this.mass; // Было 0.0002, уменьшаем в 4 раза
                
                // Применяем силу возврата только если точка очень далеко
                if (distance > 10) { // Значительно увеличиваем порог для начала возврата
                    // Уменьшаем силу возврата
                    const factor = Math.min(distance * 0.0005, 0.02); // Еще меньше коэффициент
                    this.vx += dx * returnForce * factor;
                    this.vy += dy * returnForce * factor;
                }
                
                // Проверяем, движется ли точка
                if (Math.abs(this.vx) < 0.01 && Math.abs(this.vy) < 0.01) {
                    // Увеличиваем счетчик неактивности
                    this.inactivityCounter++;
                    
                    // Деактивируем точку только после длительного периода неактивности
                    // и если она очень близко к исходной позиции
                    if (this.inactivityCounter > 60 && distance < 0.5) { // ~1 секунда при 60 FPS
                        this.x = this.originalX;
                        this.y = this.originalY;
                        this.vx = 0;
                        this.vy = 0;
                        this.active = false;
                        this.inactivityCounter = 0;
                    }
                } else {
                    // Сбрасываем счетчик, если точка движется
                    this.inactivityCounter = 0;
                }
                
                // Проверка границ холста с отскоком
                if (this.x < 0) {
                    this.x = 0;
                    this.vx *= -0.5; // Отскок с потерей энергии
                } else if (this.x > canvas.width) {
                    this.x = canvas.width;
                    this.vx *= -0.5;
                }
                
                if (this.y < 0) {
                    this.y = 0;
                    this.vy *= -0.5;
                } else if (this.y > canvas.height) {
                    this.y = canvas.height;
                    this.vy *= -0.5;
                }
            }
        }

        applyForce(angle, force) {
            if (!this.active) {
                // Если точка не активна, активируем её
                this.active = true;
                this.activationTime = Date.now();
                this.inactivityCounter = 0; // Сбрасываем счетчик неактивности
                
                // Даем начальный импульс в направлении силы
                this.vx = Math.cos(angle) * force * 3; // Увеличиваем начальный импульс
                this.vy = Math.sin(angle) * force * 3;
            }
            
            // Применяем силу с учетом массы точки
            const adjustedForce = force * 1.5 / this.mass;
            this.vx += Math.cos(angle) * adjustedForce;
            this.vy += Math.sin(angle) * adjustedForce;
        }
    }

    function disableSpacingControls() {
        spacingSlider.disabled = true;
        spacingInput.disabled = true;
        spacingSlider.classList.add('disabled-control');
        spacingInput.classList.add('disabled-control');
    }

    function enableSpacingControls() {
        spacingSlider.disabled = false;
        spacingInput.disabled = false;
        spacingSlider.classList.remove('disabled-control');
        spacingInput.classList.remove('disabled-control');
    }

    function redraw(circleDiameter, spacing) {
        // Проверяем, существует ли контекст и холст
        if (!ctx || !canvas) {
            console.error("Canvas or context is not available");
            return;
        }
        
        try {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Если точки еще не созданы, создаем их
            if (points.length === 0) {
                generateGridPoints();
            }
            
            // Адаптируем размер точек к размеру холста
            // Для очень больших холстов увеличиваем диаметр
            const minDimension = Math.min(canvas.width, canvas.height);
            const scaleFactor = minDimension / 1000; // 1000px как базовый размер
            const adjustedDiameter = circleDiameter * Math.max(1, scaleFactor);
            const circleRadius = adjustedDiameter / 2;
            
            // Рисуем точки
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                ctx.beginPath();
                ctx.arc(point.x, point.y, circleRadius, 0, Math.PI * 2);
                
                // Все точки рисуем белым цветом, независимо от активности
                ctx.fillStyle = 'white';
                
                ctx.fill();
            }
            
            // Рисуем курсор только если мышь когда-либо двигалась над холстом и сейчас находится над ним
            if (mouseEverMoved && isMouseOverCanvas && mouseX > -100 && mouseY > -100) {
                // Масштабируем размер курсора с тем же коэффициентом
                const adjustedRadius = parseInt(radiusInput.value) * Math.max(1, scaleFactor);
                
                // Рисуем окружность курсора
                ctx.beginPath();
                ctx.arc(mouseX, mouseY, adjustedRadius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
                ctx.lineWidth = 2 * Math.max(1, scaleFactor); // Масштабируем толщину линии
                ctx.stroke();
                
                // Рисуем маленький крестик в центре курсора для точного позиционирования
                const crossSize = 4 * Math.max(1, scaleFactor);
                
                // Горизонтальная линия крестика
                ctx.beginPath();
                ctx.moveTo(mouseX - crossSize, mouseY);
                ctx.lineTo(mouseX + crossSize, mouseY);
                ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
                ctx.lineWidth = 1 * Math.max(1, scaleFactor);
                ctx.stroke();
                
                // Вертикальная линия крестика
                ctx.beginPath();
                ctx.moveTo(mouseX, mouseY - crossSize);
                ctx.lineTo(mouseX, mouseY + crossSize);
                ctx.stroke();
            }
        } catch (error) {
            console.error("Error in redraw function:", error);
        }
    }

    // Функция для генерации точек сетки
    function generateGridPoints() {
        // Очищаем массив точек
        points = [];
        
        // Проверяем размеры холста
        if (canvas.width <= 0 || canvas.height <= 0) {
            console.error("Invalid canvas dimensions:", canvas.width, canvas.height);
            // Устанавливаем минимальные размеры
            canvas.width = Math.max(canvas.width, 1000);
            canvas.height = Math.max(canvas.height, 1000);
        }
        
        // Получаем минимальный размер холста для расчета расстояния между точками
        const minDimension = Math.min(canvas.width, canvas.height);
        
        // Получаем расстояние между точками из поля ввода
        let spacing = parseInt(spacingInput.value);
        
        // Проверяем, что spacing имеет разумное значение
        if (isNaN(spacing) || spacing <= 0) {
            console.error("Invalid spacing value:", spacing);
            spacing = 50; // Устанавливаем значение по умолчанию
            spacingInput.value = spacing;
            if (spacingSlider) spacingSlider.value = spacing;
        }
        
        // Адаптируем расстояние между точками к размеру холста
        // Это обеспечит примерно одинаковое количество точек независимо от размера холста
        const scaleFactor = minDimension / 1000;
        const adjustedSpacing = spacing * scaleFactor;
        
        console.log(`Generating grid with spacing: ${adjustedSpacing} (base: ${spacing}, scale: ${scaleFactor})`);
        
        // Вычисляем количество точек по горизонтали и вертикали
        const cols = Math.floor(canvas.width / adjustedSpacing);
        const rows = Math.floor(canvas.height / adjustedSpacing);
        
        console.log(`Grid dimensions: ${cols} columns x ${rows} rows`);
        
        // Проверяем, не слишком ли много точек
        const totalPoints = cols * rows;
        if (totalPoints > 5000) {
            console.warn(`Too many points: ${totalPoints}. Adjusting spacing.`);
            const newSpacing = Math.sqrt((canvas.width * canvas.height) / 5000);
            console.log(`Adjusted spacing to: ${newSpacing}`);
            
            // Пересчитываем количество точек
            const newCols = Math.floor(canvas.width / newSpacing);
            const newRows = Math.floor(canvas.height / newSpacing);
            
            // Вычисляем общую ширину и высоту сетки
            const totalWidth = newCols * newSpacing;
            const totalHeight = newRows * newSpacing;
            
            // Вычисляем смещение для центрирования
            const offsetX = (canvas.width - totalWidth) / 2;
            const offsetY = (canvas.height - totalHeight) / 2;
            
            // Создаем точки с новым расстоянием, центрированные на холсте
            for (let i = 0; i < newCols; i++) {
                for (let j = 0; j < newRows; j++) {
                    const x = offsetX + i * newSpacing + newSpacing / 2;
                    const y = offsetY + j * newSpacing + newSpacing / 2;
                    points.push(new Point(x, y));
                }
            }
        } else {
            // Вычисляем общую ширину и высоту сетки
            const totalWidth = cols * adjustedSpacing;
            const totalHeight = rows * adjustedSpacing;
            
            // Вычисляем смещение для центрирования
            const offsetX = (canvas.width - totalWidth) / 2;
            const offsetY = (canvas.height - totalHeight) / 2;
            
            // Создаем точки, центрированные на холсте
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const x = offsetX + i * adjustedSpacing + adjustedSpacing / 2;
                    const y = offsetY + j * adjustedSpacing + adjustedSpacing / 2;
                    points.push(new Point(x, y));
                }
            }
        }
        
        console.log(`Created ${points.length} points`);
        
        // Если не удалось создать точки, создаем резервную сетку
        if (points.length === 0) {
            console.error("Failed to create points, using fallback grid");
            const fallbackSpacing = minDimension / 10;
            const fallbackCols = 10;
            const fallbackRows = 10;
            
            // Вычисляем общую ширину и высоту резервной сетки
            const totalWidth = fallbackCols * fallbackSpacing;
            const totalHeight = fallbackRows * fallbackSpacing;
            
            // Вычисляем смещение для центрирования
            const offsetX = (canvas.width - totalWidth) / 2;
            const offsetY = (canvas.height - totalHeight) / 2;
            
            for (let i = 0; i < fallbackCols; i++) {
                for (let j = 0; j < fallbackRows; j++) {
                    const x = offsetX + i * fallbackSpacing + fallbackSpacing / 2;
                    const y = offsetY + j * fallbackSpacing + fallbackSpacing / 2;
                    points.push(new Point(x, y));
                }
            }
            console.log(`Created ${points.length} fallback points`);
        }
        
        return points;
    }

    function generateSVG(circleRadius) {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;
        svg += `<rect width="100%" height="100%" fill="black"/>`;
        
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            svg += `<circle cx="${point.x}" cy="${point.y}" r="${circleRadius}" fill="white" />`;
        }
        
        svg += '</svg>';
        return svg;
    }

    function downloadSVG(circleRadius) {
        const svgString = generateSVG(circleRadius);
        const blob = new Blob([svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dotted-grid.svg';
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function updateRandomWalker() {
        // Если режим random не активен, не выполняем
        if (!isRandom) {
            return;
        }
        
        // Устанавливаем флаг, что мышь над холстом (для режима случайного движения)
        isMouseOverCanvas = true;
        mouseEverMoved = true;
        
        // Случайное движение курсора
        const maxSpeed = 5;
        const acceleration = 0.2;
        
        // Добавляем случайное ускорение
        const randomAccelX = (Math.random() - 0.5) * acceleration;
        const randomAccelY = (Math.random() - 0.5) * acceleration;
        
        // Обновляем скорость
        let randomWalkerVX = (Math.random() - 0.5) * maxSpeed;
        let randomWalkerVY = (Math.random() - 0.5) * maxSpeed;
        
        // Ограничиваем скорость
        randomWalkerVX = Math.max(-maxSpeed, Math.min(maxSpeed, randomWalkerVX));
        randomWalkerVY = Math.max(-maxSpeed, Math.min(maxSpeed, randomWalkerVY));
        
        // Обновляем позицию
        mouseX += randomWalkerVX;
        mouseY += randomWalkerVY;
        
        // Ограничиваем позицию в пределах холста
        mouseX = Math.max(0, Math.min(canvas.width, mouseX));
        mouseY = Math.max(0, Math.min(canvas.height, mouseY));
    }

    // Функция для применения силы к точкам
    function applyForceToPoints() {
        // Проверяем, находится ли мышь над холстом и в пределах холста
        if (!isMouseOverCanvas || mouseX < 0 || mouseY < 0 || mouseX > canvas.width || mouseY > canvas.height) {
            return; // Не применяем силу, если мышь вне холста
        }
        
        let totalAffected = 0;
        let totalActivated = 0;
        
        const cursorRadius = parseInt(radiusInput.value);
        const cursorStrength = parseInt(strengthInput.value);
        const isRepel = gravityMode.checked;
        
        // Вычисляем скорость движения мыши для эффекта инерции
        const mouseSpeed = Math.sqrt(mouseVelocityX * mouseVelocityX + mouseVelocityY * mouseVelocityY);
        const inertiaFactor = Math.min(mouseSpeed * 0.3, 3); // Увеличиваем эффект инерции
        
        // Используем точный радиус курсора без расширения
        const exactRadius = cursorRadius;
        
        // Уменьшаем силу воздействия в 10 раз
        const strengthMultiplier = 0.05; // Было 0.5, уменьшаем в 10 раз
        
        points.forEach(point => {
            // Считаем расстояние от курсора до точки
            const dx = mouseX - point.x;
            const dy = mouseY - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Применяем силу только если точка находится в радиусе курсора
            if (distance < exactRadius) {
                // Коэффициент затухания на границе радиуса (1 в центре, 0 на границе)
                const falloff = 1 - (distance / exactRadius);
                
                // Активируем точку, если она не активна
                if (!point.active) {
                    point.active = true;
                    totalActivated++;
                }
                
                // Расчитываем угол и силу
                const angle = Math.atan2(dy, dx);
                
                // Базовая сила с учетом расстояния, затухания и силы курсора
                // Используем cursorStrength для масштабирования силы (от 1 до 100)
                const strengthFactor = cursorStrength / 100; // Нормализуем значение от 0.01 до 1
                let force = cursorRadius / Math.max(distance, 1) * strengthMultiplier * falloff * strengthFactor;
                
                // Применяем силу притяжения или отталкивания в зависимости от режима
                if (isRepel) {
                    // Отталкивание: применяем силу в противоположном направлении
                    point.applyForce(angle + Math.PI, force);
                } else {
                    // Притяжение: применяем силу в направлении к курсору
                    point.applyForce(angle, force);
                }
                
                // Добавляем эффект инерции от движения мыши
                if (mouseSpeed > 0.3) { // Снижаем порог для активации инерции
                    const inertiaAngle = Math.atan2(mouseVelocityY, mouseVelocityX);
                    // Также уменьшаем силу инерции в соответствии с общим уменьшением
                    const inertiaForce = inertiaFactor * falloff * 0.12 * strengthFactor; // Было 1.2, уменьшаем в 10 раз
                    point.applyForce(inertiaAngle, inertiaForce);
                }
                
                totalAffected++;
            }
            // Удаляем случайную активацию точек вне радиуса курсора
        });
        
        if (totalAffected > 0 || totalActivated > 0) {
            console.log(`Affected points: ${totalAffected}, Activated points: ${totalActivated}`);
        }
        
        // Обновляем состояние контролов
        checkControlsState();
    }

    // Функция анимации
    function animate() {
        // Обновляем положение всех точек
        points.forEach(point => {
            point.update();
        });
        
        // Применяем силы от курсора, если мышь над холстом
        if (isMouseOverCanvas) {
            applyForceToPoints();
        }
        
        // Если активен режим случайного движения, вызываем updateRandomWalker
        if (isRandom) {
            updateRandomWalker();
        }
        
        // Перерисовываем
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
        
        // Запрашиваем следующий кадр
        requestAnimationFrame(animate);
    }

    // Добавляем обработчик для события изменения вкладки
    window.addEventListener('tab-changed', function() {
        // Проверяем, активна ли вкладка Grid
        if (document.getElementById('grid-content').classList.contains('active')) {
            console.log('Switched to Grid tab');
            // Сбрасываем время анимации
            lastTime = 0;
            
            // Сбрасываем флаг mouseEverMoved, чтобы курсор снова не отображался
            // пока пользователь не наведет мышь на холст
            mouseEverMoved = false;
            isMouseOverCanvas = false;
            
            // Устанавливаем координаты мыши за пределами холста
            mouseX = -1000;
            mouseY = -1000;
            
            // Проверяем, созданы ли точки
            if (points.length === 0) {
                generateGridPoints();
            }
        }
    });

    // Инициализация
    console.log("Инициализация Grid...");
    
    try {
        // Проверяем, всё ли готово для инициализации
        if (!canvas || !ctx) {
            throw new Error("Canvas or context is not available");
        }
        
        // Гарантируем, что флаги мыши сброшены при инициализации
        mouseEverMoved = false;
        isMouseOverCanvas = false;
        mouseX = -1000;
        mouseY = -1000;
        
        // Генерируем точки
        generateGridPoints();
        console.log("Создано точек: " + points.length);
        
        // Проверяем, созданы ли точки
        if (points.length === 0) {
            console.warn("No points were generated, attempting fallback");
            // Пытаемся создать точки еще раз с другими параметрами
            const width = Math.max(canvas.width, 100);
            const height = Math.max(canvas.height, 100);
            
            // Создаем сетку 10x10 точек вручную
            const manualSpacing = Math.min(width, height) / 10;
            for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 10; x++) {
                    const pointX = (width / 10) * x + manualSpacing / 2;
                    const pointY = (height / 10) * y + manualSpacing / 2;
                    points.push(new Point(pointX, pointY));
                }
            }
            console.log(`Generated ${points.length} fallback points directly`);
        }
        
        // Запускаем анимацию
        animate();
    } catch (error) {
        console.error("Error during initialization:", error);
    }

    // Добавляем обработчики событий для элементов управления
    sizeInput.addEventListener('input', function() {
        sizeSlider.value = sizeInput.value;
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });
    
    sizeSlider.addEventListener('input', function() {
        sizeInput.value = sizeSlider.value;
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });
    
    spacingInput.addEventListener('input', function() {
        spacingSlider.value = spacingInput.value;
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });
    
    spacingSlider.addEventListener('input', function() {
        spacingInput.value = spacingSlider.value;
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });
    
    radiusInput.addEventListener('input', function() {
        radiusSlider.value = radiusInput.value;
    });
    
    radiusSlider.addEventListener('input', function() {
        radiusInput.value = radiusSlider.value;
    });
    
    strengthInput.addEventListener('input', function() {
        strengthSlider.value = strengthInput.value;
    });
    
    strengthSlider.addEventListener('input', function() {
        strengthInput.value = strengthSlider.value;
    });
}); 