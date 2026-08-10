import { SVG } from '../core/Constants.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import {
    calculateBaselineRects,
    calculateColumnRects,
    calculateRowRects
} from './FrontGridGeometry.js';

/** Renders the front-surface grid for both the editor and exported SVG. */
export class GridRenderer {
    constructor(settings, calculator) {
        this.settings = settings;
        this.calculator = calculator;
        this.currentLuminance = 0.5;
    }

    getGridColor() {
        const background = this.settings.get('boxColor');
        this.currentLuminance = ColorUtils.getLuminance(background);
        return ColorUtils.getContrastColor(background);
    }

    getGridOpacity(baseOpacity) {
        return ColorUtils.getGridOpacity(this.currentLuminance, baseOpacity);
    }

    getGeometrySettings() {
        return {
            module: this.settings.get('gridModule'),
            margins: this.settings.get('margins')
        };
    }

    drawFilledRects(container, rects, opacity) {
        const color = this.getGridColor();
        const fillOpacity = this.getGridOpacity(opacity);
        rects.forEach(rect => DOMUtils.createSVGElement('rect', {
            ...rect,
            fill: color,
            'fill-opacity': fillOpacity,
            stroke: 'none'
        }, container));
    }

    drawColumns(container, x, y, width, height, scale) {
        const rects = calculateColumnRects({
            x,
            y,
            width,
            height,
            scale,
            ...this.getGeometrySettings(),
            columnCount: this.settings.get('columnCount'),
            columnWidth: this.calculator.calculateColumnWidth()
        });
        this.drawFilledRects(container, rects, 0.08);
    }

    drawRows(container, x, y, width, height, scale) {
        const rects = calculateRowRects({
            x,
            y,
            width,
            height,
            scale,
            ...this.getGeometrySettings(),
            rowCount: this.settings.get('rowCount'),
            rowHeight: this.settings.get('rowHeight')
        });
        this.drawFilledRects(container, rects, 0.08);
    }

    drawBaseline(container, x, y, width, height, scale) {
        const rects = calculateBaselineRects({
            x,
            y,
            width,
            height,
            scale,
            ...this.getGeometrySettings()
        });
        const color = this.getGridColor();
        const opacity = this.getGridOpacity(0.15);
        const strokeWidth = scale === 1
            ? SVG.EXPORT_STROKE_WIDTH
            : SVG.DISPLAY_STROKE_WIDTH;

        rects.forEach(rect => DOMUtils.createSVGElement('rect', {
            ...rect,
            fill: 'none',
            stroke: color,
            'stroke-width': strokeWidth,
            'stroke-opacity': opacity,
            'vector-effect': 'non-scaling-stroke'
        }, container));
    }
}
