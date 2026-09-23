document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('cationsCanvas');
    const ctx = canvas.getContext('2d');
    const lengthSlider = document.getElementById('cationsLengthSlider');
    const lengthInput = document.getElementById('cationsLengthInput');
    const thicknessSlider = document.getElementById('cationsThicknessSlider');
    const thicknessInput = document.getElementById('cationsThicknessInput');
    const spacingSlider = document.getElementById('cationsSpacingSlider');
    const spacingInput = document.getElementById('cationsSpacingInput');

    // Фиксированные размеры canvas
    canvas.width = 1080;
    canvas.height = 1080;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const rayLength = Math.min(canvas.width, canvas.height) * 0.45;

    // Определяем переменные
    const raysSlider = document.getElementById('cationsRaysSlider');
    const raysInput = document.getElementById('cationsRaysInput');
    const baseAngles = [90, 100, 115, 140, 175, 220, 270, 325, 25];
    let angles = [...baseAngles];

    // Gravity controls
    const radiusSlider = document.getElementById('cationsRadiusSlider');
    const radiusInput = document.getElementById('cationsRadiusInput');
    const strengthSlider = document.getElementById('cationsStrengthSlider');
    const strengthInput = document.getElementById('cationsStrengthInput');
    const gravityMode = document.getElementById('cationsGravityMode');
    const randomMode = document.getElementById('cationsRandomMode');
    const exportSVGButton = document.getElementById('cationsExportSVG');
    const pauseIndicator = document.getElementById('cationsPauseIndicator');

    let mouseX = centerX;
    let mouseY = centerY;
    let isRandom = false;
    let isPaused = false;
    let crosses = [];
    let lastTime = 0;
    let deltaTime = 0;

    // Синхронизация слайдеров и числовых полей
    function syncInputs(slider, input) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
        });

        input.addEventListener('input', () => {
            slider.value = input.value;
            redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
        });
    }

    syncInputs(lengthSlider, lengthInput);
    syncInputs(thicknessSlider, thicknessInput);
    syncInputs(spacingSlider, spacingInput);
    syncInputs(raysSlider, raysInput);
    syncInputs(radiusSlider, radiusInput);
    syncInputs(strengthSlider, strengthInput);

    // Обработка событий мыши
    canvas.addEventListener('mousemove', (e) => {
        if (!document.getElementById('cations-content').classList.contains('active')) {
            return; // Не выполняем, если вкладка не активна
        }
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    });

    // Обработка клика для заморозки точек
    canvas.addEventListener('click', freezeCrosses);

    // Обработка пробела для заморозки точек
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.getElementById('cations-content').classList.contains('active')) {
            freezeCrosses();
        } else if (e.key === 'e' && (e.metaKey || e.ctrlKey) && document.getElementById('cations-content').classList.contains('active')) {
            e.preventDefault();
            downloadSVG(parseFloat(lengthInput.value), parseFloat(thicknessInput.value));
        }
    });

    // Обработка режима случайного движения
    randomMode.addEventListener('click', () => {
        isRandom = !isRandom;
        randomMode.textContent = isRandom ? "Stop Random" : "Random";
    });

    // Обработка экспорта SVG
    exportSVGButton.addEventListener('click', () => {
        downloadSVG(parseFloat(lengthInput.value), parseFloat(thicknessInput.value));
    });

    // Обработка изменения количества лучей
    raysSlider.addEventListener('input', () => {
        raysInput.value = raysSlider.value;
        angles = calculateAngles(parseInt(raysSlider.value));
        redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
    });

    raysInput.addEventListener('input', () => {
        raysSlider.value = raysInput.value;
        angles = calculateAngles(parseInt(raysInput.value));
        redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
    });

    function checkActiveCrosses() {
        // Проверяем, есть ли активные кресты
        for (let i = 0; i < crosses.length; i++) {
            if (crosses[i].active) {
                return true;
            }
        }
        return false;
    }

    function checkControlsState() {
        const hasActiveCrosses = checkActiveCrosses();
        
        // Если есть активные кресты, деактивируем контролы
        lengthSlider.disabled = hasActiveCrosses;
        lengthInput.disabled = hasActiveCrosses;
        thicknessSlider.disabled = hasActiveCrosses;
        thicknessInput.disabled = hasActiveCrosses;
        spacingSlider.disabled = hasActiveCrosses;
        spacingInput.disabled = hasActiveCrosses;
        raysSlider.disabled = hasActiveCrosses;
        raysInput.disabled = hasActiveCrosses;
    }

    class Cross {
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
            
            // Возвращаем крест к исходной позиции
            const dx = this.originalX - this.x;
            const dy = this.originalY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0.1) {
                this.vx += dx * 0.01;
                this.vy += dy * 0.01;
            } else {
                // Если крест вернулся к исходной позиции, останавливаем его
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

        draw(lineLength, lineThickness) {
            ctx.lineWidth = lineThickness;
            ctx.strokeStyle = 'white';
            
            // Горизонтальная линия
            ctx.beginPath();
            ctx.moveTo(this.x - lineLength / 2, this.y);
            ctx.lineTo(this.x + lineLength / 2, this.y);
            ctx.stroke();
            
            // Вертикальная линия
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - lineLength / 2);
            ctx.lineTo(this.x, this.y + lineLength / 2);
            ctx.stroke();
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
        
        if (!document.getElementById('cations-content').classList.contains('active')) {
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
        
        // Применяем силы к крестам
        const radius = parseInt(radiusInput.value);
        const strength = parseInt(strengthInput.value) * 0.01;
        const isRepel = gravityMode.checked;
        
        for (let i = 0; i < crosses.length; i++) {
            const cross = crosses[i];
            
            // Расстояние от креста до курсора
            const dx = mouseX - cross.x;
            const dy = mouseY - cross.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                // Угол между крестом и курсором
                const angle = Math.atan2(dy, dx);
                
                // Сила зависит от расстояния (ближе = сильнее)
                const force = strength * (1 - distance / radius);
                
                // Применяем силу (притяжение или отталкивание)
                if (isRepel) {
                    cross.applyForce(angle + Math.PI, force);
                } else {
                    cross.applyForce(angle, force);
                }
                
                // Активируем крест, если он еще не активен
                if (!cross.active) {
                    cross.active = true;
                    checkControlsState();
                }
            }
            
            // Обновляем позицию креста
            cross.update();
        }
        
        // Перерисовываем сцену
        redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
    }

    function redraw(lineLength, lineThickness, spacing) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Если есть активные кресты, рисуем их в текущих позициях
        if (crosses.length > 0 && checkActiveCrosses()) {
            for (let i = 0; i < crosses.length; i++) {
                const cross = crosses[i];
                cross.draw(lineLength, lineThickness);
            }
        } else {
            // Иначе создаем новые кресты и рисуем их
            crosses = [];
            
            for (let i = 0; i < angles.length; i++) {
                const angle = angles[i] * (Math.PI / 180);
                const endX = centerX + Math.cos(angle) * rayLength;
                const endY = centerY + Math.sin(angle) * rayLength;
                
                drawCrossesLine(centerX, centerY, endX, endY, lineLength, lineThickness, spacing, i);
            }
        }
    }

    function drawCrossesLine(startX, startY, endX, endY, lineLength, lineThickness, spacing, lineIndex) {
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Количество крестов на линии
        const count = Math.max(1, Math.floor(distance / spacing));
        
        // Шаг между крестами
        const stepX = dx / count;
        const stepY = dy / count;
        
        for (let i = 0; i <= count; i++) {
            const x = startX + stepX * i;
            const y = startY + stepY * i;
            
            // Создаем крест
            const cross = new Cross(x, y);
            crosses.push(cross);
            
            // Рисуем крест
            cross.draw(lineLength, lineThickness);
        }
    }

    function generateSVG(lineLength, lineThickness) {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}">`;
        svg += `<rect width="100%" height="100%" fill="black"/>`;
        
        for (let i = 0; i < crosses.length; i++) {
            const cross = crosses[i];
            svg += `<line x1="${cross.x - lineLength/2}" y1="${cross.y}" x2="${cross.x + lineLength/2}" y2="${cross.y}" stroke="white" stroke-width="${lineThickness}"/>`;
            svg += `<line x1="${cross.x}" y1="${cross.y - lineLength/2}" x2="${cross.x}" y2="${cross.y + lineLength/2}" stroke="white" stroke-width="${lineThickness}"/>`;
        }
        
        svg += `</svg>`;
        return svg;
    }

    function downloadSVG(lineLength, lineThickness) {
        const svg = generateSVG(lineLength, lineThickness);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cations.svg';
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
    redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
    
    // Запускаем анимацию
    requestAnimationFrame(animate);

    function freezeCrosses() {
        if (!document.getElementById('cations-content').classList.contains('active')) {
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
    window.addEventListener('redraw-cations', function() {
        redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
    });
}); 