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
    
    const plusRaysCanvas = document.getElementById('plusRaysCanvas');
    const plusRaysCtx = plusRaysCanvas.getContext('2d');
    plusRaysCanvas.width = CANVAS_SIZE;
    plusRaysCanvas.height = CANVAS_SIZE;
    
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
    
    // Элементы управления для Plus Rays
    const plusRaysLengthSlider = document.getElementById('plusRaysLengthSlider');
    const plusRaysLengthInput = document.getElementById('plusRaysLengthInput');
    const plusRaysThicknessSlider = document.getElementById('plusRaysThicknessSlider');
    const plusRaysThicknessInput = document.getElementById('plusRaysThicknessInput');
    const plusRaysSpacingSlider = document.getElementById('plusRaysSpacingSlider');
    const plusRaysSpacingInput = document.getElementById('plusRaysSpacingInput');
    const plusRaysRaysSlider = document.getElementById('plusRaysRaysSlider');
    const plusRaysRaysInput = document.getElementById('plusRaysRaysInput');
    const plusRaysRadiusSlider = document.getElementById('plusRaysRadiusSlider');
    const plusRaysRadiusInput = document.getElementById('plusRaysRadiusInput');
    const plusRaysStrengthSlider = document.getElementById('plusRaysStrengthSlider');
    const plusRaysStrengthInput = document.getElementById('plusRaysStrengthInput');
    const plusRaysGravityMode = document.getElementById('plusRaysGravityMode');
    const plusRaysRandomMode = document.getElementById('plusRaysRandomMode');
    const plusRaysExportSVGButton = document.getElementById('plusRaysExportSVG');
    
    // Глобальные переменные для состояния
    const state = {
        rays: {
            points: [],
            angles: [...BASE_ANGLES],
            mouseX: -1000, // Значение за пределами холста
            mouseY: -1000, // Значение за пределами холста
            isRandom: false,
            randomWalkerVX: 0,
            randomWalkerVY: 0,
            lastRandomX: CENTER_X, // Последняя позиция random walker
            lastRandomY: CENTER_Y  // Последняя позиция random walker
        },
        plusRays: {
            crosses: [],
            angles: [...BASE_ANGLES],
            mouseX: -1000, // Значение за пределами холста
            mouseY: -1000, // Значение за пределами холста
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
        // Если режим random не активен, не обновляем позицию
        if (!stateObj.isRandom) return;
        
        // Константы для случайного движения
        const maxSpeed = 5;
        const acceleration = 0.2;
        
        // Добавляем случайное ускорение (используем один вызов Math.random для оптимизации)
        const randomVal = Math.random() - 0.5;
        stateObj.randomWalkerVX += randomVal * acceleration;
        stateObj.randomWalkerVY += randomVal * acceleration;
        
        // Ограничиваем максимальную скорость (используем Math.min/max для оптимизации)
        stateObj.randomWalkerVX = Math.max(-maxSpeed, Math.min(maxSpeed, stateObj.randomWalkerVX));
        stateObj.randomWalkerVY = Math.max(-maxSpeed, Math.min(maxSpeed, stateObj.randomWalkerVY));
        
        // Обновляем позицию
        stateObj.lastRandomX += stateObj.randomWalkerVX;
        stateObj.lastRandomY += stateObj.randomWalkerVY;
        
        // Проверяем границы холста и отражаем при необходимости
        const canvasWidth = rayCanvas.width;
        const canvasHeight = rayCanvas.height;
        
        if (stateObj.lastRandomX < 0) {
            stateObj.lastRandomX = 0;
            stateObj.randomWalkerVX *= -1;
        } else if (stateObj.lastRandomX > canvasWidth) {
            stateObj.lastRandomX = canvasWidth;
            stateObj.randomWalkerVX *= -1;
        }
        
        if (stateObj.lastRandomY < 0) {
            stateObj.lastRandomY = 0;
            stateObj.randomWalkerVY *= -1;
        } else if (stateObj.lastRandomY > canvasHeight) {
            stateObj.lastRandomY = canvasHeight;
            stateObj.randomWalkerVY *= -1;
        }
        
        // Обновляем позицию мыши для эффекта гравитации
        stateObj.mouseX = stateObj.lastRandomX;
        stateObj.mouseY = stateObj.lastRandomY;
    }
    
    // Синхронизация слайдера и текстового поля
    function syncInputs(slider, input, callback) {
        // Проверяем, что оба элемента существуют
        if (!slider || !input) return;
        
        // Устанавливаем обработчик события для слайдера
        slider.addEventListener('input', function() {
            // Устанавливаем значение текстового поля равным значению слайдера
            input.value = this.value;
            
            // Если передан callback, вызываем его с новым значением
            if (typeof callback === 'function') {
                callback(this.value);
            }
        });
        
        // Устанавливаем обработчик события для текстового поля
        input.addEventListener('input', function() {
            // Проверяем, что введенное значение находится в допустимом диапазоне
            const value = parseInt(this.value);
            const min = parseInt(this.min);
            const max = parseInt(this.max);
            
            // Если значение вне диапазона, корректируем его
            if (value < min) this.value = min;
            if (value > max) this.value = max;
            
            // Устанавливаем значение слайдера равным значению текстового поля
            slider.value = this.value;
            
            // Если передан callback, вызываем его с новым значением
            if (typeof callback === 'function') {
                callback(this.value);
            }
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
        // Если нет контекста, выходим
        if (!ctx) return;
        
        // Очищаем холст
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        
        // Если нет точек, просто выходим после очистки
        if (!points || !points.length) return;
        
        // Сохраняем текущее состояние контекста
        ctx.save();
        
        // Устанавливаем стиль для всех точек
        ctx.fillStyle = 'white';
        
        // Отрисовываем каждую точку
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            
            // Пропускаем точки с нулевым радиусом
            if (circleRadius <= 0) continue;
            
            // Начинаем новый путь
            ctx.beginPath();
            
            // Рисуем круг
            ctx.arc(point.x, point.y, circleRadius, 0, Math.PI * 2);
            
            // Заполняем круг
            ctx.fill();
        }
        
        // Если включен режим рандома, рисуем оранжевую точку в позиции курсора
        if (state.rays.isRandom) {
            ctx.beginPath();
            ctx.arc(state.rays.mouseX, state.rays.mouseY, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'orange';
            ctx.fill();
        }
        
        // Восстанавливаем состояние контекста
        ctx.restore();
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
    
    // Новая функция для экспорта Dotted Rays SVG
    function downloadRaysSVG() {
        // Получаем текущие размеры и конфигурацию
        const circleRadius = parseInt(sizeInput.value) / 2;
        
        // Создаем SVG документ
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">`;
        svg += `<rect width="100%" height="100%" fill="black"/>`;
        
        // Если активен режим рандома, отрисовываем курсор в виде круга
        if (state.rays.isRandom) {
            svg += `<circle cx="${state.rays.mouseX}" cy="${state.rays.mouseY}" r="5" fill="orange"/>`;
        }
        
        // Добавляем все текущие точки
        for (const point of state.rays.points) {
            // Используем актуальные координаты точек
            svg += `<circle cx="${point.x}" cy="${point.y}" r="${circleRadius}" fill="white"/>`;
        }
        
        svg += `</svg>`;
        
        // Создаем и скачиваем файл
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
            if (!hasActivePoints || state.rays.isRandom) {
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
        
        // Экспорт SVG
        exportSVGButton.addEventListener('click', downloadRaysSVG);
    }
    
    // ================ PLUS RAYS ================
    
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
        // Если нет контекста, выходим
        if (!ctx) return;
        
        // Очищаем холст
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        
        // Если нет крестов, просто выходим после очистки
        if (!crosses || !crosses.length) return;
        
        // Сохраняем текущее состояние контекста
        ctx.save();
        
        // Устанавливаем стиль для всех крестов
        ctx.strokeStyle = 'white';
        ctx.lineWidth = lineThickness;
        ctx.lineCap = 'butt';
        
        // Отрисовываем каждый крест
        for (let i = 0; i < crosses.length; i++) {
            const cross = crosses[i];
            
            // Пропускаем кресты с нулевой длиной или толщиной
            if (lineLength <= 0 || lineThickness <= 0) continue;
            
            // Рисуем крест
            cross.draw(ctx, lineLength, lineThickness);
        }
        
        // Если включен режим рандома, рисуем оранжевый крест в позиции курсора
        if (state.plusRays.isRandom) {
            ctx.save();
            ctx.strokeStyle = 'orange';
            
            // Горизонтальная линия
            ctx.beginPath();
            ctx.moveTo(state.plusRays.mouseX - lineLength / 2, state.plusRays.mouseY);
            ctx.lineTo(state.plusRays.mouseX + lineLength / 2, state.plusRays.mouseY);
            ctx.stroke();
            
            // Вертикальная линия
            ctx.beginPath();
            ctx.moveTo(state.plusRays.mouseX, state.plusRays.mouseY - lineLength / 2);
            ctx.lineTo(state.plusRays.mouseX, state.plusRays.mouseY + lineLength / 2);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Восстанавливаем состояние контекста
        ctx.restore();
    }
    
    // Генерация лучей с крестами
    function generatePlusRayCrosses(angles, spacing) {
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
    function updatePlusRaysControls(hasActiveCrosses) {
        // Разрешаем изменять размер и толщину крестов даже когда они движутся
        // plusRaysLengthSlider.disabled = hasActiveCrosses;
        // plusRaysLengthInput.disabled = hasActiveCrosses;
        // plusRaysThicknessSlider.disabled = hasActiveCrosses;
        // plusRaysThicknessInput.disabled = hasActiveCrosses;
        
        // Делаем слайдеры полупрозрачными, когда они неактивны
        if (hasActiveCrosses) {
            plusRaysSpacingSlider.classList.add('disabled-control');
            plusRaysSpacingInput.classList.add('disabled-control');
            plusRaysRaysSlider.classList.add('disabled-control');
            plusRaysRaysInput.classList.add('disabled-control');
        } else {
            plusRaysSpacingSlider.classList.remove('disabled-control');
            plusRaysSpacingInput.classList.remove('disabled-control');
            plusRaysRaysSlider.classList.remove('disabled-control');
            plusRaysRaysInput.classList.remove('disabled-control');
        }
        
        // Отключаем только слайдеры, которые нельзя изменять при движении
        plusRaysSpacingSlider.disabled = hasActiveCrosses;
        plusRaysSpacingInput.disabled = hasActiveCrosses;
        plusRaysRaysSlider.disabled = hasActiveCrosses;
        plusRaysRaysInput.disabled = hasActiveCrosses;
    }
    
    // Новая функция для экспорта Plus Rays SVG
    function downloadPlusRaysSVG() {
        // Получаем текущие размеры и конфигурацию
        const lineLength = parseFloat(plusRaysLengthInput.value);
        const lineThickness = parseFloat(plusRaysThicknessInput.value);
        
        // Создаем SVG документ
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">`;
        svg += `<rect width="100%" height="100%" fill="black"/>`;
        
        // Если активен режим рандома, отрисовываем курсор
        if (state.plusRays.isRandom) {
            const cursorSize = lineLength;
            
            // Горизонтальная линия курсора
            svg += `<line x1="${state.plusRays.mouseX - cursorSize/2}" y1="${state.plusRays.mouseY}" 
                           x2="${state.plusRays.mouseX + cursorSize/2}" y2="${state.plusRays.mouseY}" 
                           stroke="orange" stroke-width="${lineThickness}" stroke-linecap="butt"/>`;
            
            // Вертикальная линия курсора
            svg += `<line x1="${state.plusRays.mouseX}" y1="${state.plusRays.mouseY - cursorSize/2}" 
                           x2="${state.plusRays.mouseX}" y2="${state.plusRays.mouseY + cursorSize/2}" 
                           stroke="orange" stroke-width="${lineThickness}" stroke-linecap="butt"/>`;
        }
        
        // Добавляем все текущие кресты
        for (const cross of state.plusRays.crosses) {
            // Используем актуальные координаты крестов
            svg += `<line x1="${cross.x - lineLength/2}" y1="${cross.y}" 
                           x2="${cross.x + lineLength/2}" y2="${cross.y}" 
                           stroke="white" stroke-width="${lineThickness}" stroke-linecap="butt"/>`;
            
            svg += `<line x1="${cross.x}" y1="${cross.y - lineLength/2}" 
                           x2="${cross.x}" y2="${cross.y + lineLength/2}" 
                           stroke="white" stroke-width="${lineThickness}" stroke-linecap="butt"/>`;
        }
        
        svg += `</svg>`;
        
        // Создаем и скачиваем файл
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plus-rays.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Рендеринг кадра
    function renderPlusRaysFrame() {
        if (!document.getElementById('plus-rays-content').classList.contains('active')) {
            return;
        }
        
        // Если кресты еще не созданы или их нужно пересоздать
        if (state.plusRays.crosses.length === 0) {
            const spacing = parseInt(plusRaysSpacingInput.value);
            state.plusRays.crosses = generatePlusRayCrosses(
                state.plusRays.angles, 
                spacing
            );
        }
        
        const radius = parseInt(plusRaysRadiusInput.value);
        const strength = parseInt(plusRaysStrengthInput.value) * 0.01;
        const isRepel = plusRaysGravityMode.checked;
        
        // Обновляем случайную позицию, если включен режим рандома
        if (state.plusRays.isRandom) {
            updateRandomPosition(state.plusRays);
        }
        
        // Обновляем кресты
        const hasActiveCrosses = updateCrosses(
            state.plusRays.crosses, 
            state.plusRays.mouseX, 
            state.plusRays.mouseY, 
            radius, 
            strength, 
            isRepel
        );
        
        updatePlusRaysControls(hasActiveCrosses);
        
        const lineLength = parseInt(plusRaysLengthInput.value);
        const lineThickness = parseInt(plusRaysThicknessInput.value);
        
        drawCrosses(plusRaysCtx, state.plusRays.crosses, lineLength, lineThickness);
    }
    
    // Инициализация Plus Rays
    function initPlusRays() {
        // Обновление углов при изменении количества лучей
        function updatePlusRayAngles(value) {
            state.plusRays.angles = calculateAngles(parseInt(value));
            state.plusRays.crosses = []; // Сбрасываем кресты для пересоздания
        }
        
        // Сбрасываем кресты при изменении размера или расстояния
        function resetPlusRayCrosses() {
            // Проверяем, есть ли активные кресты
            const hasActiveCrosses = state.plusRays.crosses.some(cross => cross.active);
            
            // Если нет активных крестов или анимация на паузе, сбрасываем массив крестов
            if (!hasActiveCrosses || state.plusRays.isRandom) {
                state.plusRays.crosses = [];
            }
            // Если есть активные кресты, не сбрасываем их
        }
        
        // Синхронизация контролов
        syncInputs(plusRaysRaysSlider, plusRaysRaysInput, updatePlusRayAngles);
        syncInputs(plusRaysLengthSlider, plusRaysLengthInput, resetPlusRayCrosses);
        syncInputs(plusRaysThicknessSlider, plusRaysThicknessInput, resetPlusRayCrosses);
        syncInputs(plusRaysSpacingSlider, plusRaysSpacingInput, resetPlusRayCrosses);
        syncInputs(plusRaysRadiusSlider, plusRaysRadiusInput);
        syncInputs(plusRaysStrengthSlider, plusRaysStrengthInput);
        
        // Случайное движение
        plusRaysRandomMode.addEventListener('click', function() {
            state.plusRays.isRandom = !state.plusRays.isRandom;
            this.textContent = state.plusRays.isRandom ? "Stop Random" : "Random";
            
            if (state.plusRays.isRandom) {
                // Инициализируем скорость
                state.plusRays.randomWalkerVX = 0;
                state.plusRays.randomWalkerVY = 0;
                
                // Используем последнюю сохраненную позицию или центр холста
                state.plusRays.mouseX = state.plusRays.lastRandomX;
                state.plusRays.mouseY = state.plusRays.lastRandomY;
            } else {
                // Сохраняем последнюю позицию перед выключением
                state.plusRays.lastRandomX = state.plusRays.mouseX;
                state.plusRays.lastRandomY = state.plusRays.mouseY;
                
                // Сбрасываем позицию мыши при выключении режима
                state.plusRays.mouseX = -1000;
                state.plusRays.mouseY = -1000;
            }
        });
        
        // Обработка движения мыши
        plusRaysCanvas.addEventListener('mousemove', function(e) {
            if (!document.getElementById('plus-rays-content').classList.contains('active')) {
                return;
            }
            
            // Если включен режим рандома, не обновляем позицию курсора
            if (state.plusRays.isRandom) {
                return;
            }
            
            const rect = plusRaysCanvas.getBoundingClientRect();
            const scaleX = plusRaysCanvas.width / rect.width;
            const scaleY = plusRaysCanvas.height / rect.height;
            
            state.plusRays.mouseX = (e.clientX - rect.left) * scaleX;
            state.plusRays.mouseY = (e.clientY - rect.top) * scaleY;
        });
        
        // Обработка входа курсора на холст
        plusRaysCanvas.addEventListener('mouseenter', function(e) {
            if (!document.getElementById('plus-rays-content').classList.contains('active')) {
                return;
            }
            
            // Если включен режим рандома, не обновляем позицию курсора
            if (state.plusRays.isRandom) {
                return;
            }
            
            const rect = plusRaysCanvas.getBoundingClientRect();
            const scaleX = plusRaysCanvas.width / rect.width;
            const scaleY = plusRaysCanvas.height / rect.height;
            
            state.plusRays.mouseX = (e.clientX - rect.left) * scaleX;
            state.plusRays.mouseY = (e.clientY - rect.top) * scaleY;
        });
        
        // Обработка выхода курсора с холста
        plusRaysCanvas.addEventListener('mouseleave', function() {
            // Если включен режим рандома, не меняем позицию курсора
            if (state.plusRays.isRandom) {
                return;
            }
            
            // Устанавливаем позицию курсора за пределами холста
            state.plusRays.mouseX = -1000;
            state.plusRays.mouseY = -1000;
        });
        
        // Начальные значения
        updatePlusRayAngles(plusRaysRaysInput.value);
        
        // Экспорт SVG
        plusRaysExportSVGButton.addEventListener('click', downloadPlusRaysSVG);
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
            
            // Отправляем событие о смене вкладки
            window.dispatchEvent(new Event('tab-changed'));
        });
    });
    
    // Обработка события rays-export-svg
    window.addEventListener('rays-export-svg', function() {
        downloadRaysSVG();
    });

    // Обработка события plus-rays-export-svg
    window.addEventListener('plus-rays-export-svg', function() {
        downloadPlusRaysSVG();
    });
    
    // Обработка клавиш для экспорта SVG
    document.addEventListener('keydown', function(e) {
        if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            
            // Определяем, какая вкладка активна
            const dottedRaysActive = document.getElementById('dotted-rays-content').classList.contains('active');
            const plusRaysActive = document.getElementById('plus-rays-content').classList.contains('active');
            const gridActive = document.getElementById('grid-content').classList.contains('active');
            
            if (dottedRaysActive) {
                downloadRaysSVG();
            } else if (plusRaysActive) {
                downloadPlusRaysSVG();
            } else if (gridActive) {
                // Вызываем событие для экспорта SVG Grid
                const event = new Event('grid-export-svg');
                window.dispatchEvent(event);
            }
        }
    });
    
    // Основная функция анимации
    function animate() {
        // Запрашиваем следующий кадр анимации
        requestAnimationFrame(animate);
        
        // Проверяем, какая вкладка активна
        const dottedRaysActive = document.getElementById('dotted-rays-content').classList.contains('active');
        const plusRaysActive = document.getElementById('plus-rays-content').classList.contains('active');
        const gridActive = document.getElementById('grid-content').classList.contains('active');
        
        // Отрисовываем только активную вкладку
        if (dottedRaysActive) {
            renderRaysFrame();
        } else if (plusRaysActive) {
            renderPlusRaysFrame();
        } else if (gridActive) {
            // Вызываем событие для отрисовки сетки
            const event = new Event('grid-render-frame');
            window.dispatchEvent(event);
        }
    }
    
    // Инициализация и старт анимации
    initDottedRays();
    initPlusRays();
    requestAnimationFrame(animate);
}); 