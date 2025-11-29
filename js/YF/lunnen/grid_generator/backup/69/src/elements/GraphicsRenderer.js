/**
 * GraphicsRenderer - Отрисовка графических элементов в SVG
 */
import { DOMUtils } from '../utils/DOMUtils.js';
import { MathUtils } from '../utils/MathUtils.js';

export class GraphicsRenderer {
    constructor(settings, gridCalculator) {
        this.settings = settings;
        this.gridCalculator = gridCalculator;
    }

    /**
     * Отрисовка всех графических блоков
     */
    renderAll(container, graphicsBlocks, scale = 1) {
        const graphicsGroup = DOMUtils.createSVGElement('g', {
            id: 'graphicsBlocks',
            class: 'graphics-blocks'
        });

        graphicsBlocks.forEach(block => {
            if (block.visible) {
                const blockElement = this.renderBlock(block, scale);
                if (blockElement) {
                    graphicsGroup.appendChild(blockElement);
                }
            }
        });

        container.appendChild(graphicsGroup);
    }

    /**
     * Отрисовка одного графического блока
     */
    renderBlock(block, scale = 1) {
        if (!block.svgContent && !block.svgPath) return null;

        // Вычисляем позицию на сетке
        const position = this.calculatePosition(block);
        
        // Вычисляем размеры
        const dimensions = this.calculateDimensions(block);

        // Получаем угол поворота для поверхности
        const surface = block.surface || 'front';
        const rotation = this.getSurfaceRotation(surface);

        // Создаем группу для блока
        const blockGroup = DOMUtils.createSVGElement('g', {
            id: block.id,
            class: `graphics-block surface-${surface}`,
            'data-block-id': block.id,
            'data-type': block.type,
            'data-surface': surface,
            transform: this.buildTransform(position, rotation, scale)
        });

        // Парсим SVG контент
        const svgElement = this.parseSVGContent(block.svgContent);
        if (svgElement) {
            // Масштабируем SVG
            const scaledSVG = this.scaleSVG(
                svgElement,
                dimensions.width * scale,
                dimensions.height * scale,
                block.originalWidth,
                block.originalHeight
            );
            
            blockGroup.appendChild(scaledSVG);
        }

        // Рендерим границы если нужно
        if (block.showBounds) {
            const bounds = this.renderBounds(
                dimensions.width * scale,
                dimensions.height * scale,
                scale
            );
            blockGroup.insertBefore(bounds, blockGroup.firstChild);
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
            transform += ` rotate(${rotation})`;
        }
        
        return transform;
    }

    /**
     * Парсинг SVG контента
     */
    parseSVGContent(svgContent) {
        if (!svgContent) return null;

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svg = doc.querySelector('svg');

        if (!svg) return null;

        // Создаем группу для содержимого SVG
        const group = DOMUtils.createSVGElement('g', {
            class: 'svg-content'
        });

        // Копируем все дочерние элементы SVG
        Array.from(svg.children).forEach(child => {
            const clonedChild = child.cloneNode(true);
            group.appendChild(clonedChild);
        });

        return group;
    }

    /**
     * Масштабирование SVG
     */
    scaleSVG(svgGroup, targetWidth, targetHeight, originalWidth, originalHeight) {
        if (!svgGroup) return svgGroup;

        // Вычисляем масштаб
        const scaleX = targetWidth / originalWidth;
        const scaleY = targetHeight / originalHeight;
        
        // Используем меньший масштаб чтобы сохранить пропорции
        const scale = Math.min(scaleX, scaleY);

        // Применяем трансформацию
        const currentTransform = svgGroup.getAttribute('transform') || '';
        svgGroup.setAttribute('transform', `${currentTransform} scale(${scale})`);

        return svgGroup;
    }

    /**
     * Отрисовка границ блока
     */
    renderBounds(width, height, scale) {
        const rect = DOMUtils.createSVGElement('rect', {
            class: 'graphics-bounds',
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: 'none',
            stroke: 'rgba(0, 0, 255, 0.3)',
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
     * Расчет размеров блока в пикселях
     */
    calculateDimensions(block) {
        const module = this.settings.get('gridModule');
        const aspectRatio = block.originalWidth / block.originalHeight;
        
        let widthInPt, heightInPt;
        
        // Проверяем режим назначения размера
        if (block.sizeMode === 'width') {
            // Режим по ширине: используем widthInColumns
            // Размер рассчитывается с учетом полей и межколонников
            const frontWidth = this.settings.get('frontWidth');
            const margins = this.settings.get('margins');
            const columnCount = this.settings.get('columnCount');
            
            // Вычисляем ширину контентной области (убираем поля с обеих сторон)
            const contentWidth = frontWidth - 2 * margins * module;
            
            // Вычисляем ширину одной колонки
            // Формула: (контентная область - промежутки) / количество колонок
            const columnWidth = (contentWidth - (columnCount - 1) * module) / columnCount;
            
            // Вычисляем ширину графики: N колонок + (N-1) промежутков
            // Пример для 12 col из 12: 12 * columnWidth + 11 * gutter = вся контентная область
            const widthInMm = block.widthInColumns * columnWidth + (block.widthInColumns - 1) * module;
            widthInPt = MathUtils.mmToPt(widthInMm);
            
            // Вычисляем высоту пропорционально
            heightInPt = widthInPt / aspectRatio;
        } else {
            // Режим по высоте (по умолчанию): используем heightInModules
            const heightInMm = block.heightInModules * module;
            heightInPt = MathUtils.mmToPt(heightInMm);
            
            // Вычисляем ширину пропорционально
            widthInPt = heightInPt * aspectRatio;
        }

        return {
            width: widthInPt,
            height: heightInPt
        };
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

    /**
     * Загрузка внешнего SVG файла и отрисовка
     */
    async renderFromFile(block, svgPath, scale = 1) {
        try {
            const response = await fetch(svgPath);
            const svgContent = await response.text();
            
            block.svgContent = svgContent;
            
            return this.renderBlock(block, scale);
        } catch (error) {
            console.error(`Failed to load SVG from ${svgPath}:`, error);
            return null;
        }
    }
}

