/**
 * RenderQueue - Система батчинга обновлений рендеринга
 * Оптимизирует множественные вызовы updateGrid() через requestAnimationFrame
 */
export class RenderQueue {
    constructor() {
        this.pendingUpdate = false;
        this.updateParams = {};
        this.callbacks = [];
        this.rafId = null;
    }

    /**
     * Запланировать обновление рендеринга
     * @param {Function} callback - Функция обновления
     * @param {Object} params - Дополнительные параметры
     */
    schedule(callback, params = {}) {
        // Добавляем callback в очередь
        if (!this.callbacks.includes(callback)) {
            this.callbacks.push(callback);
        }

        // Объединяем параметры
        Object.assign(this.updateParams, params);

        // Если обновление уже запланировано, ничего не делаем
        if (this.pendingUpdate) {
            return;
        }

        // Планируем обновление на следующий кадр
        this.pendingUpdate = true;
        this.rafId = requestAnimationFrame(() => this.flush());
    }

    /**
     * Выполнить все запланированные обновления
     */
    flush() {
        if (!this.pendingUpdate) return;

        try {
            // Выполняем все коллбэки
            this.callbacks.forEach(callback => {
                try {
                    callback(this.updateParams);
                } catch (error) {
                    console.error('Error in render callback:', error);
                }
            });
        } finally {
            // Очищаем состояние
            this.pendingUpdate = false;
            this.updateParams = {};
            this.callbacks = [];
            this.rafId = null;
        }
    }

    /**
     * Отменить запланированное обновление
     */
    cancel() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.pendingUpdate = false;
        this.updateParams = {};
        this.callbacks = [];
    }

    /**
     * Проверка наличия запланированного обновления
     * @returns {boolean}
     */
    isPending() {
        return this.pendingUpdate;
    }

    /**
     * Немедленное выполнение обновлений (минуя RAF)
     */
    flushSync() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.flush();
    }
}

/**
 * Debouncer - Отложенное выполнение функции
 * Полезно для обработки пользовательского ввода
 */
export class Debouncer {
    constructor(delay = 300) {
        this.delay = delay;
        this.timerId = null;
    }

    /**
     * Запланировать выполнение функции
     * @param {Function} callback - Функция для выполнения
     */
    schedule(callback) {
        // Отменяем предыдущий таймер
        if (this.timerId) {
            clearTimeout(this.timerId);
        }

        // Планируем новый
        this.timerId = setTimeout(() => {
            this.timerId = null;
            callback();
        }, this.delay);
    }

    /**
     * Отменить запланированное выполнение
     */
    cancel() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * Немедленное выполнение
     * @param {Function} callback - Функция для выполнения
     */
    flushSync(callback) {
        this.cancel();
        callback();
    }

    /**
     * Проверка наличия запланированного выполнения
     * @returns {boolean}
     */
    isPending() {
        return this.timerId !== null;
    }
}

/**
 * Throttler - Ограничитель частоты выполнения
 * Гарантирует минимальный интервал между вызовами
 */
export class Throttler {
    constructor(interval = 16) { // ~60fps
        this.interval = interval;
        this.lastCall = 0;
        this.timerId = null;
    }

    /**
     * Выполнить функцию с ограничением частоты
     * @param {Function} callback - Функция для выполнения
     */
    execute(callback) {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;

        if (timeSinceLastCall >= this.interval) {
            // Можем выполнить немедленно
            this.lastCall = now;
            callback();
        } else {
            // Планируем выполнение после истечения интервала
            if (this.timerId) {
                clearTimeout(this.timerId);
            }

            const delay = this.interval - timeSinceLastCall;
            this.timerId = setTimeout(() => {
                this.lastCall = Date.now();
                this.timerId = null;
                callback();
            }, delay);
        }
    }

    /**
     * Отменить запланированное выполнение
     */
    cancel() {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * Сбросить таймер последнего вызова
     */
    reset() {
        this.lastCall = 0;
        this.cancel();
    }
}

