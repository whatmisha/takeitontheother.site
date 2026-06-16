/**
 * Math utilities and unit conversion
 */
export class MathUtils {
    /**
     * Convert millimetres to points
     * @param {number} mm - value in millimetres
     * @returns {number} - value in points
     */
    static mmToPt(mm) {
        return mm * 2.83465;
    }

    /**
     * Convert points to millimetres
     * @param {number} pt - value in points
     * @returns {number} - value in millimetres
     */
    static ptToMm(pt) {
        return pt / 2.83465;
    }

    /**
     * Round a value to the given number of decimal places
     * @param {number} value - value to round
     * @param {number} decimals - number of decimal places
     * @returns {number}
     */
    static roundTo(value, decimals) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }

    /**
     * Clamp a value to the given range
     * @param {number} value - value
     * @param {number} min - minimum
     * @param {number} max - maximum
     * @returns {number}
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Snap a value to the nearest grid step
     * @param {number} value - value
     * @param {number} gridSize - grid size
     * @returns {number}
     */
    static snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    }

    /**
     * Convert Row + BaselineOffset to Y (position in baseline modules)
     * @param {number} row - row number
     * @param {number} baselineOffset - offset in baseline modules
     * @param {number} rowHeight - row height in modules
     * @returns {number}
     */
    static rowBaselineToY(row, baselineOffset, rowHeight) {
        // row * (rowHeight + 1) + baselineOffset
        // +1 is the gutter between rows (1 baseline module)
        return row * (rowHeight + 1) + baselineOffset;
    }

    /**
     * Convert Y (position in baseline modules) to Row + BaselineOffset
     * @param {number} y - position in baseline modules
     * @param {number} rowHeight - row height in modules
     * @returns {{row: number, baselineOffset: number}}
     */
    static yToRowBaseline(y, rowHeight) {
        const rowWithGutter = rowHeight + 1;
        const row = Math.floor(y / rowWithGutter);
        const baselineOffset = y % rowWithGutter;
        return { row, baselineOffset };
    }

    /**
     * Debounce a function - delays execution until calls stop
     * @param {Function} func - function to debounce
     * @param {number} wait - wait time in ms
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
     * Throttle a function - limits call frequency
     * @param {Function} func - function to throttle
     * @param {number} limit - minimum interval between calls in ms
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

