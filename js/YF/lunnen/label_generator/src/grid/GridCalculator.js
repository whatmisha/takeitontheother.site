/**
 * Калькулятор параметров сетки
 * Вычисляет количество строк, высоту строк, размер модуля и т.д.
 */
import { getSurfaceConfig, SURFACE_TYPES } from '../core/Constants.js';

export class GridCalculator {
    constructor(settings) {
        this.settings = settings;
        
        // Кэш для результатов вычислений
        this._cache = new Map();
        
        // Версия кэша для инвалидации
        this._cacheVersion = 0;
        
        // Ключ кэша на основе зависимых параметров
        this._cacheKey = null;
        
        // Подписка на изменения настроек для инвалидации кэша
        this._unsubscribe = settings.subscribe('*', () => {
            this._invalidateCache();
        });
    }
    
    /**
     * Инвалидирует кэш при изменении настроек
     * @private
     */
    _invalidateCache() {
        this._cacheVersion++;
        this._cache.clear();
        this._cacheKey = null;
    }
    
    /**
     * Генерирует ключ кэша на основе зависимых параметров
     * @param {Array<string>} dependencies - список ключей настроек, от которых зависит вычисление
     * @returns {string}
     * @private
     */
    _generateCacheKey(dependencies) {
        const values = dependencies.map(key => {
            const value = this.settings.get(key);
            // Для чисел используем фиксированную точность, чтобы избежать проблем с плавающей точкой
            if (typeof value === 'number') return value.toFixed(10);
            if (typeof value === 'object' && value !== null) return JSON.stringify(value);
            return String(value);
        });
        return `${this._cacheVersion}_${dependencies.join(',')}_${values.join(',')}`;
    }
    
    /**
     * Получить значение из кэша или вычислить и сохранить
     * @param {string} key - ключ кэша
     * @param {Array<string>} dependencies - зависимости для генерации ключа
     * @param {Function} computeFn - функция вычисления
     * @returns {*}
     * @private
     */
    _getCached(key, dependencies, computeFn) {
        const cacheKey = this._generateCacheKey(dependencies);
        const fullKey = `${key}_${cacheKey}`;
        
        if (this._cache.has(fullKey)) {
            return this._cache.get(fullKey);
        }
        
        const result = computeFn();
        this._cache.set(fullKey, result);
        return result;
    }

    /**
     * Получить конфигурацию поверхности
     * @param {string} surface - тип поверхности
     * @returns {Object}
     */
    getSurfaceConfig(surface = SURFACE_TYPES.FRONT) {
        const frontWidth = this.settings.get('frontWidth');
        const frontHeight = this.settings.get('frontHeight');
        
        const configs = getSurfaceConfig(
            frontWidth, 
            frontHeight
        );
        
        return configs[surface] || configs[SURFACE_TYPES.FRONT];
    }

    /**
     * Рассчитать количество строк, которые помещаются в формат
     */
    calculateRowCount() {
        return this._getCached(
            'rowCount',
            ['gridModule', 'margins', 'rowHeight', 'frontHeight'],
            () => {
                const module = this.settings.get('gridModule');
                const margins = this.settings.get('margins');
                const rowHeightInModules = this.settings.get('rowHeight');
                const frontHeight = this.settings.get('frontHeight');
                
                // Доступная высота = frontHeight - верхнее и нижнее поля
                const topMargin = module * margins;
                const bottomMargin = module * margins;
                const availableHeight = frontHeight - topMargin - bottomMargin;
                
                // Высота одной строки с промежутком
                const rowWithGutter = module * rowHeightInModules + module;
                
                // Вычисляем сколько строк поместится
                const rowCount = Math.floor((availableHeight + module) / rowWithGutter);
                
                return Math.max(1, rowCount);
            }
        );
    }

