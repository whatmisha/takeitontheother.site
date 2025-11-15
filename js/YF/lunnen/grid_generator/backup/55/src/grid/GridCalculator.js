/**
 * Калькулятор параметров сетки
 * Вычисляет количество строк, высоту строк, размер модуля и т.д.
 */
export class GridCalculator {
    constructor(settings) {
        this.settings = settings;
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
        const rowCount = Math.floor((availableHeight + module) / rowWithGutter);
        
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
        const rowHeight = Math.floor((availableModules - rowCount + 1) / rowCount);
        
        return Math.max(1, rowHeight);
    }

    /**
     * Рассчитать размер модуля для идеального заполнения формата
     */
    calculateModule() {
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
        return Math.floor(contentHeightMm / module);
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
     * @returns {{x: number, y: number}}
     */
    gridPositionToXY(column, row, baselineOffset) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const rowHeight = this.settings.get('rowHeight');
        
        // X координата
        const columnWidth = this.getColumnWidth();
        const gutterSize = this.getGutterSize();
        const marginX = margins * module;
        const x = marginX + (column - 1) * (columnWidth + gutterSize);
        
        // Y координата
        const marginY = margins * module;
        const rowHeightMm = rowHeight * module;
        const baselineOffsetMm = baselineOffset * module;
        const y = marginY + row * (rowHeightMm + module) + baselineOffsetMm;
        
        return { x, y };
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

