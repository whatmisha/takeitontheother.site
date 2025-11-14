/**
 * TextRenderer - Отрисовка текстовых блоков в SVG
 * Word wrapping, расчет размеров шрифта, интерактивность
 */
import { DOMUtils } from '../utils/DOMUtils.js';
import { MathUtils } from '../utils/MathUtils.js';

export class TextRenderer {
    constructor(settings, gridCalculator) {
        this.settings = settings;
        this.gridCalculator = gridCalculator;
        
        // Коэффициенты для шрифтов (x-height к font-size)
        this.fontMetrics = {
            'LunnenDisplay': {
                xHeightRatio: 0.54, // x-height / font-size
                capHeightRatio: 0.70,
                baseline: 0.20
            },
            'TT Commons': {
                xHeightRatio: 0.52,
                capHeightRatio: 0.72,
                baseline: 0.22
            }
        };
    }

    /**
     * Отрисовка всех текстовых блоков
     */
    renderAll(container, textBlocks, scale = 1) {
        // Создаем группу для текстовых блоков
        const textGroup = DOMUtils.createSVGElement('g', {
            id: 'textBlocks',
            class: 'text-blocks'
        });

        textBlocks.forEach(block => {
            if (block.visible) {
                const blockElement = this.renderBlock(block, scale);
                if (blockElement) {
                    textGroup.appendChild(blockElement);
                }
            }
        });

        container.appendChild(textGroup);
    }

    /**
     * Отрисовка одного текстового блока
     */
    renderBlock(block, scale = 1) {
        if (!block.content) return null;

        // Получаем стиль текста
        const style = this.getTextStyle(block.styleRef);
        if (!style) return null;

        // Вычисляем позицию на сетке
        const position = this.calculatePosition(block);
        
        // Вычисляем ширину в пикселях
        const width = this.calculateWidth(block);

        // Создаем группу для блока
        const blockGroup = DOMUtils.createSVGElement('g', {
            id: block.id,
            class: 'text-block',
            'data-block-id': block.id,
            'data-style': block.styleRef,
            transform: `translate(${position.x * scale}, ${position.y * scale})`
        });

        // Рендерим текст с переносами
        const textElement = this.renderWrappedText(
            block.content,
            width * scale,
            style,
            scale
        );

        if (textElement) {
            blockGroup.appendChild(textElement);
        }

        // Рендерим границы если нужно
        if (block.showBounds) {
            const bounds = this.renderBounds(width * scale, textElement, style, scale);
            blockGroup.insertBefore(bounds, textElement);
        }

        return blockGroup;
    }

