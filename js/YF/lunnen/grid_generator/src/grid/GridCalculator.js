/**
 * Калькулятор параметров сетки
 * Вычисляет количество строк, высоту строк, размер модуля и т.д.
 */
import { getSurfaceConfig, SURFACE_TYPES } from '../core/Constants.js';

// Epsilon для компенсации ошибок округления IEEE 754 double precision.
// Достаточно мал, чтобы не влиять на реальные значения, но компенсирует
// накопленные ошибки floating-point арифметики.
const FP_EPSILON = 1e-9;

export class GridCalculator {
    constructor(settings) {
        this.settings = settings;
    }

    /**
     * Получить конфигурацию поверхности
     * @param {string} surface - тип поверхности
     * @returns {Object}
     */
    getSurfaceConfig(surface = SURFACE_TYPES.FRONT) {
        const frontWidth = this.settings.get('frontWidth');
        const frontHeight = this.settings.get('frontHeight');
        const thickness = this.settings.get('thickness');
        const showSidePanels = this.settings.get('showSidePanels');
        
        const configs = getSurfaceConfig(
            frontWidth, 
            frontHeight, 
            showSidePanels ? thickness : 0
        );
        
        return configs[surface] || configs[SURFACE_TYPES.FRONT];
    }

    /**
     * Рассчитать количество строк, которые помещаются в формат
     */
    calculateRowCount() {
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
        // FP_EPSILON компенсирует ошибки floating-point: без него 12.0 может стать 11.9999999999
        const rowCount = Math.floor((availableHeight + module) / rowWithGutter + FP_EPSILON);
        
        return Math.max(1, rowCount);
    }

    /**
     * Рассчитать высоту строки на основе желаемого количества строк
     */
    calculateRowHeight() {
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
        // FP_EPSILON компенсирует ошибки floating-point при делении
        const rowHeight = Math.floor((availableModules - rowCount + 1) / rowCount + FP_EPSILON);
        
        return Math.max(1, rowHeight);
    }

    /**
     * Рассчитать размер модуля для идеального заполнения формата
     * Учитывает блокировку полей
     */
    calculateModule() {
        const frontHeight = this.settings.get('frontHeight');
        const rowCount = this.settings.get('rowCount');
        const rowHeight = this.settings.get('rowHeight');
        const lockedMargins = this.settings.get('lockedMargins');
        const lockedMarginsValue = this.settings.get('lockedMarginsValue');
        
        // Если поля заблокированы, используем их значение в мм
        if (lockedMargins && lockedMarginsValue !== null) {
            // Формула: frontHeight = 2 * lockedMarginsValue + rowCount * rowHeight * module + (rowCount - 1) * module
            // frontHeight - 2 * lockedMarginsValue = module * (rowCount * rowHeight + rowCount - 1)
            // module = (frontHeight - 2 * lockedMarginsValue) / (rowCount * rowHeight + rowCount - 1)
            const contentHeight = frontHeight - 2 * lockedMarginsValue;
            const totalModules = rowCount * rowHeight + (rowCount - 1);
            if (totalModules > 0) {
                // Возвращаем точное значение без округления — epsilon-толерантность
                // в местах использования компенсирует ошибки floating-point
                return contentHeight / totalModules;
            }
        }
        
        // Стандартный расчет (если поля не заблокированы)
        const margins = this.settings.get('margins');
        const totalModules = 2 * margins + rowCount * rowHeight + (rowCount - 1);
        
        // Возвращаем точное значение. Раньше здесь было Math.floor(... * 10000) / 10000,
        // что занижало модуль до 0.0001, накапливая ошибку ~0.01мм на 100 модулях.
        // Теперь точное деление IEEE 754 даёт ошибку ~1e-14, что незаметно.
        return frontHeight / totalModules;
    }
    