    /**
     * Рассчитать высоту строки на основе желаемого количества строк
     */
    calculateRowHeight() {
        return this._getCached(
            'rowHeight',
            ['gridModule', 'margins', 'rowCount', 'frontHeight'],
            () => {
                const module = this.settings.get('gridModule');
                const margins = this.settings.get('margins');
                const rowCount = this.settings.get('rowCount');
                const frontHeight = this.settings.get('frontHeight');
                
                // Доступная высота = frontHeight - верхнее и нижнее поля
                const topMargin = module * margins;
                const bottomMargin = module * margins;
                const availableHeight = frontHeight - topMargin - bottomMargin;
                
                // Формула: rowCount × rowHeight × module + (rowCount - 1) × module ≤ availableHeight
                // Решаем для rowHeight: rowHeight ≤ (availableHeight / module - rowCount + 1) / rowCount
                const availableModules = availableHeight / module;
                const rowHeight = Math.floor((availableModules - rowCount + 1) / rowCount);
                
                return Math.max(1, rowHeight);
            }
        );
    }

    /**
     * Рассчитать размер модуля для идеального заполнения формата
     */
    calculateModule() {
        return this._getCached(
            'module',
            ['frontHeight', 'margins', 'rowCount', 'rowHeight'],
            () => {
                const frontHeight = this.settings.get('frontHeight');
                const margins = this.settings.get('margins');
                const rowCount = this.settings.get('rowCount');
                const rowHeight = this.settings.get('rowHeight');
                
                // Формула: 2×margins + rowCount×rowHeight + (rowCount-1)×1 = total modules
                // Module = frontHeight / totalModules
                const totalModules = 2 * margins + rowCount * rowHeight + (rowCount - 1);
                const calculatedModule = frontHeight / totalModules;
                
                // Округляем вниз до 4 знаков после запятой для точного попадания
                return Math.floor(calculatedModule * 10000) / 10000;
            }
        );
    }

    /**
     * Найти все идеальные комбинации строк и высоты строк
     * @returns {Array<{rowCount: number, rowHeight: number, remaining: number}>}
     */
    findPerfectRowCombinations() {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const frontHeight = this.settings.get('frontHeight');
        
        const topMargin = module * margins;
        const bottomMargin = module * margins;
        const availableHeight = frontHeight - topMargin - bottomMargin;
        const availableModules = availableHeight / module;
        
        const combinations = [];
        
        // Пробуем разные высоты строк от 1 до 20
        for (let rowHeight = 1; rowHeight <= 20; rowHeight++) {
            // Вычисляем сколько строк поместится с этой высотой
            const rowWithGutter = rowHeight + 1; // высота строки + промежуток (1 модуль)
            const rowCount = Math.floor((availableModules + 1) / rowWithGutter);
            
            if (rowCount < 1) continue;
            
            // Проверяем заполняет ли эта комбинация формат идеально (или очень близко)
            const totalUsed = rowCount * rowHeight + (rowCount - 1);
            const remaining = availableModules - totalUsed;
            
            // Включаем только если остаток меньше 1 модуля (идеальное заполнение)
            if (remaining >= 0 && remaining < 1) {
                combinations.push({ rowCount, rowHeight, remaining });
            }
        }
        
        // Сортируем по количеству строк (по убыванию)
        combinations.sort((a, b) => b.rowCount - a.rowCount);
        
        return combinations;
    }

    /**
     * Рассчитать ширину колонки (для регулярной сетки или авто-ширину для кастомной)
     * При наличии fixedColumns возвращает ширину авто-колонок
     * @returns {number} - ширина в мм
     */
    calculateColumnWidth() {
        return this._getCached(
            'columnWidth',
            ['gridModule', 'margins', 'columnCount', 'frontWidth', 'fixedColumns'],
            () => {
                const module = this.settings.get('gridModule');
                const margins = this.settings.get('margins');
                const columnCount = this.settings.get('columnCount');
                const frontWidth = this.settings.get('frontWidth');
                const fixedColumns = this.settings.get('fixedColumns') || {};
                
                const totalGutters = module * (columnCount - 1);
                const totalMargins = module * margins * 2;
                
                // Суммируем ширины фиксированных колонок (только в пределах columnCount)
                const fixedKeys = Object.keys(fixedColumns).filter(k => {
                    const idx = parseInt(k);
                    return idx >= 1 && idx <= columnCount;
                });
                const fixedTotal = fixedKeys.reduce((sum, key) => sum + fixedColumns[key], 0);
                const autoCount = columnCount - fixedKeys.length;
                
                if (autoCount <= 0) {
                    // Все колонки фиксированные — возвращаем 0 (нет авто-колонок)
                    return 0;
                }
                
                // autoWidth = (frontWidth - margins - gutters - fixedTotal) / autoCount
                return (frontWidth - totalMargins - totalGutters - fixedTotal) / autoCount;
            }
        );
    }

