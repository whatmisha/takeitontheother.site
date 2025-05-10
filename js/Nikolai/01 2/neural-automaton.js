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
        
        // Размер клетки для автомата
        this.cellSize = 8;
        
        // Массивы состояний
        this.imageData = null;
        this.currentState = null;
        this.nextState = null;
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
        
        for (let y = 0; y < this.height; y++) {
            this.currentState[y] = new Array(this.width);
            this.nextState[y] = new Array(this.width);
            
            for (let x = 0; x < this.width; x++) {
                // Получаем средний цвет для клетки
                this.currentState[y][x] = this.getCellAverageColor(x, y);
                this.nextState[y][x] = [...this.currentState[y][x]];
            }
        }
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
                // Применяем правила нейронного автомата
                const newState = this.applyRules(x, y);
                this.nextState[y][x] = newState;
            }
        }
        
        // Меняем местами текущее и следующее состояния
        [this.currentState, this.nextState] = [this.nextState, this.currentState];
    }
    
    applyRules(x, y) {
        const current = this.currentState[y][x];
        
        // Получаем состояния соседей (восемь соседей + текущая клетка)
        const neighbors = this.getNeighbors(x, y);
        
        // Вычисляем новое состояние на основе текущего и соседей
        const newState = [0, 0, 0];
        
        // Сумма значений соседей для каждого канала
        let sumR = 0, sumG = 0, sumB = 0;
        
        for (const neighbor of neighbors) {
            sumR += neighbor[0];
            sumG += neighbor[1];
            sumB += neighbor[2];
        }
        
        // Среднее значение
        const avgR = sumR / neighbors.length;
        const avgG = sumG / neighbors.length;
        const avgB = sumB / neighbors.length;
        
        // Добавляем шум
        const noiseR = (Math.random() * 2 - 1) * this.noiseLevel * 25.5;
        const noiseG = (Math.random() * 2 - 1) * this.noiseLevel * 25.5;
        const noiseB = (Math.random() * 2 - 1) * this.noiseLevel * 25.5;
        
        // Вычисляем новое состояние с элементами "нейронной" логики
        newState[0] = Math.min(255, Math.max(0, Math.round(
            current[0] * (1 - this.learningRate) + avgR * this.learningRate + noiseR
        )));
        newState[1] = Math.min(255, Math.max(0, Math.round(
            current[1] * (1 - this.learningRate) + avgG * this.learningRate + noiseG
        )));
        newState[2] = Math.min(255, Math.max(0, Math.round(
            current[2] * (1 - this.learningRate) + avgB * this.learningRate + noiseB
        )));
        
        return newState;
    }
    
    getNeighbors(x, y) {
        const neighbors = [];
        
        // Перебираем соседей (8 направлений + центр)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
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
    }

    setLearningRate(value) {
        this.learningRate = value / 100;
    }

    setNoiseLevel(value) {
        this.noiseLevel = value / 100;
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
}); 