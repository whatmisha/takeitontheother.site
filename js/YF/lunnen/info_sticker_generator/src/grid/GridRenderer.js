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
        const opacity = this.getGridOpacity(0.1);
        
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
        const opacity = this.getGridOpacity(0.1);
        
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
        const opacity = this.getGridOpacity(0.3);
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
        const totalWidth = frontWidth;
        const totalHeight = frontHeight;
        
        svg.setAttribute('width', totalWidth);
        svg.setAttribute('height', totalHeight);
        svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

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