    /**
     * Рассчитать массив ширин всех колонок (с учетом fixedColumns)
     * @returns {number[]} - массив ширин в мм, индекс 0 = колонка 1
     */
    calculateColumnWidths() {
        return this._getCached(
            'columnWidths',
            ['gridModule', 'margins', 'columnCount', 'frontWidth', 'fixedColumns'],
            () => {
                const columnCount = this.settings.get('columnCount');
                const fixedColumns = this.settings.get('fixedColumns') || {};
                const autoWidth = this.calculateColumnWidth();
                
                const widths = [];
                for (let i = 1; i <= columnCount; i++) {
                    if (fixedColumns[i] !== undefined) {
                        widths.push(fixedColumns[i]);
                    } else {
                        widths.push(autoWidth);
                    }
                }
                return widths;
            }
        );
    }

    /**
     * Проверить, есть ли фиксированные колонки
     * @returns {boolean}
     */
    hasFixedColumns() {
        const fixedColumns = this.settings.get('fixedColumns') || {};
        return Object.keys(fixedColumns).length > 0;
    }

    /**
     * Получить X-позицию начала колонки (в мм, от левого края контентной области)
     * @param {number} column - номер колонки (1-based)
     * @returns {number} - X в мм от начала контентной области (без учёта margin)
     */
    getColumnX(column) {
        const module = this.settings.get('gridModule');
        const widths = this.calculateColumnWidths();
        
        let x = 0;
        for (let i = 0; i < column - 1; i++) {
            x += widths[i] + module; // ширина колонки + gutter
        }
        return x;
    }

    /**
     * Рассчитать ширину спана из нескольких колонок (от startColumn до startColumn + span - 1)
     * @param {number} startColumn - начальная колонка (1-based)
     * @param {number} span - количество колонок
     * @returns {number} - ширина в мм
     */
    calculateSpanWidth(startColumn, span) {
        const module = this.settings.get('gridModule');
        const widths = this.calculateColumnWidths();
        
        let totalWidth = 0;
        for (let i = startColumn - 1; i < startColumn - 1 + span && i < widths.length; i++) {
            totalWidth += widths[i];
        }
        // Добавляем гаттеры между колонками спана
        totalWidth += module * (span - 1);
        
        return totalWidth;
    }

    /**
     * Рассчитать высоту строки в мм
     * @returns {number} - высота в мм
     */
    calculateRowHeightInMm() {
        return this._getCached(
            'rowHeightInMm',
            ['gridModule', 'rowHeight'],
            () => {
                const module = this.settings.get('gridModule');
                const rowHeightInModules = this.settings.get('rowHeight');
                return module * rowHeightInModules;
            }
        );
    }

    /**
     * Рассчитать ширину блока по количеству колонок
     * @param {number} widthInColumns - ширина в колонках
     * @param {number} [startColumn=1] - начальная колонка (1-based), используется при fixedColumns
     * @returns {number} - ширина в мм
     */
    calculateBlockWidth(widthInColumns, startColumn = 1) {
        if (this.hasFixedColumns()) {
            return this.calculateSpanWidth(startColumn, widthInColumns);
        }
        
        const module = this.settings.get('gridModule');
        const columnWidth = this.calculateColumnWidth();
        
        // Ширина блока = ширина колонки × количество + промежутки между ними
        return columnWidth * widthInColumns + module * (widthInColumns - 1);
    }

    /**
     * Рассчитать позицию блока в мм на основе колонки и строки
     * @param {Object} block - объект с параметрами {x, row, baselineOffset}
     * @param {number} scale - масштаб
     * @returns {{x: number, y: number}}
     */
    calculateBlockPosition(block, scale = 1) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const gutter = module;
        
        // Позиция X с учётом кастомных ширин колонок
        const columnX = this.getColumnX(block.x); // X от начала контентной области
        const x = (module * margins + columnX) * scale;
        
        // Позиция Y (на основе row и baselineOffset)
        const yInBaseline = this.rowBaselineToY(block.row, block.baselineOffset);
        const y = yInBaseline * (module * scale);
        
