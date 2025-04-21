document.addEventListener('DOMContentLoaded', function() {
    // ================ НАСТРОЙКИ И ПЕРЕМЕННЫЕ ================
    // Размер холста
    const CANVAS_SIZE = 1080;
    
    // Центр холста
    const CENTER_X = CANVAS_SIZE / 2;
    const CENTER_Y = CANVAS_SIZE / 2;
    
    // Длина луча
    const RAY_LENGTH = CANVAS_SIZE * 0.45;
    
    // Базовые углы для лучей
    const BASE_ANGLES = [90, 100, 115, 140, 175, 220, 270, 325, 25];
    
    // Холсты
    const rayCanvas = document.getElementById('rayCanvas');
    const rayCtx = rayCanvas.getContext('2d');
    rayCanvas.width = CANVAS_SIZE;
    rayCanvas.height = CANVAS_SIZE;
    
    const cationsCanvas = document.getElementById('cationsCanvas');
    const cationsCtx = cationsCanvas.getContext('2d');
    cationsCanvas.width = CANVAS_SIZE;
    cationsCanvas.height = CANVAS_SIZE;
    
    // Элементы управления для Dotted Rays
    const sizeSlider = document.getElementById('sizeSlider');
    const sizeInput = document.getElementById('sizeInput');
    const spacingSlider = document.getElementById('spacingSlider');
    const spacingInput = document.getElementById('spacingInput');
    const raysSlider = document.getElementById('raysSlider');
    const raysInput = document.getElementById('raysInput');
    const radiusSlider = document.getElementById('radiusSlider');
    const radiusInput = document.getElementById('radiusInput');
    const strengthSlider = document.getElementById('strengthSlider');
    const strengthInput = document.getElementById('strengthInput');
    const gravityMode = document.getElementById('gravityMode');
    const randomMode = document.getElementById('randomMode');
    const exportSVGButton = document.getElementById('exportSVG');
    const pauseIndicator = document.getElementById('pauseIndicator');
    
    // Элементы управления для Cations
    const cationsLengthSlider = document.getElementById('cationsLengthSlider');
    const cationsLengthInput = document.getElementById('cationsLengthInput');
    const cationsThicknessSlider = document.getElementById('cationsThicknessSlider');
    const cationsThicknessInput = document.getElementById('cationsThicknessInput');
    const cationsSpacingSlider = document.getElementById('cationsSpacingSlider');
    const cationsSpacingInput = document.getElementById('cationsSpacingInput');
    const cationsRaysSlider = document.getElementById('cationsRaysSlider');
    const cationsRaysInput = document.getElementById('cationsRaysInput');
    const cationsRadiusSlider = document.getElementById('cationsRadiusSlider');
    const cationsRadiusInput = document.getElementById('cationsRadiusInput');
    const cationsStrengthSlider = document.getElementById('cationsStrengthSlider');
    const cationsStrengthInput = document.getElementById('cationsStrengthInput');
    const cationsGravityMode = document.getElementById('cationsGravityMode');
    const cationsRandomMode = document.getElementById('cationsRandomMode');
    const cationsExportSVGButton = document.getElementById('cationsExportSVG');
    const cationsPauseIndicator = document.getElementById('cationsPauseIndicator');
    
    // Глобальные переменные для состояния
    const state = {
        rays: {
            points: [],
            angles: [...BASE_ANGLES],
            mouseX: -1000, // Значение за пределами холста
            mouseY: -1000, // Значение за пределами холста
            isPaused: false,
            isRandom: false,
            randomWalkerVX: 0,
            randomWalkerVY: 0,
            lastRandomX: CENTER_X, // Последняя позиция random walker
            lastRandomY: CENTER_Y  // Последняя позиция random walker
        },
        cations: {
            crosses: [],
            angles: [...BASE_ANGLES],
            mouseX: -1000, // Значение за пределами холста
            mouseY: -1000, // Значение за пределами холста
            isPaused: false,
            isRandom: false,
            randomWalkerVX: 0,
            randomWalkerVY: 0,
            lastRandomX: CENTER_X, // Последняя позиция random walker
            lastRandomY: CENTER_Y  // Последняя позиция random walker
        }
    };
    
    // ================ ОБЩИЕ ФУНКЦИИ ================
    
    // Расчёт углов для дополнительных лучей
    function calculateAngles(additionalRaysPerSegment) {
        if (additionalRaysPerSegment <= 0) {
            return [...BASE_ANGLES];
        }
        
        let result = [];
        
        for (let i = 0; i < BASE_ANGLES.length; i++) {
            result.push(BASE_ANGLES[i]);
            
            const nextIdx = (i + 1) % BASE_ANGLES.length;
            let startAngle = BASE_ANGLES[i];
            let endAngle = BASE_ANGLES[nextIdx];
            
            if (endAngle < startAngle) {
                endAngle += 360;
            }
            
            const step = (endAngle - startAngle) / (additionalRaysPerSegment + 1);
            
            for (let j = 1; j <= additionalRaysPerSegment; j++) {
                let angle = startAngle + step * j;
                if (angle >= 360) {
                    angle -= 360;
                }
                result.push(angle);
            }
        }
        
        return result;
    }
    
    // Обновление случайной позиции
    function updateRandomPosition(stateObj) {
        // Если заморожено, не обновляем позицию
        if (stateObj.isPaused) return;
        
        // Увеличиваем случайное ускорение
        const acceleration = 2.0;
        stateObj.randomWalkerVX += (Math.random() - 0.5) * acceleration;
        stateObj.randomWalkerVY += (Math.random() - 0.5) * acceleration;
        
        // Увеличиваем максимальную скорость
        const maxSpeed = 15;
        const speed = Math.sqrt(stateObj.randomWalkerVX * stateObj.randomWalkerVX + stateObj.randomWalkerVY * stateObj.randomWalkerVY);
        if (speed > maxSpeed) {
            stateObj.randomWalkerVX = (stateObj.randomWalkerVX / speed) * maxSpeed;
            stateObj.randomWalkerVY = (stateObj.randomWalkerVY / speed) * maxSpeed;
        }
        
        // Обновляем позицию
        stateObj.mouseX += stateObj.randomWalkerVX;
        stateObj.mouseY += stateObj.randomWalkerVY;
        
        // Сохраняем последнюю позицию
        stateObj.lastRandomX = stateObj.mouseX;
        stateObj.lastRandomY = stateObj.mouseY;
        
        // Отражаем от границ canvas
        const padding = 50;
        if (stateObj.mouseX < padding) {
            stateObj.mouseX = padding;
            stateObj.randomWalkerVX *= -0.8;
        }
        if (stateObj.mouseX > CANVAS_SIZE - padding) {
            stateObj.mouseX = CANVAS_SIZE - padding;
            stateObj.randomWalkerVX *= -0.8;
        }
        if (stateObj.mouseY < padding) {
            stateObj.mouseY = padding;
            stateObj.randomWalkerVY *= -0.8;
        }
        if (stateObj.mouseY > CANVAS_SIZE - padding) {
            stateObj.mouseY = CANVAS_SIZE - padding;
            stateObj.randomWalkerVY *= -0.8;
        }
        
        // Обновляем последнюю позицию после отражения от границ
        stateObj.lastRandomX = stateObj.mouseX;
        stateObj.lastRandomY = stateObj.mouseY;
    }
    
    // Синхронизация слайдеров и числовых полей
    function syncInputs(slider, input, callback) {
        slider.addEventListener('input', () => {
            input.value = slider.value;
            if (callback) callback(slider.value);
        });
        
        input.addEventListener('input', () => {
            slider.value = input.value;
            if (callback) callback(input.value);
        });
    }
    
    // ================ DOTTED RAYS ================
    
    // Класс для точек
    class Point {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.originalX = x;
            this.originalY = y;
            this.vx = 0;
            this.vy = 0;
            this.active = false;
            this.randomAngle = Math.random() * Math.PI * 2;
            this.offsetX = 0;
            this.offsetY = 0;
        }
        
        update() {
            if (!this.active) {
                // Если точка не активна, просто возвращаемся без изменений
                return;
            }
            
            // Добавляем случайный дрейф
            const driftSpeed = 0.2;
            this.vx += Math.cos(this.randomAngle) * driftSpeed * 0.02;
            this.vy += Math.sin(this.randomAngle) * driftSpeed * 0.02;
            
            // Очень слабое притяжение к исходной позиции (почти отсутствует)
            const returnStrength = 0.00005;
            const dx = (this.originalX + this.offsetX) - this.x;
            const dy = (this.originalY + this.offsetY) - this.y;
            this.vx += dx * returnStrength;
            this.vy += dy * returnStrength;
            
            // Мягкое затухание для большей инерции
            const friction = 0.995;  // Было 0.99, делаем еще более плавное затухание
            this.vx *= friction;
            this.vy *= friction;
            
            // Обновляем позицию
            this.x += this.vx;
            this.y += this.vy;
            
            // Медленно меняем направление дрейфа и смещение
            this.randomAngle += (Math.random() - 0.5) * 0.1;
            this.offsetX += (Math.random() - 0.5) * 0.1;
            this.offsetY += (Math.random() - 0.5) * 0.1;
            
            // Ограничиваем максимальное смещение
            const maxOffset = 50;
            this.offsetX = Math.max(Math.min(this.offsetX, maxOffset), -maxOffset);
            this.offsetY = Math.max(Math.min(this.offsetY, maxOffset), -maxOffset);
            
            // Если скорость очень маленькая, деактивируем точку
            if (Math.abs(this.vx) < 0.01 && Math.abs(this.vy) < 0.01) {
                this.active = false;
            }
        }
        
        applyForce(cursorX, cursorY, radius, strength, isRepel) {
            const dx = cursorX - this.x;
            const dy = cursorY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                const angle = Math.atan2(dy, dx);
                const force = strength * (1 - distance / radius);
                
                if (isRepel) {
                    this.vx -= Math.cos(angle) * force * 2; // Увеличиваем множитель
                    this.vy -= Math.sin(angle) * force * 2;
                } else {
                    this.vx += Math.cos(angle) * force * 2;
                    this.vy += Math.sin(angle) * force * 2;
                }
                
                if (!this.active) {
                    this.active = true;
                }
            }
        }
    }
    
    // Создание линии с точками
    function createDottedLine(startX, startY, endX, endY, circleRadius, spacing) {
        const points = [];
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const count = Math.max(1, Math.floor(distance / spacing));
        const stepX = dx / count;
        const stepY = dy / count;
        
        for (let i = 0; i <= count; i++) {
            const x = startX + stepX * i;
            const y = startY + stepY * i;
            points.push(new Point(x, y));
        }
        
        return points;
    }
    
    // Отрисовка точек
    function drawPoints(ctx, points, circleRadius) {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        
        // Рисуем все точки
        for (const point of points) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
        }
        
        // Если включен режим рандома, рисуем оранжевую точку в позиции курсора
        if (state.rays.isRandom) {
            ctx.beginPath();
            ctx.arc(state.rays.mouseX, state.rays.mouseY, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'orange';
            ctx.fill();
        }
    }
    
    // Генерация лучей с точками
    function generateRayPoints(angles, circleRadius, spacing) {
        let allPoints = [];
        
        for (const angle of angles) {
            const radian = angle * (Math.PI / 180);
            const endX = CENTER_X + Math.cos(radian) * RAY_LENGTH;
            const endY = CENTER_Y + Math.sin(radian) * RAY_LENGTH;
            
            const linePoints = createDottedLine(
                CENTER_X, CENTER_Y, 
                endX, endY, 
                circleRadius, spacing
            );
            
            allPoints = allPoints.concat(linePoints);
        }
        
        return allPoints;
    }
    
    // Обновление всех точек
    function updatePoints(points, mouseX, mouseY, radius, strength, isRepel) {
        let hasActivePoints = false;
        
        for (const point of points) {
            point.applyForce(mouseX, mouseY, radius, strength, isRepel);
            point.update();
            
            if (point.active) {
                hasActivePoints = true;
            }
        }
        
        return hasActivePoints;
    }
    
    // Обновление элементов управления
    function updateRayControls(hasActivePoints) {
        // Разрешаем изменять размер точек даже когда они движутся
        // sizeSlider.disabled = hasActivePoints;
        // sizeInput.disabled = hasActivePoints;
        
        // Делаем слайдеры полупрозрачными, когда они неактивны
        if (hasActivePoints) {
            spacingSlider.classList.add('disabled-control');
            spacingInput.classList.add('disabled-control');
            raysSlider.classList.add('disabled-control');
            raysInput.classList.add('disabled-control');
        } else {
            spacingSlider.classList.remove('disabled-control');
            spacingInput.classList.remove('disabled-control');
            raysSlider.classList.remove('disabled-control');
            raysInput.classList.remove('disabled-control');
        }
        
        // Отключаем только слайдеры, которые нельзя изменять при движении
        spacingSlider.disabled = hasActivePoints;
        spacingInput.disabled = hasActivePoints;
        raysSlider.disabled = hasActivePoints;
        raysInput.disabled = hasActivePoints;
    }
    
    // Экспорт SVG
    function generateRaysSVG() {
        const circleRadius = parseInt(sizeInput.value) / 2;
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">`;
        svg += `<rect width="100%" height="100%" fill="black"/>`;
        
        for (const point of state.rays.points) {
            svg += `<circle cx="${point.x}" cy="${point.y}" r="${circleRadius}" fill="white"/>`;
        }
        
        svg += `</svg>`;
        return svg;
    }
    
    function downloadRaysSVG() {
        const svg = generateRaysSVG();
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
    
    // Обновление индикатора паузы
    function updateRaysPauseIndicator() {
        pauseIndicator.style.display = state.rays.isPaused ? 'block' : 'none';
    }
    
    // Переключение паузы для точек
    function toggleRaysPause() {
        state.rays.isPaused = !state.rays.isPaused;
        updateRaysPauseIndicator();
    }
    
    // Рендеринг кадра
    function renderRaysFrame() {
        if (!document.getElementById('dotted-rays-content').classList.contains('active')) {
            return;
        }
        
        // Если точки еще не созданы или их нужно пересоздать
        if (state.rays.points.length === 0) {
            const diameter = parseInt(sizeInput.value);
            const spacing = parseInt(spacingInput.value);
            state.rays.points = generateRayPoints(
                state.rays.angles, 
                diameter / 2, 
                spacing
            );
        }
        
        if (!state.rays.isPaused) {
            const radius = parseInt(radiusInput.value);
            const strength = parseInt(strengthInput.value) * 0.01;
            const isRepel = gravityMode.checked;
            
            // Обновляем случайную позицию, если включен режим рандома
            if (state.rays.isRandom) {
                updateRandomPosition(state.rays);
            }
            
            // Обновляем точки
            const hasActivePoints = updatePoints(
                state.rays.points, 
                state.rays.mouseX, 
                state.rays.mouseY, 
                radius, 
                strength, 
                isRepel
            );
            
            updateRayControls(hasActivePoints);
        }
        
        const diameter = parseInt(sizeInput.value);
        drawPoints(rayCtx, state.rays.points, diameter / 2);
    }
    
    // Инициализация Dotted Rays
    function initDottedRays() {
        // Обновление углов при изменении количества лучей
        function updateRayAngles(value) {
            state.rays.angles = calculateAngles(parseInt(value));
            state.rays.points = []; // Сбрасываем точки для пересоздания
        }
        
        // Сбрасываем точки при изменении размера или расстояния
        function resetRayPoints() {
            // Проверяем, есть ли активные точки
            const hasActivePoints = state.rays.points.some(point => point.active);
            
            // Если нет активных точек или анимация на паузе, сбрасываем массив точек
            if (!hasActivePoints || state.rays.isPaused) {
                state.rays.points = [];
            }
            // Если есть активные точки, не сбрасываем их
        }
        
        // Синхронизация контролов
        syncInputs(raysSlider, raysInput, updateRayAngles);
        syncInputs(sizeSlider, sizeInput, resetRayPoints);
        syncInputs(spacingSlider, spacingInput, resetRayPoints);
        syncInputs(radiusSlider, radiusInput);
        syncInputs(strengthSlider, strengthInput);
        
        // Случайное движение
        randomMode.addEventListener('click', function() {
            state.rays.isRandom = !state.rays.isRandom;
            this.textContent = state.rays.isRandom ? "Stop Random" : "Random";
            
            if (state.rays.isRandom) {
                // Инициализируем скорость
                state.rays.randomWalkerVX = 0;
                state.rays.randomWalkerVY = 0;
                
                // Используем последнюю сохраненную позицию или центр холста
                state.rays.mouseX = state.rays.lastRandomX;
                state.rays.mouseY = state.rays.lastRandomY;
            } else {
                // Сохраняем последнюю позицию перед выключением
                state.rays.lastRandomX = state.rays.mouseX;
                state.rays.lastRandomY = state.rays.mouseY;
                
                // Сбрасываем позицию мыши при выключении режима
                state.rays.mouseX = -1000;
                state.rays.mouseY = -1000;
            }
        });
        
        // Нажатие на канвас для заморозки
        rayCanvas.addEventListener('click', function() {
            toggleRaysPause();
        });
        
        // Экспорт SVG
        exportSVGButton.addEventListener('click', downloadRaysSVG);
        
        // Обработка движения мыши
        rayCanvas.addEventListener('mousemove', function(e) {
            if (!document.getElementById('dotted-rays-content').classList.contains('active')) {
                return;
            }
            
            // Если включен режим рандома, не обновляем позицию курсора
            if (state.rays.isRandom) {
                return;
            }
            
            const rect = rayCanvas.getBoundingClientRect();
            const scaleX = rayCanvas.width / rect.width;
            const scaleY = rayCanvas.height / rect.height;
            
            state.rays.mouseX = (e.clientX - rect.left) * scaleX;
            state.rays.mouseY = (e.clientY - rect.top) * scaleY;
        });
        
        // Обработка входа курсора на холст
        rayCanvas.addEventListener('mouseenter', function(e) {
            if (!document.getElementById('dotted-rays-content').classList.contains('active')) {
                return;
            }
            
            // Если включен режим рандома, не обновляем позицию курсора
            if (state.rays.isRandom) {
                return;
            }
            
            const rect = rayCanvas.getBoundingClientRect();
            const scaleX = rayCanvas.width / rect.width;
            const scaleY = rayCanvas.height / rect.height;
            
            state.rays.mouseX = (e.clientX - rect.left) * scaleX;
            state.rays.mouseY = (e.clientY - rect.top) * scaleY;
        });
        
        // Обработка выхода курсора с холста
        rayCanvas.addEventListener('mouseleave', function() {
            // Если включен режим рандома, не меняем позицию курсора
            if (state.rays.isRandom) {
                return;
            }
            
            // Устанавливаем позицию курсора за пределами холста
            state.rays.mouseX = -1000;
            state.rays.mouseY = -1000;
        });
        
        // Начальные значения
        updateRayAngles(raysInput.value);
    }
    
    // ================ CATIONS ================
    
    // Класс для крестов
    class Cross {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.originalX = x;
            this.originalY = y;
            this.vx = 0;
            this.vy = 0;
            this.active = false;
            this.randomAngle = Math.random() * Math.PI * 2;
            this.offsetX = 0;
            this.offsetY = 0;
        }
        
        update() {
            if (!this.active) {
                // Если крестик не активен, просто возвращаемся без изменений
                return;
            }
            
            // Добавляем случайный дрейф
            const driftSpeed = 0.2;
            this.vx += Math.cos(this.randomAngle) * driftSpeed * 0.02;
            this.vy += Math.sin(this.randomAngle) * driftSpeed * 0.02;
            
            // Очень слабое притяжение к исходной позиции (почти отсутствует)
            const returnStrength = 0.00005;
            const dx = (this.originalX + this.offsetX) - this.x;
            const dy = (this.originalY + this.offsetY) - this.y;
            this.vx += dx * returnStrength;
            this.vy += dy * returnStrength;
            
            // Мягкое затухание для большей инерции
            const friction = 0.995;  // Было 0.99, делаем еще более плавное затухание
            this.vx *= friction;
            this.vy *= friction;
            
            // Обновляем позицию
            this.x += this.vx;
            this.y += this.vy;
            
            // Медленно меняем направление дрейфа и смещение
            this.randomAngle += (Math.random() - 0.5) * 0.1;
            this.offsetX += (Math.random() - 0.5) * 0.1;
            this.offsetY += (Math.random() - 0.5) * 0.1;
            
            // Ограничиваем максимальное смещение
            const maxOffset = 50;
            this.offsetX = Math.max(Math.min(this.offsetX, maxOffset), -maxOffset);
            this.offsetY = Math.max(Math.min(this.offsetY, maxOffset), -maxOffset);
            
            // Если скорость очень маленькая, деактивируем крестик
            if (Math.abs(this.vx) < 0.01 && Math.abs(this.vy) < 0.01) {
                this.active = false;
            }
        }
        
        applyForce(cursorX, cursorY, radius, strength, isRepel) {
            const dx = cursorX - this.x;
            const dy = cursorY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < radius) {
                const angle = Math.atan2(dy, dx);
                const force = strength * (1 - distance / radius);
                
                if (isRepel) {
                    this.vx -= Math.cos(angle) * force * 2; // Увеличиваем множитель
                    this.vy -= Math.sin(angle) * force * 2;
                } else {
                    this.vx += Math.cos(angle) * force * 2;
                    this.vy += Math.sin(angle) * force * 2;
                }
                
                if (!this.active) {
                    this.active = true;
                }
            }
        }
        
        draw(ctx, lineLength, lineThickness) {
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
    
    // Создание линии с крестами
    function createCrossesLine(startX, startY, endX, endY, spacing) {
        const crosses = [];
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const count = Math.max(1, Math.floor(distance / spacing));
        const stepX = dx / count;
        const stepY = dy / count;
        
        for (let i = 0; i <= count; i++) {
            const x = startX + stepX * i;
            const y = startY + stepY * i;
            crosses.push(new Cross(x, y));
        }
        
        return crosses;
    }
    
    // Отрисовка крестов
    function drawCrosses(ctx, crosses, lineLength, lineThickness) {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        
        // Рисуем все кресты
        for (const cross of crosses) {
            cross.draw(ctx, lineLength, lineThickness);
        }
        
        // Если включен режим рандома, рисуем оранжевый крест в позиции курсора
        if (state.cations.isRandom) {
            ctx.save();
            ctx.translate(state.cations.mouseX, state.cations.mouseY);
            
            ctx.beginPath();
            ctx.moveTo(-lineLength / 2, 0);
            ctx.lineTo(lineLength / 2, 0);
            ctx.moveTo(0, -lineLength / 2);
            ctx.lineTo(0, lineLength / 2);
            
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = lineThickness;
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    // Генерация лучей с крестами
    function generateCationCrosses(angles, spacing) {
        let allCrosses = [];
        
        for (const angle of angles) {
            const radian = angle * (Math.PI / 180);
            const endX = CENTER_X + Math.cos(radian) * RAY_LENGTH;
            const endY = CENTER_Y + Math.sin(radian) * RAY_LENGTH;
            
            const lineCrosses = createCrossesLine(
                CENTER_X, CENTER_Y, 
                endX, endY, 
                spacing
            );
            
            allCrosses = allCrosses.concat(lineCrosses);
        }
        
        return allCrosses;
    }
    
    // Обновление всех крестов
    function updateCrosses(crosses, mouseX, mouseY, radius, strength, isRepel) {
        let hasActiveCrosses = false;
        
        for (const cross of crosses) {
            cross.applyForce(mouseX, mouseY, radius, strength, isRepel);
            cross.update();
            
            if (cross.active) {
                hasActiveCrosses = true;
            }
        }
        
        return hasActiveCrosses;
    }
    
    // Обновление элементов управления
    function updateCationsControls(hasActiveCrosses) {
        // Разрешаем изменять размер и толщину крестов даже когда они движутся
        // cationsLengthSlider.disabled = hasActiveCrosses;
        // cationsLengthInput.disabled = hasActiveCrosses;
        // cationsThicknessSlider.disabled = hasActiveCrosses;
        // cationsThicknessInput.disabled = hasActiveCrosses;
        
        // Делаем слайдеры полупрозрачными, когда они неактивны
        if (hasActiveCrosses) {
            cationsSpacingSlider.classList.add('disabled-control');
            cationsSpacingInput.classList.add('disabled-control');
            cationsRaysSlider.classList.add('disabled-control');
            cationsRaysInput.classList.add('disabled-control');
        } else {
            cationsSpacingSlider.classList.remove('disabled-control');
            cationsSpacingInput.classList.remove('disabled-control');
            cationsRaysSlider.classList.remove('disabled-control');
            cationsRaysInput.classList.remove('disabled-control');
        }
        
        // Отключаем только слайдеры, которые нельзя изменять при движении
        cationsSpacingSlider.disabled = hasActiveCrosses;
        cationsSpacingInput.disabled = hasActiveCrosses;
        cationsRaysSlider.disabled = hasActiveCrosses;
        cationsRaysInput.disabled = hasActiveCrosses;
    }
    
    // Экспорт SVG
    function generateCationsSVG() {
        const lineLength = parseFloat(cationsLengthInput.value);
        const lineThickness = parseFloat(cationsThicknessInput.value);
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">`;
        svg += `<rect width="100%" height="100%" fill="black"/>`;
        
        for (const cross of state.cations.crosses) {
            svg += `<line x1="${cross.x - lineLength/2}" y1="${cross.y}" x2="${cross.x + lineLength/2}" y2="${cross.y}" stroke="white" stroke-width="${lineThickness}"/>`;
            svg += `<line x1="${cross.x}" y1="${cross.y - lineLength/2}" x2="${cross.x}" y2="${cross.y + lineLength/2}" stroke="white" stroke-width="${lineThickness}"/>`;
        }
        
        svg += `</svg>`;
        return svg;
    }
    
    function downloadCationsSVG() {
        const svg = generateCationsSVG();
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
    
    // Обновление индикатора паузы
    function updateCationsPauseIndicator() {
        cationsPauseIndicator.style.display = state.cations.isPaused ? 'block' : 'none';
    }
    
    // Переключение паузы для крестов
    function toggleCationsPause() {
        state.cations.isPaused = !state.cations.isPaused;
        updateCationsPauseIndicator();
    }
    
    // Рендеринг кадра
    function renderCationsFrame() {
        if (!document.getElementById('cations-content').classList.contains('active')) {
            return;
        }
        
        // Если кресты еще не созданы или их нужно пересоздать
        if (state.cations.crosses.length === 0) {
            const spacing = parseInt(cationsSpacingInput.value);
            state.cations.crosses = generateCationCrosses(
                state.cations.angles, 
                spacing
            );
        }
        
        if (!state.cations.isPaused) {
            const radius = parseInt(cationsRadiusInput.value);
            const strength = parseInt(cationsStrengthInput.value) * 0.01;
            const isRepel = cationsGravityMode.checked;
            
            // Обновляем случайную позицию, если включен режим рандома
            if (state.cations.isRandom) {
                updateRandomPosition(state.cations);
            }
            
            // Обновляем кресты
            const hasActiveCrosses = updateCrosses(
                state.cations.crosses, 
                state.cations.mouseX, 
                state.cations.mouseY, 
                radius, 
                strength, 
                isRepel
            );
            
            updateCationsControls(hasActiveCrosses);
        }
        
        const lineLength = parseInt(cationsLengthInput.value);
        const lineThickness = parseInt(cationsThicknessInput.value);
        
        drawCrosses(cationsCtx, state.cations.crosses, lineLength, lineThickness);
    }
    
    // Инициализация Cations
    function initCations() {
        // Обновление углов при изменении количества лучей
        function updateCationAngles(value) {
            state.cations.angles = calculateAngles(parseInt(value));
            state.cations.crosses = []; // Сбрасываем кресты для пересоздания
        }
        
        // Сбрасываем кресты при изменении размера или расстояния
        function resetCationCrosses() {
            // Проверяем, есть ли активные кресты
            const hasActiveCrosses = state.cations.crosses.some(cross => cross.active);
            
            // Если нет активных крестов или анимация на паузе, сбрасываем массив крестов
            if (!hasActiveCrosses || state.cations.isPaused) {
                state.cations.crosses = [];
            }
            // Если есть активные кресты, не сбрасываем их
        }
        
        // Синхронизация контролов
        syncInputs(cationsRaysSlider, cationsRaysInput, updateCationAngles);
        syncInputs(cationsLengthSlider, cationsLengthInput, resetCationCrosses);
        syncInputs(cationsThicknessSlider, cationsThicknessInput, resetCationCrosses);
        syncInputs(cationsSpacingSlider, cationsSpacingInput, resetCationCrosses);
        syncInputs(cationsRadiusSlider, cationsRadiusInput);
        syncInputs(cationsStrengthSlider, cationsStrengthInput);
        
        // Случайное движение
        cationsRandomMode.addEventListener('click', function() {
            state.cations.isRandom = !state.cations.isRandom;
            this.textContent = state.cations.isRandom ? "Stop Random" : "Random";
            
            if (state.cations.isRandom) {
                // Инициализируем скорость
                state.cations.randomWalkerVX = 0;
                state.cations.randomWalkerVY = 0;
                
                // Используем последнюю сохраненную позицию или центр холста
                state.cations.mouseX = state.cations.lastRandomX;
                state.cations.mouseY = state.cations.lastRandomY;
            } else {
                // Сохраняем последнюю позицию перед выключением
                state.cations.lastRandomX = state.cations.mouseX;
                state.cations.lastRandomY = state.cations.mouseY;
                
                // Сбрасываем позицию мыши при выключении режима
                state.cations.mouseX = -1000;
                state.cations.mouseY = -1000;
            }
        });
        
        // Нажатие на канвас для заморозки
        cationsCanvas.addEventListener('click', function() {
            toggleCationsPause();
        });
        
        // Экспорт SVG
        cationsExportSVGButton.addEventListener('click', downloadCationsSVG);
        
        // Обработка движения мыши
        cationsCanvas.addEventListener('mousemove', function(e) {
            if (!document.getElementById('cations-content').classList.contains('active')) {
                return;
            }
            
            // Если включен режим рандома, не обновляем позицию курсора
            if (state.cations.isRandom) {
                return;
            }
            
            const rect = cationsCanvas.getBoundingClientRect();
            const scaleX = cationsCanvas.width / rect.width;
            const scaleY = cationsCanvas.height / rect.height;
            
            state.cations.mouseX = (e.clientX - rect.left) * scaleX;
            state.cations.mouseY = (e.clientY - rect.top) * scaleY;
        });
        
        // Обработка входа курсора на холст
        cationsCanvas.addEventListener('mouseenter', function(e) {
            if (!document.getElementById('cations-content').classList.contains('active')) {
                return;
            }
            
            // Если включен режим рандома, не обновляем позицию курсора
            if (state.cations.isRandom) {
                return;
            }
            
            const rect = cationsCanvas.getBoundingClientRect();
            const scaleX = cationsCanvas.width / rect.width;
            const scaleY = cationsCanvas.height / rect.height;
            
            state.cations.mouseX = (e.clientX - rect.left) * scaleX;
            state.cations.mouseY = (e.clientY - rect.top) * scaleY;
        });
        
        // Обработка выхода курсора с холста
        cationsCanvas.addEventListener('mouseleave', function() {
            // Если включен режим рандома, не меняем позицию курсора
            if (state.cations.isRandom) {
                return;
            }
            
            // Устанавливаем позицию курсора за пределами холста
            state.cations.mouseX = -1000;
            state.cations.mouseY = -1000;
        });
        
        // Начальные значения
        updateCationAngles(cationsRaysInput.value);
    }
    
    // ================ ОБЩАЯ ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ ================
    
    // Обработка переключения вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-content`).classList.add('active');
        });
    });
    
    // Обработка нажатия клавиши пробел для заморозки графики
    document.addEventListener('keydown', function(e) {
        if (e.code === 'Space' || e.key === ' ') {
            // Предотвращаем прокрутку страницы при нажатии пробела
            e.preventDefault();
            
            // Определяем активную вкладку и вызываем соответствующую функцию заморозки
            if (document.getElementById('dotted-rays-content').classList.contains('active')) {
                toggleRaysPause();
            } else if (document.getElementById('cations-content').classList.contains('active')) {
                toggleCationsPause();
            }
        }
        
        // Обработка комбинации Cmd+E для экспорта SVG
        if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyE' || e.key === 'e')) {
            // Предотвращаем стандартное поведение браузера (обычно открытие поиска)
            e.preventDefault();
            
            // Определяем активную вкладку и вызываем соответствующую функцию экспорта
            if (document.getElementById('dotted-rays-content').classList.contains('active')) {
                downloadRaysSVG();
            } else if (document.getElementById('cations-content').classList.contains('active')) {
                downloadCationsSVG();
            }
        }
    });
    
    // Функция анимации
    function animate() {
        renderRaysFrame();
        renderCationsFrame();
        requestAnimationFrame(animate);
    }
    
    // Инициализация и старт анимации
    initDottedRays();
    initCations();
    requestAnimationFrame(animate);
}); 