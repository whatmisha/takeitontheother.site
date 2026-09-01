/**
 * Математические утилиты и конвертация единиц измерения
 */
export class MathUtils {
    /**
     * Конвертация миллиметров в пункты (points)
     * @param {number} mm - значение в миллиметрах
     * @returns {number} - значение в пунктах
     */
    static mmToPt(mm) {
        return mm * 2.83465;
    }

    /**
     * Конвертация пунктов в миллиметры
     * @param {number} pt - значение в пунктах
     * @returns {number} - значение в миллиметрах
     */
    static ptToMm(pt) {
        return pt / 2.83465;
    }

    /**
     * Округление значения до заданного количества знаков после запятой
     * @param {number} value - значение для округления
     * @param {number} decimals - количество знаков после запятой
     * @returns {number}
     */
    static roundTo(value, decimals) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }

    /**
     * Ограничение значения в заданном диапазоне
     * @param {number} value - значение
     * @param {number} min - минимум
     * @param {number} max - максимум
     * @returns {number}
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Привязка значения к ближайшему шагу сетки
     * @param {number} value - значение
     * @param {number} gridSize - размер сетки
     * @returns {number}
     */
    static snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    }

    /**
     * Конвертация Row + BaselineOffset в Y (позиция в baseline модулях)
     * @param {number} row - номер строки
     * @param {number} baselineOffset - смещение в модулях baseline
     * @param {number} rowHeight - высота строки в модулях
     * @returns {number}
     */
    static rowBaselineToY(row, baselineOffset, rowHeight) {
        // row * (rowHeight + 1) + baselineOffset
        // +1 это gutter между rows (1 модуль baseline)
        return row * (rowHeight + 1) + baselineOffset;
    }

    /**
     * Конвертация Y (позиция в baseline модулях) в Row + BaselineOffset
     * @param {number} y - позиция в baseline модулях
     * @param {number} rowHeight - высота строки в модулях
     * @returns {{row: number, baselineOffset: number}}
     */
    static yToRowBaseline(y, rowHeight) {
        const rowWithGutter = rowHeight + 1;
        const row = Math.floor(y / rowWithGutter);
        const baselineOffset = y % rowWithGutter;
        return { row, baselineOffset };
    }

    /**
     * Дебаунс функции - откладывает выполнение до прекращения вызовов
     * @param {Function} func - функция для дебаунса
     * @param {number} wait - время ожидания в мс
     * @returns {Function}
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Троттлинг функции - ограничивает частоту вызовов
     * @param {Function} func - функция для троттлинга
     * @param {number} limit - минимальный интервал между вызовами в мс
     * @returns {Function}
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

