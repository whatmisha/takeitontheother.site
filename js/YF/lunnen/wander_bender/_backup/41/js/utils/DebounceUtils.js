/**
 * DebounceUtils - Утилиты для debouncing с разными задержками
 * Используется для оптимизации производительности при обновлении UI
 */

// Хранилище таймеров для разных типов debouncing
const timers = new Map();

/**
 * Создает debounced функцию с заданной задержкой
 * @param {Function} fn - Функция для выполнения
 * @param {number} delay - Задержка в миллисекундах
 * @param {string} key - Уникальный ключ для группы debounced функций (опционально)
 * @returns {Function} Debounced функция
 */
export function debounce(fn, delay, key = 'default') {
    return function(...args) {
        const timerKey = `${key}_${delay}`;
        
        if (timers.has(timerKey)) {
            clearTimeout(timers.get(timerKey));
        }
        
        const timerId = setTimeout(() => {
            fn.apply(this, args);
            timers.delete(timerKey);
        }, delay);
        
        timers.set(timerKey, timerId);
    };
}

/**
 * Выполняет функцию немедленно, отменяя все pending debounced вызовы
 * @param {Function} fn - Функция для выполнения
 * @param {string} key - Ключ для отмены (опционально, отменяет все если не указан)
 */
export function cancelDebounce(key = null) {
    if (key) {
        // Отменяем все таймеры с этим ключом
        for (const [timerKey, timerId] of timers.entries()) {
            if (timerKey.startsWith(key)) {
                clearTimeout(timerId);
                timers.delete(timerKey);
            }
        }
    } else {
        // Отменяем все таймеры
        for (const timerId of timers.values()) {
            clearTimeout(timerId);
        }
        timers.clear();
    }
}

/**
 * Предустановленные задержки для разных типов параметров
 */
export const DEBOUNCE_DELAYS = {
    INSTANT: 0,        // Мгновенное обновление (mode switch, reset buttons)
    FAST: 50,         // Быстрое обновление (shape parameters)
    MEDIUM: 100,      // Среднее обновление (distribution parameters)
    SLOW: 200         // Медленное обновление (flow field parameters)
};

