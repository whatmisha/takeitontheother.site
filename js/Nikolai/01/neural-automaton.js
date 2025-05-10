class NeuralAutomaton {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isRunning = false;
        this.originalImage = new Image();
        this.originalImage.src = 'IMG_1250.jpg';
        
        this.originalImage.onload = () => {
            this.initializeCanvas();
            this.initializeNetwork();
        };

        // Параметры сети
        this.learningRate = 0.5;
        this.noiseLevel = 0.3;
        this.network = null;
    }

    initializeCanvas() {
        // Устанавливаем размеры canvas в зависимости от пропорций изображения
        const aspectRatio = this.originalImage.width / this.originalImage.height;
        if (aspectRatio > 1) {
            this.canvas.width = window.innerWidth * 0.5;
            this.canvas.height = this.canvas.width / aspectRatio;
        } else {
            this.canvas.height = window.innerHeight * 0.5;
            this.canvas.width = this.canvas.height * aspectRatio;
        }

        // Отрисовываем исходное изображение
        this.ctx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);
    }

    initializeNetwork() {
        // Создаем простую нейронную сеть
        this.network = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [this.canvas.height, this.canvas.width, 3],
                    kernelSize: 3,
                    filters: 16,
                    activation: 'relu',
                    padding: 'same'
                }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 3,
                    activation: 'sigmoid',
                    padding: 'same'
                })
            ]
        });

        // Компилируем модель
        this.network.compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: 'meanSquaredError'
        });
    }

    async processFrame() {
        if (!this.isRunning) return;

        try {
            // Получаем текущие данные изображения
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Нормализуем входные данные в диапазон [0-1]
            const tensor = tf.tidy(() => {
                return tf.browser.fromPixels(imageData)
                    .expandDims(0)
                    .div(255.0)
                    .clipByValue(0, 1);
            });

            // Добавляем шум в контролируемом диапазоне
            const noise = tf.tidy(() => {
                return tf.randomNormal(tensor.shape)
                    .mul(this.noiseLevel)
                    .clipByValue(-this.noiseLevel, this.noiseLevel);
            });

            // Складываем тензоры и нормализуем результат
            const noisyTensor = tf.tidy(() => {
                return tensor.add(noise)
                    .clipByValue(0, 1);
            });

            // Пропускаем через сеть
            const output = tf.tidy(() => {
                return this.network.predict(noisyTensor)
                    .clipByValue(0, 1);
            });
            
            // Отрисовываем результат
            const processedData = await tf.browser.toPixels(output.squeeze().mul(255));
            this.ctx.putImageData(new ImageData(processedData, this.canvas.width, this.canvas.height), 0, 0);

            // Очищаем память
            tensor.dispose();
            noise.dispose();
            noisyTensor.dispose();
            output.dispose();

            // Запускаем следующий кадр
            requestAnimationFrame(() => this.processFrame());
        } catch (error) {
            console.error('Ошибка при обработке кадра:', error);
            this.stop();
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
    }

    setLearningRate(value) {
        this.learningRate = value / 100;
        if (this.network) {
            this.network.compile({
                optimizer: tf.train.adam(this.learningRate),
                loss: 'meanSquaredError'
            });
        }
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