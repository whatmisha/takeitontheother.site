/**
 * Утилиты для работы с SVG
 */
import { DOMUtils } from '../utils/DOMUtils.js';
import { SVG } from '../core/Constants.js';

export class SVGUtils {
    /**
     * Отрисовать прямоугольники развертки коробки
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} frontW
     * @param {number} frontH
     * @param {number} thickness
     * @param {number} scale
     * @param {string} fillColor
     */
    static drawBoxRectangles(container, x, y, frontW, frontH, thickness, scale, fillColor) {
        const strokeWidth = scale === 1 ? SVG.EXPORT_STROKE_WIDTH : SVG.DISPLAY_STROKE_WIDTH;
        
        // Основная панель
        DOMUtils.createSVGElement('rect', {
            x: x,
            y: y,
            width: frontW,
            height: frontH,
            fill: fillColor,
            stroke: '#000000',
            'stroke-width': strokeWidth
        }, container);
    }

    /**
     * Отрисовать размеры (для режима отображения размеров)
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} frontW
     * @param {number} frontH
     * @param {number} thickness
     * @param {number} scale
     * @param {Object} dimensions - {frontWidth, frontHeight, thickness}
     */
    static drawDimensions(container, x, y, frontW, frontH, thickness, scale, dimensions) {
        const offset = scale === 1 ? 5 : 15;
        const fontSize = scale === 1 ? '3' : null;
        
        // Ширина основной панели (внизу)
        SVGUtils.createDimensionText(
            container,
            x + thickness + frontW / 2,
            y + thickness + frontH + offset,
            `${dimensions.frontWidth.toFixed(1)} mm`,
            'middle',
            fontSize
        );
        
        // Высота основной панели (справа)
        SVGUtils.createDimensionText(
            container,
            x + thickness + frontW + offset,
            y + thickness + frontH / 2,
            `${dimensions.frontHeight.toFixed(1)} mm`,
            'middle',
            fontSize
        );
        
        // Толщина (справа от правой панели)
        SVGUtils.createDimensionText(
            container,
            x + thickness + frontW + thickness + offset,
            y + thickness + frontH / 2,
            `${dimensions.thickness.toFixed(1)} mm`,
            'middle',
            fontSize
        );
    }

    /**
     * Создать текст с размером
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {string} text
     * @param {string} anchor
     * @param {string|null} fontSize
     */
    static createDimensionText(container, x, y, text, anchor = 'middle', fontSize = null) {
        const attrs = {
            x,
            y,
            'text-anchor': anchor,
            'dominant-baseline': 'middle'
        };
        
        if (fontSize) {
            // Режим экспорта
            attrs['font-size'] = fontSize;
            attrs['font-family'] = 'Arial, sans-serif';
            attrs['fill'] = '#666666';
        } else {
            // Режим отображения
            attrs['class'] = 'grid-text';
        }
        
        const textElement = DOMUtils.createSVGElement('text', attrs, container);
        textElement.textContent = text;
    }

    /**
     * Отрисовать метки панелей
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {number} frontW
     * @param {number} frontH
     * @param {number} thickness
     * @param {number} scale
     */
    static drawLabels(container, x, y, frontW, frontH, thickness, scale) {
        const fontSize = scale === 1 ? '4' : null;
        
        SVGUtils.createLabel(container, x + thickness + frontW / 2, y + thickness + frontH / 2, 'FRONT', false, fontSize);
        SVGUtils.createLabel(container, x + thickness / 2, y + thickness + frontH / 2, 'LEFT', true, fontSize);
        SVGUtils.createLabel(container, x + thickness + frontW + thickness / 2, y + thickness + frontH / 2, 'RIGHT', true, fontSize);
        SVGUtils.createLabel(container, x + thickness + frontW / 2, y + thickness / 2, 'TOP', false, fontSize);
        SVGUtils.createLabel(container, x + thickness + frontW / 2, y + thickness + frontH + thickness / 2, 'BOTTOM', false, fontSize);
    }

    /**
     * Создать метку
     * @param {SVGElement} container
     * @param {number} x
     * @param {number} y
     * @param {string} text
     * @param {boolean} rotate
     * @param {string|null} fontSize
     */
    static createLabel(container, x, y, text, rotate = false, fontSize = null) {
        const attrs = {
            x,
            y,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle'
        };
        
        if (fontSize) {
            attrs['font-size'] = fontSize;
            attrs['font-weight'] = '600';
            attrs['font-family'] = 'Arial, sans-serif';
            attrs['fill'] = '#999999';
        } else {
            attrs['class'] = 'grid-label';
        }
        
        if (rotate) {
            attrs['transform'] = `rotate(-90 ${x} ${y})`;
        }
        
        const textElement = DOMUtils.createSVGElement('text', attrs, container);
        textElement.textContent = text;
    }

    /**
     * Оптимизировать SVG для экспорта (удалить лишние атрибуты, сжать)
     * @param {string} svgString
     * @returns {string}
     */
    static optimizeForExport(svgString) {
        // Удаляем классы, которые используются только для отображения
        svgString = svgString.replace(/ class="[^"]*"/g, '');
        
        // Округляем координаты до разумного количества знаков
        svgString = svgString.replace(/(\d+\.\d{6,})/g, (match) => {
            return parseFloat(match).toFixed(4);
        });
        
        return svgString;
    }

    /**
     * Создать SVG viewBox на основе размеров
     * @param {number} width
     * @param {number} height
     * @returns {string}
     */
    static createViewBox(width, height) {
        return `0 0 ${width} ${height}`;
    }

    /**
     * Обработать загруженный SVG контент
     * @param {string} svgContent
     * @returns {{content: string, width: number, height: number}}
     */
    static processSVGContent(svgContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');
        
        if (!svgElement) {
            throw new Error('Invalid SVG content');
        }
        
        // Извлекаем размеры
        const viewBox = svgElement.getAttribute('viewBox');
        let width = 0, height = 0;
        
        if (viewBox) {
            const parts = viewBox.split(' ');
            width = parseFloat(parts[2]);
            height = parseFloat(parts[3]);
        } else {
            width = parseFloat(svgElement.getAttribute('width')) || 100;
            height = parseFloat(svgElement.getAttribute('height')) || 100;
        }
        
        // Извлекаем внутреннее содержимое SVG (без тега svg)
        const content = svgElement.innerHTML;
        
        return { content, width, height };
    }

    /**
     * Встроить SVG контент в группу с трансформацией
     * @param {SVGElement} container
     * @param {string} svgContent
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {SVGGElement}
     */
    static embedSVGContent(container, svgContent, x, y, width, height) {
        const group = DOMUtils.createSVGElement('g', {
            transform: `translate(${x}, ${y})`
        }, container);
        
        // Вставляем контент как innerHTML
        group.innerHTML = svgContent;
        
        // Масштабируем если нужно
        if (width || height) {
            const viewBox = `0 0 ${width} ${height}`;
            group.setAttribute('viewBox', viewBox);
        }
        
        return group;
    }
}

