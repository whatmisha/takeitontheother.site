document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('plusRaysCanvas');
    const ctx = canvas.getContext('2d');
    const lengthSlider = document.getElementById('plusRaysLengthSlider');
    const lengthInput = document.getElementById('plusRaysLengthInput');
    const thicknessSlider = document.getElementById('plusRaysThicknessSlider');
    const thicknessInput = document.getElementById('plusRaysThicknessInput');
    const spacingSlider = document.getElementById('plusRaysSpacingSlider');
    const spacingInput = document.getElementById('plusRaysSpacingInput');

    // Фиксированные размеры canvas
    canvas.width = 1080;
    canvas.height = 1080;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const rayLength = Math.min(canvas.width, canvas.height) * 0.45;

    // Определяем переменные
    const raysSlider = document.getElementById('plusRaysRaysSlider');
    const raysInput = document.getElementById('plusRaysRaysInput');
    const baseAngles = [90, 100, 115, 140, 175, 220, 270, 325, 25];
    let angles = [...baseAngles];

    // Gravity controls
    const radiusSlider = document.getElementById('plusRaysRadiusSlider');
    const radiusInput = document.getElementById('plusRaysRadiusInput');
    const strengthSlider = document.getElementById('plusRaysStrengthSlider');
    const strengthInput = document.getElementById('plusRaysStrengthInput');
    const gravityMode = document.getElementById('plusRaysGravityMode');
    const randomMode = document.getElementById('plusRaysRandomMode');
    const exportSVGButton = document.getElementById('plusRaysExportSVG');
    const pauseIndicator = document.getElementById('plusRaysPauseIndicator');

    let mouseX = centerX;
    let mouseY = centerY;
    let isRandom = false;
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
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    });

    // Обработка клавиши 'e' для экспорта SVG
    document.addEventListener('keydown', (e) => {
        if (e.key === 'e' && (e.metaKey || e.ctrlKey) && 
            document.getElementById('plus-rays-content').classList.contains('active')) {
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
        // Вызываем событие для экспорта SVG, которое будет обработано в script.js
        const event = new Event('plus-rays-export-svg');
        window.dispatchEvent(event);
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
            ctx.lineCap = 'butt';
            
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
        
        if (!document.getElementById('plus-rays-content').classList.contains('active')) {
            return; // Не анимируем, если вкладка не активна
        }
        
        if (lastTime === 0) {
            lastTime = currentTime;
            return;
        }
        
        deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // Если не в режиме случайного движения, не обновляем кресты
        if (!isRandom) {
            redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
            return;
        }
        
        // Обновляем случайное движение
        updateRandomWalker();
        
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
        
        // Гарантируем минимальное безопасное значение для расстояния между крестами
        spacing = Math.max(4, spacing);
        
        // Количество крестов на линии с ограничением максимального количества
        const count = Math.min(500, Math.max(1, Math.floor(distance / spacing)));
        
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
        
        // Используем текущие позиции крестов, включая те, которые были перемещены
        const currentCrosses = crosses;
        
        for (let i = 0; i < currentCrosses.length; i++) {
            const cross = currentCrosses[i];
            svg += `<line x1="${cross.x - lineLength/2}" y1="${cross.y}" x2="${cross.x + lineLength/2}" y2="${cross.y}" stroke="white" stroke-width="${lineThickness}" stroke-linecap="butt"/>`;
            svg += `<line x1="${cross.x}" y1="${cross.y - lineLength/2}" x2="${cross.x}" y2="${cross.y + lineLength/2}" stroke="white" stroke-width="${lineThickness}" stroke-linecap="butt"/>`;
        }
        
        svg += `</svg>`;
        return svg;
    }

    function downloadSVG(lineLength, lineThickness) {
        const svgString = generateSVG(lineLength, lineThickness);
        const blob = new Blob([svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plus-rays.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Инициализация
    angles = calculateAngles(parseInt(raysInput.value));
    redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
    
    // Запускаем анимацию
    requestAnimationFrame(animate);

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
    window.addEventListener('redraw-plus-rays', function() {
        redraw(parseFloat(lengthInput.value), parseFloat(thicknessInput.value), parseInt(spacingInput.value));
    });
}); 