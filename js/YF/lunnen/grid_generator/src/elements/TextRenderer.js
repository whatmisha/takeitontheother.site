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
        
        // Метрики шрифтов (используем те же, что и в старом коде)
        this.fontMetrics = {
            'TT Commons Classic': {
                capHeight: 630,
                xHeight: 447,
                unitsPerEm: 1000
            },
            'Lunnen Display': {
                capHeight: 630,
                xHeight: 447,
                unitsPerEm: 1000
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

        // Получаем угол поворота для поверхности
        const surface = block.surface || 'front';
        const rotation = this.getSurfaceRotation(surface);

        // Создаем группу для блока
        const blockGroup = DOMUtils.createSVGElement('g', {
            id: block.id,
            class: `text-block surface-${surface}`,
            'data-block-id': block.id,
            'data-style': block.styleRef,
            'data-surface': surface,
            transform: this.buildTransform(position, rotation, scale)
        });

        // Рендерим текст с переносами
        const textAlign = block.textAlign || block.alignment || 'left';
        const textElement = this.renderWrappedText(
            block.content,
            width * scale,
            style,
            scale,
            textAlign
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
     * Получить угол поворота для поверхности
     */
    getSurfaceRotation(surface) {
        const surfaceConfig = this.gridCalculator.getSurfaceConfig(surface);
        return surfaceConfig.rotation || 0;
    }

    /**
     * Построить строку трансформации с учетом позиции и поворота
     */
    buildTransform(position, rotation, scale) {
        let transform = `translate(${position.x * scale}, ${position.y * scale})`;
        
        if (rotation !== 0) {
            // Применяем поворот для торцов
            // Важно: поворот применяется в точке, где находится текст
            transform += ` rotate(${rotation})`;
        }
        
        return transform;
    }

    /**
     * Отрисовка текста с переносами строк
     * Поддерживает принудительные переносы (\n) и неразрывные пробелы (\u00A0)
     */
    renderWrappedText(text, maxWidth, style, scale, textAlign = 'left') {
        const textGroup = DOMUtils.createSVGElement('g', {
            class: 'text-content'
        });

        // Сначала разбиваем по принудительным переносам (\n)
        const forcedLines = text.split('\n');
        
        // Временный SVG для измерений
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        document.body.appendChild(tempSvg);

        const tempText = this.createTextElement('', style, scale, textAlign);
        tempSvg.appendChild(tempText);

        // Обрабатываем каждую строку с принудительным переносом
        const lines = [];
        
        forcedLines.forEach(forcedLine => {
            // Разбиваем строку на слова, учитывая неразрывные пробелы
            // Неразрывный пробел (\u00A0) не должен разбивать слова
            // Разбиваем только по обычным пробелам, но сохраняем неразрывные пробелы
            const parts = [];
            let currentPart = '';
            
            for (let i = 0; i < forcedLine.length; i++) {
                const char = forcedLine[i];
                const charCode = forcedLine.charCodeAt(i);
                
                if (charCode === 0x00A0) {
                    // Неразрывный пробел - добавляем к текущей части
                    currentPart += '\u00A0';
                } else if (char === ' ' || char === '\t') {
                    // Обычный пробел - завершаем текущую часть и начинаем новую
                    if (currentPart) {
                        parts.push(currentPart);
                        currentPart = '';
                    }
                    parts.push(' '); // Помечаем пробел
                } else {
                    currentPart += char;
                }
            }
            
            if (currentPart) {
                parts.push(currentPart);
            }
            
            // Теперь собираем строки с автоматическим переносом, но уважая неразрывные пробелы
            let currentLine = '';
            
            parts.forEach((part, index) => {
                // Если это пробел-маркер, пропускаем его при сборке
                if (part === ' ') {
                    if (!currentLine) {
                        // Пропускаем пробелы в начале строки
                        return;
                    }
                    const testLine = `${currentLine} `;
                    tempText.textContent = testLine;
                    const bbox = tempText.getBBox();
                    
                    if (bbox.width > maxWidth) {
                        // Пробел не помещается, завершаем текущую строку
                        lines.push(currentLine);
                        currentLine = '';
                    } else {
                        // Пробел помещается, добавляем его
                        currentLine = testLine;
                    }
                } else {
                    // Это слово или часть с неразрывным пробелом
                    const testLine = currentLine ? `${currentLine}${part}` : part;
                    tempText.textContent = testLine;
                    const bbox = tempText.getBBox();
                    
                    if (bbox.width > maxWidth && currentLine) {
                        // Текущая часть не помещается, добавляем строку
                        lines.push(currentLine);
                        currentLine = part;
                    } else {
                        currentLine = testLine;
                    }
                }
            });
            
            // Добавляем последнюю строку для этого принудительного переноса
            if (currentLine) {
                lines.push(currentLine);
            }
        });

        // Очистка
        document.body.removeChild(tempSvg);

        // Определяем text-anchor в зависимости от выравнивания
        let textAnchor;
        if (textAlign === 'center') {
            textAnchor = 'middle';
        } else if (textAlign === 'right') {
            textAnchor = 'end';
        } else {
            textAnchor = 'start';
        }

        // Создаем SVG text элементы для каждой строки
        const lineHeight = style.lineHeight * this.settings.get('gridModule') * MathUtils.mmToPt(1);
        
        // Временный SVG для измерения ширины строк
        const measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        measureSvg.style.position = 'absolute';
        measureSvg.style.visibility = 'hidden';
        document.body.appendChild(measureSvg);
        
        const measureText = this.createTextElement('', style, scale, textAlign);
        measureSvg.appendChild(measureText);
        
        lines.forEach((line, index) => {
            const y = index * lineHeight * scale;
            const lineElement = this.createTextElement(line, style, scale, textAlign);
            
            // Вычисляем координату x для этой строки в зависимости от выравнивания
            let lineX;
            if (textAlign === 'center') {
                // Измеряем ширину этой конкретной строки
                measureText.textContent = line;
                const lineWidth = measureText.getBBox().width;
                lineX = maxWidth / 2;
            } else if (textAlign === 'right') {
                // Для правого выравнивания x указывает на правый край блока
                lineX = maxWidth;
            } else {
                // Для левого выравнивания x = 0
                lineX = 0;
            }
            
            lineElement.setAttribute('x', lineX);
            lineElement.setAttribute('y', y);
            textGroup.appendChild(lineElement);
        });
        
        // Очистка
        document.body.removeChild(measureSvg);

        return textGroup;
    }

    /**
     * Создание SVG text элемента
     */
    createTextElement(content, style, scale, textAlign = 'left') {
        // Вычисляем размер шрифта (в mm, как в старом коде)
        const fontSize = this.calculateFontSize(style);
        const scaledFontSize = fontSize * scale;
        
        // Получаем цвет сетки для текста (как в старом коде)
        const gridColor = this.getContrastColor();
        
        // Получаем имя шрифта для стиля
        const fontFamily = style.fontFamily || 'TT Commons Classic';
        
        // Определяем text-anchor в зависимости от выравнивания
        let textAnchor;
        if (textAlign === 'center') {
            textAnchor = 'middle';
        } else if (textAlign === 'right') {
            textAnchor = 'end';
        } else {
            textAnchor = 'start';
        }
        
        const textElement = DOMUtils.createSVGElement('text', {
            class: `text-${style.styleRef}`,
            'font-family': `${fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`,
            'font-weight': style.fontWeight.toString(),
            'font-size': `${scaledFontSize}`, // без единиц - SVG user-units (mm в нашем viewBox)
            'text-anchor': textAnchor,
            'letter-spacing': `${style.tracking}em`,
            'fill': gridColor,
            'fill-opacity': '1',
            'xml:space': 'preserve'
        });

        textElement.textContent = content;
        
        return textElement;
    }
    
    /**
     * Получение контрастного цвета для сетки
     * (из старого кода)
     */
    getContrastColor() {
        const boxColor = this.settings.get('boxColor');
        
        // Convert hex to RGB
        const hex = boxColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        // Calculate luminance
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        
        // Return black or white depending on background luminance
        return luminance > 0.5 ? '#000000' : '#FFFFFF';
    }

    /**
     * Расчет размера шрифта исходя из модулей
     * Использует ту же логику, что и в старом коде
     */
    calculateFontSize(style) {
        const module = this.settings.get('gridModule');
        const sizeInModules = style.size;
        const targetSize = module * sizeInModules; // size in mm
        
        // Получаем метрики шрифта для данного стиля
        const fontFamily = style.fontFamily || 'TT Commons Classic';
        const metrics = this.fontMetrics[fontFamily] || this.fontMetrics['TT Commons Classic'];
        
        // Calculate font size based on whether we're using cap height or x-height
        let fontSize;
        if (style.useXHeight) {
            // x-height should equal targetSize
            fontSize = targetSize * (metrics.unitsPerEm / metrics.xHeight);
        } else {
            // cap height should equal targetSize
            fontSize = targetSize * (metrics.unitsPerEm / metrics.capHeight);
        }
        
        return fontSize; // in mm
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
        // Конвертируем позицию сетки в координаты с учетом поверхности
        return this.gridCalculator.gridPositionToXY(
            block.x,
            block.row,
            block.baselineOffset,
            block.surface || 'front'
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
                fontFamily: 'TT Commons Classic',
                fontWeight: this.settings.get('headlineFontWeight') || 500,
                size: this.settings.get('headlineSize') || 1,
                lineHeight: this.settings.get('lineHeight') || 2,
                tracking: this.settings.get('tracking') || -0.015,
                useXHeight: this.settings.get('useXHeight') !== false
            },
            'text': {
                styleRef: 'text',
                fontFamily: 'TT Commons Classic',
                fontWeight: this.settings.get('textFontWeight') || 500,
                size: this.settings.get('textSize') || 1,
                lineHeight: this.settings.get('textLineHeight') || 2,
                tracking: this.settings.get('textTracking') || 0,
                useXHeight: this.settings.get('useXHeight2') !== false
            },
            'lunnenDisplay': {
                styleRef: 'lunnenDisplay',
                fontFamily: 'Lunnen Display',
                fontWeight: 400,
                size: this.settings.get('lunnenDisplaySize') || 3,
                lineHeight: this.settings.get('lunnenDisplayLineHeight') || 4,
                tracking: this.settings.get('lunnenDisplayTracking') || 0,
                useXHeight: false // Lunnen Display всегда использует capHeight (нет строчных букв)
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

