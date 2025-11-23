/**
 * Рендерер сетки
 * Отвечает за отрисовку колонок, строк, baseline и других элементов сетки
 */
import { DOMUtils } from '../utils/DOMUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { SVG } from '../core/Constants.js';

export class GridRenderer {
    constructor(settings, calculator) {
        this.settings = settings;
        this.calculator = calculator;
        this.currentLuminance = 0.5; // Кэш для светимости
    }

    /**
     * Получить контрастный цвет для сетки
     * @returns {string}
     */
    getGridColor() {
        const bgColor = this.settings.get('boxColor');
        this.currentLuminance = ColorUtils.getLuminance(bgColor);
        return ColorUtils.getContrastColor(bgColor);
    }

    /**
     * Получить прозрачность сетки
     * @param {number} baseOpacity
     * @returns {number}
     */
    getGridOpacity(baseOpacity) {
        return ColorUtils.getGridOpacity(this.currentLuminance, baseOpacity);
    }

    /**
     * Отрисовать колонки на основной панели
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     */
    drawColumns(container, x, y, width, height, scale) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const n = this.settings.get('columnCount');
        const gridColor = this.getGridColor();
        const opacity = this.getGridOpacity(0.08);
        
        const columnWidth = this.calculator.calculateColumnWidth();
        const margin = module * margins * scale;
        const scaledColumnWidth = columnWidth * scale;
        const gutter = module * scale;
        
        let currentX = x + margin;
        
