class NeuralAutomaton {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isRunning = false;
        this.originalImage = new Image();
        this.originalImage.src = 'IMG_1250.jpg';
        
        this.originalImage.onload = () => {
            this.initializeCanvas();
        };

        // Параметры сети
        this.learningRate = 0.5;
        this.noiseLevel = 0.3;
        
        // Новые параметры для более интересных эффектов
        this.activationThreshold = 0.2; // Порог активации (начиная с темных участков)
        this.evolutionSpeed = 0.05; // Скорость эволюции
        this.patternType = 'organic'; // Тип паттерна: 'organic', 'crystallize', 'flow'
        this.frameCount = 0; // Счетчик кадров
        
        // Размер клетки для автомата
        this.cellSize = 8;
        
        // Массивы состояний
        this.imageData = null;
        this.currentState = null;
        this.nextState = null;
        this.activationMap = null; // Карта активации клеток
    }

    initializeCanvas() {
        // Устанавливаем размеры canvas в зависимости от пропорций изображения
        const aspectRatio = this.originalImage.width / this.originalImage.height;
        if (aspectRatio > 1) {
            this.canvas.width = Math.min(window.innerWidth * 0.5, 800);
            this.canvas.height = this.canvas.width / aspectRatio;
        } else {
            this.canvas.height = Math.min(window.innerHeight * 0.5, 800);
            this.canvas.width = this.canvas.height * aspectRatio;
        }

        // Рисуем исходное изображение
        this.ctx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Получаем данные изображения
        this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Создаем начальное состояние
        this.initializeState();
    }
    
    initializeState() {
        // Создаем массивы для текущего и следующего состояния
        this.width = Math.ceil(this.canvas.width / this.cellSize);
        this.height = Math.ceil(this.canvas.height / this.cellSize);
        
        // Инициализируем массивы
        this.currentState = new Array(this.height);
        this.nextState = new Array(this.height);
        this.activationMap = new Array(this.height);
        
        for (let y = 0; y < this.height; y++) {
            this.currentState[y] = new Array(this.width);
            this.nextState[y] = new Array(this.width);
            this.activationMap[y] = new Array(this.width);
            
            for (let x = 0; x < this.width; x++) {
                // Получаем средний цвет для клетки
                this.currentState[y][x] = this.getCellAverageColor(x, y);
                this.nextState[y][x] = [...this.currentState[y][x]];
                
                // Инициализируем карту активации на основе яркости
                // Более темные участки будут активированы раньше
                const brightness = this.calculateBrightness(this.currentState[y][x]);
                this.activationMap[y][x] = 1.0 - brightness / 255; // Инвертируем, чтобы темные были активнее
            }
        }
    }
    
    calculateBrightness(color) {
        // Вычисляем воспринимаемую яркость (с учетом разного восприятия цветов)
        return 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];
    }
    
    getCellAverageColor(cellX, cellY) {
        // Получаем средний цвет для клетки
        const startX = cellX * this.cellSize;
        const startY = cellY * this.cellSize;
        const endX = Math.min(startX + this.cellSize, this.canvas.width);
        const endY = Math.min(startY + this.cellSize, this.canvas.height);
        
        let r = 0, g = 0, b = 0;
        let count = 0;
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * this.canvas.width + x) * 4;
                r += this.imageData.data[index];
                g += this.imageData.data[index + 1];
                b += this.imageData.data[index + 2];
                count++;
            }
        }
        
        if (count > 0) {
            return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
        } else {
            return [0, 0, 0];
        }
    }
    
    processFrame() {
        if (!this.isRunning) return;
        
        // Увеличиваем счетчик кадров
        this.frameCount++;
        
        // Обновляем состояние на основе правил
        this.updateState();
        
        // Отрисовываем новое состояние
        this.drawState();
        
        // Запускаем следующий кадр
        requestAnimationFrame(() => this.processFrame());
    }
    
    updateState() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Проверяем, активирована ли клетка
                if (this.activationMap[y][x] > this.activationThreshold) {
                    // Применяем правила нейронного автомата
                    const newState = this.applyRules(x, y);
                    this.nextState[y][x] = newState;
                    
                    // Постепенно увеличиваем активацию соседей
                    this.propagateActivation(x, y);
                } else {
                    // Если клетка не активирована, просто копируем текущее состояние
                    this.nextState[y][x] = [...this.currentState[y][x]];
                }
            }
        }
        
        // Меняем местами текущее и следующее состояния
        [this.currentState, this.nextState] = [this.nextState, this.currentState];
        
        // Обновляем порог активации со временем для постепенного распространения эффекта
        if (this.frameCount % 30 === 0) {
            this.activationThreshold = Math.max(0.05, this.activationThreshold - 0.01);
        }
    }
    
    propagateActivation(x, y) {
        // Распространяем активацию на соседей
        const neighbors = this.getNeighborCoordinates(x, y);
        
        for (const [nx, ny] of neighbors) {
            // Увеличиваем активацию соседних клеток
            this.activationMap[ny][nx] = Math.min(
                1.0,
                this.activationMap[ny][nx] + this.evolutionSpeed * Math.random()
            );
        }
    }
    
    getNeighborCoordinates(x, y) {
        const neighbors = [];
        
        // Перебираем соседей (8 направлений)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Пропускаем центральную клетку
                
                const nx = x + dx;
                const ny = y + dy;
                
                // Проверяем границы
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    neighbors.push([nx, ny]);
                }
            }
        }
        
        return neighbors;
    }
    
    applyRules(x, y) {
        const current = this.currentState[y][x];
        
        // Получаем состояния соседей
        const neighborValues = this.getNeighborValues(x, y);
        
        // Вычисляем новое состояние на основе текущего и соседей
        const newState = [0, 0, 0];
        
        // Применяем разные типы паттернов
        switch (this.patternType) {
            case 'organic':
                return this.applyOrganicPattern(current, neighborValues);
            case 'crystallize':
                return this.applyCrystallizePattern(current, neighborValues);
            case 'flow':
                return this.applyFlowPattern(current, neighborValues, x, y);
            default:
                return this.applyOrganicPattern(current, neighborValues);
        }
    }
    
    applyOrganicPattern(current, neighbors) {
        // Сумма значений соседей для каждого канала
        let sumR = 0, sumG = 0, sumB = 0;
        
        for (const neighbor of neighbors) {
            sumR += neighbor[0];
            sumG += neighbor[1];
            sumB += neighbor[2];
        }
        
        // Среднее значение
        const avgR = neighbors.length > 0 ? sumR / neighbors.length : current[0];
        const avgG = neighbors.length > 0 ? sumG / neighbors.length : current[1];
        const avgB = neighbors.length > 0 ? sumB / neighbors.length : current[2];
        
        // Добавляем нелинейности с помощью синусоидальных функций
        const phase = this.frameCount * 0.01;
        const factorR = 0.5 + 0.5 * Math.sin(phase + current[0] * 0.01);
        const factorG = 0.5 + 0.5 * Math.sin(phase + current[1] * 0.01 + 2.0);
        const factorB = 0.5 + 0.5 * Math.sin(phase + current[2] * 0.01 + 4.0);
        
        // Добавляем шум
        const noiseR = (Math.random() * 2 - 1) * this.noiseLevel * 25.5;
        const noiseG = (Math.random() * 2 - 1) * this.noiseLevel * 25.5;
        const noiseB = (Math.random() * 2 - 1) * this.noiseLevel * 25.5;
        
        // Вычисляем новое состояние с элементами "нейронной" логики
        const newR = Math.min(255, Math.max(0, Math.round(
            current[0] * (1 - this.learningRate * factorR) + avgR * this.learningRate * factorR + noiseR
        )));
        const newG = Math.min(255, Math.max(0, Math.round(
            current[1] * (1 - this.learningRate * factorG) + avgG * this.learningRate * factorG + noiseG
        )));
        const newB = Math.min(255, Math.max(0, Math.round(
            current[2] * (1 - this.learningRate * factorB) + avgB * this.learningRate * factorB + noiseB
        )));
        
        return [newR, newG, newB];
    }
    
    applyCrystallizePattern(current, neighbors) {
        // Находим наиболее часто встречающийся цвет среди соседей
        const colorCounts = {};
        let maxCount = 0;
        let dominantColor = current;
        
        for (const neighbor of neighbors) {
            const colorKey = neighbor.join(',');
            colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
            
            if (colorCounts[colorKey] > maxCount) {
                maxCount = colorCounts[colorKey];
                dominantColor = neighbor;
            }
        }
        
        // С некоторой вероятностью клетка становится доминантным цветом
        if (Math.random() < this.learningRate) {
            return [...dominantColor];
        } else {
            // Иначе добавляем небольшой шум
            return [
                Math.min(255, Math.max(0, current[0] + (Math.random() * 2 - 1) * 5)),
                Math.min(255, Math.max(0, current[1] + (Math.random() * 2 - 1) * 5)),
                Math.min(255, Math.max(0, current[2] + (Math.random() * 2 - 1) * 5))
            ];
        }
    }
    
    applyFlowPattern(current, neighbors, x, y) {
        // Создаем эффект течения в зависимости от координат
        const angle = Math.atan2(y - this.height / 2, x - this.width / 2);
        const distance = Math.sqrt((x - this.width / 2) ** 2 + (y - this.height / 2) ** 2);
        
        // Определяем направление потока
        const dirX = Math.cos(angle + this.frameCount * 0.01);
        const dirY = Math.sin(angle + this.frameCount * 0.01);
        
        // Находим соседа, ближайшего к направлению потока
        let closestNeighbor = current;
        let minDist = Number.MAX_VALUE;
        
        for (let i = 0; i < neighbors.length; i++) {
            const nx = i % 3 - 1;
            const ny = Math.floor(i / 3) - 1;
            
            const dist = Math.abs(nx - dirX) + Math.abs(ny - dirY);
            if (dist < minDist) {
                minDist = dist;
                closestNeighbor = neighbors[i];
            }
        }
        
        // Смешиваем текущий цвет с соседом в направлении потока
        return [
            Math.round(current[0] * (1 - this.learningRate) + closestNeighbor[0] * this.learningRate),
            Math.round(current[1] * (1 - this.learningRate) + closestNeighbor[1] * this.learningRate),
            Math.round(current[2] * (1 - this.learningRate) + closestNeighbor[2] * this.learningRate)
        ];
    }
    
    getNeighborValues(x, y) {
        const neighbors = [];
        
        // Перебираем соседей (8 направлений)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Пропускаем центральную клетку
                
                const nx = x + dx;
                const ny = y + dy;
                
                // Проверяем границы
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    neighbors.push(this.currentState[ny][nx]);
                }
            }
        }
        
        return neighbors;
    }
    
    drawState() {
        // Создаем новое изображение на основе состояния
        const imageData = new ImageData(this.canvas.width, this.canvas.height);
        
        // Заполняем пиксели
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const color = this.currentState[y][x];
                
                // Заполняем блок пикселей
                this.fillBlock(imageData, x, y, color);
            }
        }
        
        // Отрисовываем новое изображение
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    fillBlock(imageData, cellX, cellY, color) {
        const startX = cellX * this.cellSize;
        const startY = cellY * this.cellSize;
        const endX = Math.min(startX + this.cellSize, this.canvas.width);
        const endY = Math.min(startY + this.cellSize, this.canvas.height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * this.canvas.width + x) * 4;
                imageData.data[index] = color[0];
                imageData.data[index + 1] = color[1];
                imageData.data[index + 2] = color[2];
                imageData.data[index + 3] = 255; // Альфа-канал
            }
        }
    }

    start() {
        this.isRunning = true;
        this.processFrame();
    }

    stop() {
        this.isRunning = false;
    }

    reset() {
        this.stop();
        this.ctx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);
        this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.initializeState();
        this.frameCount = 0;
        this.activationThreshold = 0.2; // Сбрасываем порог активации
    }

    setLearningRate(value) {
        this.learningRate = value / 100;
    }

    setNoiseLevel(value) {
        this.noiseLevel = value / 100;
    }
    
    setPatternType(type) {
        this.patternType = type;
    }
}

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('imageCanvas');
    const automaton = new NeuralAutomaton(canvas);

    // Обработчики кнопок
    document.getElementById('startBtn').addEventListener('click', () => automaton.start());
    document.getElementById('stopBtn').addEventListener('click', () => automaton.stop());
    document.getElementById('resetBtn').addEventListener('click', () => automaton.reset());

    // Обработчики слайдеров
    document.getElementById('learningRate').addEventListener('input', (e) => {
        automaton.setLearningRate(e.target.value);
    });

    document.getElementById('noiseLevel').addEventListener('input', (e) => {
        automaton.setNoiseLevel(e.target.value);
    });
    
    // Обработчик выбора паттерна
    if (document.getElementById('patternType')) {
        document.getElementById('patternType').addEventListener('change', (e) => {
            automaton.setPatternType(e.target.value);
        });
    }
}); 