document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('rayCanvas');
    const ctx = canvas.getContext('2d');
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeInput = document.getElementById('sizeInput');
    const spacingSlider = document.getElementById('spacingSlider');
    const spacingInput = document.getElementById('spacingInput');

    // Фиксированные размеры canvas
    canvas.width = 1080;
    canvas.height = 1080;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const rayLength = Math.min(canvas.width, canvas.height) * 0.45;

    // В начале файла, где определяются переменные
    const raysSlider = document.getElementById('raysSlider');
    const raysInput = document.getElementById('raysInput');
    const baseAngles = [90, 100, 115, 140, 175, 220, 270, 325, 25];
    let angles = [...baseAngles];

    // Gravity controls
    const radiusSlider = document.getElementById('radiusSlider');
    const radiusInput = document.getElementById('radiusInput');
    const strengthSlider = document.getElementById('strengthSlider');
    const strengthInput = document.getElementById('strengthInput');
    const gravityMode = document.getElementById('gravityMode');
    const randomMode = document.getElementById('randomMode');
    const exportSVGButton = document.getElementById('exportSVG');
    const pauseIndicator = document.getElementById('pauseIndicator');

    let mouseX = centerX;
    let mouseY = centerY;
    let isRandom = false;
    let isPaused = false;
    let points = [];
    let lastTime = 0;
    let deltaTime = 0;

    // Синхронизация слайдеров и числовых полей
    function syncInputs(slider, input) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
        });

        input.addEventListener('input', () => {
            slider.value = input.value;
            redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
        });
    }

    syncInputs(sizeSlider, sizeInput);
    syncInputs(spacingSlider, spacingInput);
    syncInputs(raysSlider, raysInput);
    syncInputs(radiusSlider, radiusInput);
    syncInputs(strengthSlider, strengthInput);

    // Обработка событий мыши
    canvas.addEventListener('mousemove', (e) => {
        if (!document.getElementById('dotted-rays-content').classList.contains('active')) {
            return; // Не выполняем, если вкладка не активна
        }
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    });

    // Обработка клика для заморозки точек
    canvas.addEventListener('click', freezePoints);

    // Обработка пробела для заморозки точек
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.getElementById('dotted-rays-content').classList.contains('active')) {
            freezePoints();
        } else if (e.key === 'e' && (e.metaKey || e.ctrlKey) && document.getElementById('dotted-rays-content').classList.contains('active')) {
            e.preventDefault();
            downloadSVG(parseInt(sizeInput.value));
        }
    });

    // Обработка режима случайного движения
    randomMode.addEventListener('click', () => {
        isRandom = !isRandom;
        randomMode.textContent = isRandom ? "Stop Random" : "Random";
    });

    // Обработка экспорта SVG
    exportSVGButton.addEventListener('click', () => {
        downloadSVG(parseInt(sizeInput.value));
    });

    // Обработка изменения количества лучей
    raysSlider.addEventListener('input', () => {
        raysInput.value = raysSlider.value;
        angles = calculateAngles(parseInt(raysSlider.value));
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });

    raysInput.addEventListener('input', () => {
        raysSlider.value = raysInput.value;
        angles = calculateAngles(parseInt(raysInput.value));
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });

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
        
        // Если есть активные точки, деактивируем контролы
        sizeSlider.disabled = hasActivePoints;
        sizeInput.disabled = hasActivePoints;
        spacingSlider.disabled = hasActivePoints;
        spacingInput.disabled = hasActivePoints;
        raysSlider.disabled = hasActivePoints;
        raysInput.disabled = hasActivePoints;
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
        }

        update() {
            if (!this.active) return;

            // Применяем физику
            this.vx *= 0.95; // Затухание
            this.vy *= 0.95;
            
            // Обновляем позицию
            this.x += this.vx;
            this.y += this.vy;
            
            // Возвращаем точку к исходной позиции
            const dx = this.originalX - this.x;
            const dy = this.originalY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0.1) {
                this.vx += dx * 0.01;
                this.vy += dy * 0.01;
            } else {
                // Если точка вернулась к исходной позиции, останавливаем её
                if (Math.abs(this.vx) < 0.1 && Math.abs(this.vy) < 0.1) {
                    this.x = this.originalX;
                    this.y = this.originalY;
                    this.vx = 0;
                    this.vy = 0;
                    this.active = false;
                }
            }
        }

        applyForce(angle, force) {
            if (!this.active) return;
            
            this.vx += Math.cos(angle) * force;
            this.vy += Math.sin(angle) * force;
        }
    }

    function disableSpacingAndRaysControls() {
        spacingSlider.disabled = true;
        spacingInput.disabled = true;
        raysSlider.disabled = true;
        raysInput.disabled = true;
    }

    function enableSpacingAndRaysControls() {
        spacingSlider.disabled = false;
        spacingInput.disabled = false;
        raysSlider.disabled = false;
        raysInput.disabled = false;
    }

    function animate(currentTime) {
        requestAnimationFrame(animate);
        
        if (!document.getElementById('dotted-rays-content').classList.contains('active')) {
            return; // Не анимируем, если вкладка не активна
        }
        
        if (lastTime === 0) {
            lastTime = currentTime;
            return;
        }
        
        deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        if (isPaused) {
            return;
        }
        
        if (isRandom) {
            updateRandomWalker();
        }
        
        // Применяем силы к точкам
        const radius = parseInt(radiusInput.value);
        const strength = parseInt(strengthInput.value) * 0.01;
        const isRepel = gravityMode.checked;
        
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            
            // Расстояние от точки до курсора
            const dx = mouseX - point.x;
            const dy = mouseY - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                // Угол между точкой и курсором
                const angle = Math.atan2(dy, dx);
                
                // Сила зависит от расстояния (ближе = сильнее)
                const force = strength * (1 - distance / radius);
                
                // Применяем силу (притяжение или отталкивание)
                if (isRepel) {
                    point.applyForce(angle + Math.PI, force);
                } else {
                    point.applyForce(angle, force);
                }
                
                // Активируем точку, если она еще не активна
                if (!point.active) {
                    point.active = true;
                    checkControlsState();
                }
            }
            
            // Обновляем позицию точки
            point.update();
        }
        
        // Перерисовываем сцену
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    }

    function redraw(circleDiameter, spacing) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Если есть активные точки, рисуем их в текущих позициях
        if (points.length > 0 && checkActivePoints()) {
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                
                ctx.beginPath();
                ctx.arc(point.x, point.y, circleDiameter / 2, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();
            }
        } else {
            // Иначе создаем новые точки и рисуем их
            points = [];
            
            for (let i = 0; i < angles.length; i++) {
                const angle = angles[i] * (Math.PI / 180);
                const endX = centerX + Math.cos(angle) * rayLength;
                const endY = centerY + Math.sin(angle) * rayLength;
                
                drawDottedLine(centerX, centerY, endX, endY, circleDiameter / 2, spacing, i);
            }
        }
    }

    function drawDottedLine(startX, startY, endX, endY, circleRadius, spacing, lineIndex) {
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Количество точек на линии
        const count = Math.max(1, Math.floor(distance / spacing));
        
        // Шаг между точками
        const stepX = dx / count;
        const stepY = dy / count;
        
        for (let i = 0; i <= count; i++) {
            const x = startX + stepX * i;
            const y = startY + stepY * i;
            
            // Создаем точку
            const point = new Point(x, y);
            points.push(point);
            
            // Рисуем круг
            ctx.beginPath();
            ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
        }
    }

    function generateSVG(circleRadius) {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}">`;
        svg += `<rect width="100%" height="100%" fill="black"/>`;
        
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            svg += `<circle cx="${point.x}" cy="${point.y}" r="${circleRadius}" fill="white"/>`;
        }
        
        svg += `</svg>`;
        return svg;
    }

    function downloadSVG(circleRadius) {
        const svg = generateSVG(circleRadius);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dotted-rays.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function updatePauseIndicator() {
        if (isPaused) {
            pauseIndicator.style.display = 'block';
        } else {
            pauseIndicator.style.display = 'none';
        }
    }

    // Инициализация
    angles = calculateAngles(parseInt(raysInput.value));
    redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    
    // Запускаем анимацию
    requestAnimationFrame(animate);
    
    function freezePoints() {
        if (!document.getElementById('dotted-rays-content').classList.contains('active')) {
            return; // Не выполняем, если вкладка не активна
        }
        
        isPaused = !isPaused;
        updatePauseIndicator();
        
        if (!isPaused) {
            // Если возобновляем анимацию, сбрасываем lastTime
            lastTime = 0;
        }
    }

    function calculateAngles(additionalRaysPerSegment) {
        // Базовые углы
        const result = [...baseAngles];
        
        if (additionalRaysPerSegment <= 0) {
            return result;
        }
        
        // Добавляем дополнительные лучи между базовыми
        const newAngles = [];
        
        for (let i = 0; i < baseAngles.length - 1; i++) {
            newAngles.push(baseAngles[i]);
            
            const start = baseAngles[i];
            const end = baseAngles[i + 1];
            const step = (end - start) / (additionalRaysPerSegment + 1);
            
            for (let j = 1; j <= additionalRaysPerSegment; j++) {
                newAngles.push(start + step * j);
            }
        }
        
        // Добавляем лучи между последним и первым базовыми углами
        newAngles.push(baseAngles[baseAngles.length - 1]);
        
        const start = baseAngles[baseAngles.length - 1];
        let end = baseAngles[0] + 360;
        const step = (end - start) / (additionalRaysPerSegment + 1);
        
        for (let j = 1; j <= additionalRaysPerSegment; j++) {
            let angle = start + step * j;
            if (angle >= 360) {
                angle -= 360;
            }
            newAngles.push(angle);
        }
        
        return newAngles;
    }

    function updateRandomWalker() {
        // Случайное движение курсора
        const radius = 100;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        
        mouseX = centerX + Math.cos(angle) * distance;
        mouseY = centerY + Math.sin(angle) * distance;
    }
    
    // Обработчик события переключения вкладок
    window.addEventListener('tab-changed', function() {
        lastTime = 0;
    });
    
    // Обработчик события для перерисовки
    window.addEventListener('redraw-dotted-rays', function() {
        redraw(parseInt(sizeInput.value), parseInt(spacingInput.value));
    });
}); 