        for (let i = 0; i < n; i++) {
            DOMUtils.createSVGElement('rect', {
                x: currentX,
                y: y + margin,
                width: scaledColumnWidth,
                height: height - 2 * margin,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentX += scaledColumnWidth + gutter;
        }
    }

    /**
     * Отрисовать строки на основной панели
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     */
    drawRows(container, x, y, width, height, scale) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const n = this.settings.get('rowCount');
        const rowHeightInModules = this.settings.get('rowHeight');
        const gridColor = this.getGridColor();
        const opacity = this.getGridOpacity(0.08);
        
        const topMargin = module * margins * scale;
        const sideMargin = module * margins * scale;
        const rowHeight = module * rowHeightInModules * scale;
        const rowWidth = width - 2 * sideMargin;
        const gutter = module * scale;
        
        let currentY = y + topMargin;
        
        for (let i = 0; i < n; i++) {
            if (currentY + rowHeight > y + height) {
                break;
            }
            
            DOMUtils.createSVGElement('rect', {
                x: x + sideMargin,
                y: currentY,
                width: rowWidth,
                height: rowHeight,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentY += rowHeight + gutter;
        }
    }

    /**
     * Отрисовать baseline сетку на основной панели
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     */
    drawBaseline(container, x, y, width, height, scale) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const gridColor = this.getGridColor();
        const opacity = this.getGridOpacity(0.15);
        const margin = module * margins * scale;
        const baselineHeight = module * scale;
        const baselineWidth = width - 2 * margin;
        const strokeWidth = scale === 1 ? SVG.EXPORT_STROKE_WIDTH : SVG.DISPLAY_STROKE_WIDTH;
        
        let currentY = y + margin;
        const maxY = y + height - margin;
        
        while (currentY + baselineHeight <= maxY) {
            DOMUtils.createSVGElement('rect', {
                x: x + margin,
                y: currentY,
                width: baselineWidth,
                height: baselineHeight,
                fill: 'none',
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
            
            currentY += baselineHeight;
        }
    }

    /**
     * Отрисовать колонки на левой/правой боковых панелях
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     * @param {string} side - 'left' или 'right'
     */
    drawColumnsVerticalLeftRight(container, x, y, width, height, scale, side) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const n = this.settings.get('rowCount');
        const rowHeightInModules = this.settings.get('rowHeight');
        const gridColor = this.getGridColor();
        const opacity = this.getGridOpacity(0.08);
        
        let columnHeight = module * rowHeightInModules * scale;
        const margin = module * margins * scale;
        const gutter = module * scale;
        let columnWidth = width - 2 * margin;
        
        const minColumnWidth = module * scale;
        let columnX = x + margin;
        if (columnWidth < minColumnWidth) {
            columnWidth = minColumnWidth;
            columnX = x + (width - columnWidth) / 2;
        }
        
        const minColumnHeight = module * scale;
        if (columnHeight < minColumnHeight) {
            columnHeight = minColumnHeight;
        }
        
        let currentY = y + margin;
        
        for (let i = 0; i < n; i++) {
            if (currentY + columnHeight > y + height - margin) {
                break;
            }
            
            DOMUtils.createSVGElement('rect', {
                x: columnX,
                y: currentY,
                width: columnWidth,
                height: columnHeight,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentY += columnHeight + gutter;
        }
    }

    /**
     * Отрисовать колонки на верхней/нижней боковых панелях
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     * @param {string} side - 'top' или 'bottom'
     */
    drawColumnsTopBottom(container, x, y, width, height, scale, side) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const n = this.settings.get('columnCount');
        const gridColor = this.getGridColor();
        const opacity = this.getGridOpacity(0.08);
        
        const columnWidth = this.calculator.calculateColumnWidth();
        const margin = module * margins * scale;
        const scaledColumnWidth = columnWidth * scale;
        const gutter = module * scale;
        let columnHeight = height - 2 * margin;
        
        const minColumnHeight = module * scale;
        let columnY = y + margin;
        if (columnHeight < minColumnHeight) {
            columnHeight = minColumnHeight;
            columnY = y + (height - columnHeight) / 2;
        }
        
        let currentX = x + margin;
        
        for (let i = 0; i < n; i++) {
            DOMUtils.createSVGElement('rect', {
                x: currentX,
                y: columnY,
                width: scaledColumnWidth,
                height: columnHeight,
                fill: gridColor,
                'fill-opacity': opacity,
                stroke: 'none'
            }, container);
            
            currentX += scaledColumnWidth + gutter;
        }
    }

    /**
     * Отрисовать baseline на левой/правой боковых панелях
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     * @param {string} side - 'left' или 'right'
     */
    drawBaselineVerticalLeftRight(container, x, y, width, height, scale, side) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const gridColor = this.getGridColor();
        const opacity = this.getGridOpacity(0.15);
        const margin = module * margins * scale;
        const baselineWidth = module * scale;
        const strokeWidth = scale === 1 ? SVG.EXPORT_STROKE_WIDTH : SVG.DISPLAY_STROKE_WIDTH;
        
        const baselineHeight = height - 2 * margin;
        const availableWidth = width - 2 * margin;
        const numFullElements = Math.floor(availableWidth / baselineWidth);
        
        // Если элементы не помещаются, рисуем линию по центру
        if (numFullElements <= 0) {
            const centerX = x + width / 2;
            DOMUtils.createSVGElement('line', {
                x1: centerX,
                y1: y + margin,
                x2: centerX,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
            return;
        }
        
        let currentX;
        
        if (side === 'left') {
            // Левая панель: начинаем с правого края
            currentX = x + width - margin;
            
            for (let i = 0; i < numFullElements; i++) {
                const elementX = currentX - baselineWidth;
                
                DOMUtils.createSVGElement('rect', {
                    x: elementX,
                    y: y + margin,
                    width: baselineWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity,
                    'vector-effect': 'non-scaling-stroke'
                }, container);
                
                currentX -= baselineWidth;
            }
            
            // Линия на левом поле
            DOMUtils.createSVGElement('line', {
                x1: x + margin,
                y1: y + margin,
                x2: x + margin,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
            
        } else { // right
            // Правая панель: начинаем с левого края
            currentX = x + margin;
            
            for (let i = 0; i < numFullElements; i++) {
                DOMUtils.createSVGElement('rect', {
                    x: currentX,
                    y: y + margin,
                    width: baselineWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity,
                    'vector-effect': 'non-scaling-stroke'
                }, container);
                
                currentX += baselineWidth;
            }
            
            // Линия на правом поле
            DOMUtils.createSVGElement('line', {
                x1: x + width - margin,
                y1: y + margin,
                x2: x + width - margin,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
        }
    }

    /**
     * Отрисовать baseline на верхней/нижней боковых панелях
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     * @param {string} side - 'top' или 'bottom'
     */
    drawBaselineTopBottom(container, x, y, width, height, scale, side) {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const gridColor = this.getGridColor();
        const opacity = this.getGridOpacity(0.15);
        const margin = module * margins * scale;
        const baselineHeight = module * scale;
        const strokeWidth = scale === 1 ? SVG.EXPORT_STROKE_WIDTH : SVG.DISPLAY_STROKE_WIDTH;
        
        const baselineWidth = width - 2 * margin;
        const availableHeight = height - 2 * margin;
        const numFullElements = Math.floor(availableHeight / baselineHeight);
        
        // Если элементы не помещаются, рисуем линию по центру
        if (numFullElements <= 0) {
            const centerY = y + height / 2;
            DOMUtils.createSVGElement('line', {
                x1: x + margin,
                y1: centerY,
                x2: x + width - margin,
                y2: centerY,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
            return;
        }
        
        let currentY;
        
        if (side === 'top') {
            // Верхняя панель: начинаем с нижнего края
            currentY = y + height - margin;
            
            for (let i = 0; i < numFullElements; i++) {
                const elementY = currentY - baselineHeight;
                
                DOMUtils.createSVGElement('rect', {
                    x: x + margin,
                    y: elementY,
                    width: baselineWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity,
                    'vector-effect': 'non-scaling-stroke'
                }, container);
                
                currentY -= baselineHeight;
            }
            
            // Линия на верхнем поле
            DOMUtils.createSVGElement('line', {
                x1: x + margin,
                y1: y + margin,
                x2: x + width - margin,
                y2: y + margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
            
        } else { // bottom
            // Нижняя панель: начинаем с верхнего края
            currentY = y + margin;
            
            for (let i = 0; i < numFullElements; i++) {
                DOMUtils.createSVGElement('rect', {
                    x: x + margin,
                    y: currentY,
                    width: baselineWidth,
                    height: baselineHeight,
                    fill: 'none',
                    stroke: gridColor,
                    'stroke-width': strokeWidth,
                    'stroke-opacity': opacity,
                    'vector-effect': 'non-scaling-stroke'
                }, container);
                
                currentY += baselineHeight;
            }
            
            // Линия на нижнем поле
            DOMUtils.createSVGElement('line', {
                x1: x + margin,
                y1: y + height - margin,
                x2: x + width - margin,
                y2: y + height - margin,
                stroke: gridColor,
                'stroke-width': strokeWidth,
                'stroke-opacity': opacity,
                'vector-effect': 'non-scaling-stroke'
            }, container);
        }
    }

    /**
     * Главный метод отрисовки - рендерит всю сетку
     * @param {SVGElement} svg - SVG элемент для отрисовки
     */
    render(svg) {
        if (!svg) return;

        const frontWidth = this.settings.get('frontWidth');
        const frontHeight = this.settings.get('frontHeight');
        const showColumns = this.settings.get('showColumns');
        const showRows = this.settings.get('showRows');
        const showBaseline = this.settings.get('showBaseline');

        // Устанавливаем размеры SVG
        svg.setAttribute('width', frontWidth);
        svg.setAttribute('height', frontHeight);
        svg.setAttribute('viewBox', `0 0 ${frontWidth} ${frontHeight}`);

        // Координаты основной (фронтальной) панели
        const frontX = 0;
        const frontY = 0;

        // Отрисовка фронтальной панели
        this.drawFrontPanel(svg, frontX, frontY, frontWidth, frontHeight);

        // Отрисовка колонок
        if (showColumns) {
            this.drawColumns(svg, frontX, frontY, frontWidth, frontHeight, 1);
        }

        // Отрисовка строк
        if (showRows) {
            this.drawRows(svg, frontX, frontY, frontWidth, frontHeight, 1);
        }

        // Отрисовка baseline
        if (showBaseline) {
            this.drawBaseline(svg, frontX, frontY, frontWidth, frontHeight, 1);
        }
    }

    /**
     * Отрисовка фронтальной панели (фон)
     */
    drawFrontPanel(container, x, y, width, height) {
        const bgColor = this.settings.get('boxColor');
        
        DOMUtils.createSVGElement('rect', {
            x: x,
            y: y,
            width: width,
            height: height,
            fill: bgColor,
            stroke: 'none'
        }, container);
    }

}