    /**
     * Рассчитать поля на основе заблокированного модуля
     * Используется когда модуль заблокирован
     */
    calculateMargins() {
        const frontHeight = this.settings.get('frontHeight');
        const module = this.settings.get('gridModule');
        const rowCount = this.settings.get('rowCount');
        const rowHeight = this.settings.get('rowHeight');
        
        // Формула: frontHeight = 2 * margins * module + rowCount * rowHeight * module + (rowCount - 1) * module
        // frontHeight = module * (2 * margins + rowCount * rowHeight + rowCount - 1)
        // 2 * margins * module = frontHeight - module * (rowCount * rowHeight + rowCount - 1)
        // margins = (frontHeight - module * (rowCount * rowHeight + rowCount - 1)) / (2 * module)
        const contentHeight = rowCount * rowHeight * module + (rowCount - 1) * module;
        const availableForMargins = frontHeight - contentHeight;
        const marginsInMm = availableForMargins / 2;
        
        // Конвертируем в модули для хранения
        const marginsInMod = module > 0 ? marginsInMm / module : 0;
        
        return Math.max(0, parseFloat(marginsInMod.toFixed(4)));
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
            const rowCount = Math.floor((availableModules + 1) / rowWithGutter + FP_EPSILON);
            
            if (rowCount < 1) continue;
            
            // Проверяем заполняет ли эта комбинация формат идеально (или очень близко)
            const totalUsed = rowCount * rowHeight + (rowCount - 1);
            const remaining = availableModules - totalUsed;
            
            // Включаем только если остаток меньше 1 модуля (идеальное заполнение)
            // FP_EPSILON: remaining может быть -1e-14 из-за floating-point вместо 0
            if (remaining >= -FP_EPSILON && remaining < 1) {
                combinations.push({ rowCount, rowHeight, remaining: Math.max(0, remaining) });
            }
        }
        
        // Сортируем по количеству строк (по убыванию)
        combinations.sort((a, b) => b.rowCount - a.rowCount);
        
        return combinations;
    }

    /**
     * Рассчитать ширину колонки
     * @returns {number} - ширина в мм
     */
    calculateColumnWidth() {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const columnCount = this.settings.get('columnCount');
        const frontWidth = this.settings.get('frontWidth');
        
        // Формула: columnWidth = (frontWidth - module × margins × 2 - module × (n - 1)) / n
        return (frontWidth - module * margins * 2 - module * (columnCount - 1)) / columnCount;
    }

    /**
     * Рассчитать высоту строки в мм
     * @returns {number} - высота в мм
     */
    calculateRowHeightInMm() {
        const module = this.settings.get('gridModule');
        const rowHeightInModules = this.settings.get('rowHeight');
        return module * rowHeightInModules;
    }

    /**
     * Рассчитать ширину блока по количеству колонок
     * @param {number} widthInColumns - ширина в колонках
     * @returns {number} - ширина в мм
     */
    calculateBlockWidth(widthInColumns) {
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
        const columnWidth = this.calculateColumnWidth();
        const gutter = module;
        
        // Позиция X (учитывая левое поле и номер колонки)
        // Вычитаем 1, т.к. отсчет колонок начинается с 1
        const x = module * margins * scale + (block.x - 1) * (columnWidth * scale + gutter * scale);
        
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
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const frontHeight = this.settings.get('frontHeight');
        
        const contentHeightMm = frontHeight - 2 * margins * module;
        // FP_EPSILON: contentHeightMm / module должен давать целое число,
        // но из-за floating-point может быть 95.999999999 вместо 96
        return Math.floor(contentHeightMm / module + FP_EPSILON);
    }

    /**
     * Получить общее количество baseline линий
     * @returns {number}
     */
    getTotalBaselines() {
        return this.getMaxYInBaseline();
    }

    /**
     * Получить ширину одной колонки в pt
     * @returns {number}
     */
    getColumnWidth() {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const frontWidth = this.settings.get('frontWidth');
        const columnCount = this.settings.get('columnCount');
        
        const contentWidth = frontWidth - 2 * margins * module;
        const gutterWidth = module;
        
        return (contentWidth - (columnCount - 1) * gutterWidth) / columnCount;
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
        const columnWidth = this.getColumnWidth();
        const gutterSize = this.getGutterSize();
        const marginX = margins * module;
        const marginY = margins * module;
        const rowHeightMm = rowHeight * module;
        const baselineOffsetMm = baselineOffset * module;
        
        // Локальные координаты (относительно поверхности)
        let localX = marginX + (column - 1) * (columnWidth + gutterSize);
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
        
        // Вычисляем колонку
        const columnWidth = this.getColumnWidth();
        const gutterSize = this.getGutterSize();
        const marginX = margins * module;
        const xInContent = x - marginX;
        const column = Math.max(1, Math.round(xInContent / (columnWidth + gutterSize)) + 1);
        
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
            gutterSize: this.getGutterSize(),
            totalBaselines: this.getTotalBaselines()
        };
    }
}