        return { x, y };
    }

    /**
     * Конвертация Row + BaselineOffset в Y (позиция в baseline модулях)
     * @param {number} row - номер строки
     * @param {number} baselineOffset - смещение в модулях baseline
     * @returns {number}
     */
    rowBaselineToY(row, baselineOffset) {
        const rowHeight = this.settings.get('rowHeight');
        // row * (rowHeight + 1) + baselineOffset
        // +1 это gutter между rows (1 модуль baseline)
        return row * (rowHeight + 1) + baselineOffset;
    }

    /**
     * Конвертация Y (позиция в baseline модулях) в Row + BaselineOffset
     * @param {number} y - позиция в baseline модулях
     * @returns {{row: number, baselineOffset: number}}
     */
    yToRowBaseline(y) {
        const rowHeight = this.settings.get('rowHeight');
        const rowWithGutter = rowHeight + 1;
        
        const row = Math.floor(y / rowWithGutter);
        const baselineOffset = y % rowWithGutter;
        
        return { row, baselineOffset };
    }

    /**
     * Получить максимальную позицию Y в baseline модулях
     * @returns {number}
     */
    getMaxYInBaseline() {
        return this._getCached(
            'maxYInBaseline',
            ['gridModule', 'margins', 'frontHeight'],
            () => {
                const module = this.settings.get('gridModule');
                const margins = this.settings.get('margins');
                const frontHeight = this.settings.get('frontHeight');
                
                const contentHeightMm = frontHeight - 2 * margins * module;
                return Math.floor(contentHeightMm / module);
            }
        );
    }

    /**
     * Получить общее количество baseline линий
     * @returns {number}
     */
    getTotalBaselines() {
        return this.getMaxYInBaseline();
    }

    /**
     * Получить ширину авто-колонки в мм (для обратной совместимости)
     * При наличии fixedColumns возвращает ширину авто-колонок
     * @returns {number}
     */
    getColumnWidth() {
        return this.calculateColumnWidth();
    }

    /**
     * Получить размер отступа между колонками (gutter) в pt
     * @returns {number}
     */
    getGutterSize() {
        return this.settings.get('gridModule');
    }

    /**
     * Конвертировать позицию сетки (колонка, строка, baseline) в координаты XY
     * @param {number} column - Номер колонки (1-based)
     * @param {number} row - Номер строки (0-based)
     * @param {number} baselineOffset - Смещение в baseline модулях внутри строки
     * @param {string} surface - Поверхность (front, left, right, top, bottom)
     * @returns {{x: number, y: number}}
     */
    gridPositionToXY(column, row, baselineOffset, surface = SURFACE_TYPES.FRONT) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const rowHeight = this.settings.get('rowHeight');
        
        // Базовый расчет для фронтальной панели
        const marginX = margins * module;
        const marginY = margins * module;
        const rowHeightMm = rowHeight * module;
        const baselineOffsetMm = baselineOffset * module;
        
        // Локальные координаты (относительно поверхности)
        // Используем getColumnX для корректного расчёта при кастомных колонках
        let localX = marginX + this.getColumnX(column);
        let localY = marginY + row * (rowHeightMm + module) + baselineOffsetMm;
        
        // Если не фронтальная панель, применяем трансформацию
        if (surface !== SURFACE_TYPES.FRONT) {
            const config = this.getSurfaceConfig(surface);
            return this.transformToSurfaceCoordinates(localX, localY, config);
        }
        
        // Для фронтальной панели добавляем смещение origin
        const frontConfig = this.getSurfaceConfig(SURFACE_TYPES.FRONT);
        return {
            x: frontConfig.origin.x + localX,
            y: frontConfig.origin.y + localY
        };
    }

    /**
     * Трансформировать локальные координаты в глобальные координаты поверхности
     * @param {number} localX - локальная X координата
     * @param {number} localY - локальная Y координата
     * @param {Object} config - конфигурация поверхности
     * @returns {{x: number, y: number}}
     */
    transformToSurfaceCoordinates(localX, localY, config) {
        const { origin, rotation, dimensions, coordinateTransform } = config;
        
        switch (coordinateTransform) {
            case 'leftRotation':
                // Левый торец: повернут на 90° по часовой
                // Текст должен читаться слева направо при повороте коробки на 90° против часовой
                return {
                    x: origin.x + localY,
                    y: origin.y + (dimensions.height - localX)
                };
                
            case 'rightRotation':
                // Правый торец: повернут на 90° против часовой (270° по часовой)
                // Текст должен читаться слева направо при повороте коробки на 90° по часовой
                return {
                    x: origin.x + (dimensions.width - localY),
                    y: origin.y + localX
                };
                
            case 'topRotation':
                // Верхний торец: повернут на 180°
                // Текст должен читаться слева направо при переворачивании коробки
                return {
                    x: origin.x + (dimensions.width - localX),
                    y: origin.y + (dimensions.height - localY)
                };
                
            default:
                // Bottom (без трансформации, только смещение origin)
                return {
                    x: origin.x + localX,
                    y: origin.y + localY
                };
        }
    }

    /**
     * Конвертировать координаты XY в позицию сетки
     * @param {number} x
     * @param {number} y
     * @returns {{column: number, row: number, baseline: number}}
     */
    xyToGridPosition(x, y) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const rowHeight = this.settings.get('rowHeight');
        const columnCount = this.settings.get('columnCount');
        
        const marginX = margins * module;
        const xInContent = x - marginX;
        
        // Вычисляем колонку — находим ближайшую по X
        const widths = this.calculateColumnWidths();
        let bestColumn = 1;
        let bestDist = Infinity;
        let colX = 0;
        for (let i = 0; i < widths.length; i++) {
            const colCenter = colX + widths[i] / 2;
            const dist = Math.abs(xInContent - colX);
            if (dist < bestDist) {
                bestDist = dist;
                bestColumn = i + 1;
            }
            colX += widths[i] + module;
        }
        const column = Math.max(1, Math.min(columnCount, bestColumn));
        
        // Вычисляем строку и baseline
        const marginY = margins * module;
        const yInContent = y - marginY;
        const rowHeightMm = rowHeight * module;
        const rowWithGutter = rowHeightMm + module;
        const row = Math.max(0, Math.floor(yInContent / rowWithGutter));
        const baselineInRow = yInContent - row * rowWithGutter;
        const baseline = Math.max(0, Math.round(baselineInRow / module));
        
        return { column, row, baseline };
    }

    /**
     * Расчет модуля из высоты и количества строк (для link mode)
     * @returns {number}
     */
    calculateModuleFromHeight() {
        return this._getCached(
            'moduleFromHeight',
            ['frontHeight', 'margins', 'rowCount', 'rowHeight'],
            () => {
                const frontHeight = this.settings.get('frontHeight');
                const margins = this.settings.get('margins');
                const rowCount = this.settings.get('rowCount');
                const rowHeight = this.settings.get('rowHeight');
                
                // Высота контента = frontHeight - 2 * margins * module
                // Высота контента = rowCount * rowHeight * module + (rowCount - 1) * module
                // Решаем для module:
                // frontHeight - 2 * margins * module = (rowCount * rowHeight + rowCount - 1) * module
                // frontHeight = module * (2 * margins + rowCount * rowHeight + rowCount - 1)
                // module = frontHeight / (2 * margins + rowCount * rowHeight + rowCount - 1)
                
                const totalModules = 2 * margins + rowCount * rowHeight + (rowCount - 1);
                return frontHeight / totalModules;
            }
        );
    }

    /**
     * Получить все параметры сетки для отладки
     * @returns {Object}
     */
    getGridInfo() {
        return {
            module: this.settings.get('gridModule'),
            margins: this.settings.get('margins'),
            columnCount: this.settings.get('columnCount'),
            rowCount: this.settings.get('rowCount'),
            rowHeight: this.settings.get('rowHeight'),
            columnWidth: this.getColumnWidth(),
            columnWidths: this.calculateColumnWidths(),
            fixedColumns: this.settings.get('fixedColumns') || {},
            gutterSize: this.getGutterSize(),
            totalBaselines: this.getTotalBaselines()
        };
    }
    
    /**
     * Очистить кэш (полезно для тестирования или принудительного пересчета)
     */
    clearCache() {
        this._invalidateCache();
    }
    
    /**
     * Получить статистику кэша (для отладки)
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this._cache.size,
            version: this._cacheVersion,
            keys: Array.from(this._cache.keys())
        };
    }
    
    /**
     * Уничтожить калькулятор и очистить ресурсы
     */
    destroy() {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
        this._cache.clear();
        this._cache = null;
    }
}