    /**
     * Отрисовка текста с переносами строк
     */
    renderWrappedText(text, maxWidth, style, scale) {
        const textGroup = DOMUtils.createSVGElement('g', {
            class: 'text-content'
        });

        // Разбиваем на слова
        const words = text.split(/\s+/);
        
        // Временный SVG для измерений
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        document.body.appendChild(tempSvg);

        const tempText = this.createTextElement('', style, scale);
        tempSvg.appendChild(tempText);

        // Собираем строки
        const lines = [];
        let currentLine = '';

        words.forEach((word, index) => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            tempText.textContent = testLine;
            
            const bbox = tempText.getBBox();
            
            if (bbox.width > maxWidth && currentLine) {
                // Текущее слово не помещается, добавляем строку
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        // Добавляем последнюю строку
        if (currentLine) {
            lines.push(currentLine);
        }

        // Очистка
        document.body.removeChild(tempSvg);

        // Создаем SVG text элементы для каждой строки
        const lineHeight = style.lineHeight * this.settings.get('gridModule') * MathUtils.mmToPt(1);
        
        lines.forEach((line, index) => {
            const y = index * lineHeight * scale;
            const lineElement = this.createTextElement(line, style, scale);
            lineElement.setAttribute('y', y);
            textGroup.appendChild(lineElement);
        });

        return textGroup;
    }

    /**
     * Создание SVG text элемента
     */
    createTextElement(content, style, scale) {
        // Вычисляем размер шрифта
        const fontSize = this.calculateFontSize(style);
        
        const textElement = DOMUtils.createSVGElement('text', {
            class: `text-${style.styleRef}`,
            'font-family': style.fontFamily,
            'font-weight': style.fontWeight,
            'font-size': `${fontSize * scale}pt`,
            'letter-spacing': `${style.tracking}em`,
            'fill': 'currentColor',
            'xml:space': 'preserve'
        });

        textElement.textContent = content;
        
        return textElement;
    }

    /**
     * Расчет размера шрифта исходя из модулей
     */
    calculateFontSize(style) {
        const module = this.settings.get('gridModule');
        const sizeInModules = style.size;
        const sizeInMm = sizeInModules * module;
        const sizeInPt = MathUtils.mmToPt(sizeInMm);

        // Если используется x-height
        if (style.useXHeight) {
            const fontFamily = style.fontFamily.includes('Lunnen') ? 'LunnenDisplay' : 'TT Commons';
            const metrics = this.fontMetrics[fontFamily];
            // Размер шрифта = желаемый x-height / коэффициент x-height
            return sizeInPt / metrics.xHeightRatio;
        }

        return sizeInPt;
    }

    /**
     * Отрисовка границ блока
     */
    renderBounds(width, textElement, style, scale) {
        const bbox = textElement ? textElement.getBBox() : { width: width, height: 100 };
        
        const rect = DOMUtils.createSVGElement('rect', {
            class: 'text-bounds',
            x: 0,
            y: 0,
            width: width,
            height: bbox.height,
            fill: 'none',
            stroke: 'rgba(255, 0, 0, 0.3)',
            'stroke-width': 1 / scale,
            'stroke-dasharray': '4,4'
        });

        return rect;
    }

    /**
     * Расчет позиции блока на сетке
     */
    calculatePosition(block) {
        // Конвертируем позицию сетки в координаты
        return this.gridCalculator.gridPositionToXY(
            block.x,
            block.row,
            block.baselineOffset
        );
    }

    /**
     * Расчет ширины блока в пикселях
     */
    calculateWidth(block) {
        const columnWidth = this.gridCalculator.getColumnWidth();
        const gutterSize = this.gridCalculator.getGutterSize();
        
        // Ширина = (ширина колонки * количество колонок) + (отступы между колонками)
        return (columnWidth * block.width) + (gutterSize * (block.width - 1));
    }

    /**
     * Получение стиля текста из настроек
     */
    getTextStyle(styleRef) {
        const styles = {
            'headline': {
                styleRef: 'headline',
                fontFamily: this.settings.get('headlineStyleDropdown') === '500' ? 
                    'TT Commons, sans-serif' : 'TT Commons, sans-serif',
                fontWeight: this.settings.get('headlineStyleDropdown') || '500',
                size: this.settings.get('headlineSize') || 1,
                lineHeight: this.settings.get('lineHeight') || 2,
                tracking: this.settings.get('tracking') || -0.015,
                useXHeight: this.settings.get('useXHeight') !== false
            },
            'text': {
                styleRef: 'text',
                fontFamily: this.settings.get('textStyleDropdown') === '500' ? 
                    'TT Commons, sans-serif' : 'TT Commons, sans-serif',
                fontWeight: this.settings.get('textStyleDropdown') || '500',
                size: this.settings.get('textSize') || 1,
                lineHeight: this.settings.get('textLineHeight') || 2,
                tracking: this.settings.get('textTracking') || 0,
                useXHeight: this.settings.get('useXHeight2') !== false
            }
        };

        return styles[styleRef] || styles['text'];
    }

    /**
     * Получение высоты отрендеренного блока
     */
    getBlockHeight(blockId) {
        const element = document.getElementById(blockId);
        if (!element) return 0;

        const bbox = element.getBBox();
        return bbox.height;
    }

    /**
     * Обновление отображения одного блока
     */
    updateBlock(blockId, block, scale = 1) {
        const existingElement = document.getElementById(blockId);
        if (!existingElement) return null;

        const newElement = this.renderBlock(block, scale);
        if (!newElement) return null;

        existingElement.replaceWith(newElement);
        return newElement;
    }

    /**
     * Удаление блока из SVG
     */
    removeBlock(blockId) {
        const element = document.getElementById(blockId);
        if (element) {
            element.remove();
            return true;
        }
        return false;
    }

    /**
     * Подсветка блока
     */
    highlightBlock(blockId, highlight = true) {
        const element = document.getElementById(blockId);
        if (!element) return;

        if (highlight) {
            element.classList.add('highlighted');
        } else {
            element.classList.remove('highlighted');
        }
    }

    /**
     * Получение информации о блоке для экспорта
     */
    getBlockInfo(blockId) {
        const element = document.getElementById(blockId);
        if (!element) return null;

        const bbox = element.getBBox();
        const transform = element.getAttribute('transform');

        return {
            id: blockId,
            bbox: {
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height
            },
            transform: transform
        };
    }
}

