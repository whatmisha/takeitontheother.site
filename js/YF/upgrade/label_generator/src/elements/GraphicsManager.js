/**
 * GraphicsManager - Управление графическими элементами (SVG)
 * Загрузка, позиционирование, масштабирование
 */
import { DOMUtils } from '../utils/DOMUtils.js';
import { MathUtils } from '../utils/MathUtils.js';

export class GraphicsManager {
    constructor(settings, gridCalculator) {
        this.settings = settings;
        this.gridCalculator = gridCalculator;
        this.graphicsBlocks = [];
        this.selectedBlockId = null;
        
        // Встроенные графические элементы
        this.builtInGraphics = {
            'icons': {
                id: 'icons',
                name: 'Icons',
                type: 'builtin',
                svgPath: 'graphics/icons.svg',
                surface: 'front',
                heightInModules: 3,
                x: 1,
                row: 0,
                baselineOffset: 0,
                visible: false,
                showBounds: false
            },
            'claim': {
                id: 'claim',
                name: 'YF Claim',
                type: 'builtin',
                svgPath: 'graphics/yf_claim.svg',
                surface: 'front',
                heightInModules: 2,
                x: 1,
                row: 0,
                baselineOffset: 0,
                visible: false,
                showBounds: false
            }
        };
    }

    /**
     * Создание нового графического блока
     */
    createBlock(config) {
        const newBlock = {
            id: config.id || `graphics-${Date.now()}`,
            name: config.name || 'Graphic',
            type: config.type || 'custom', // 'custom' | 'builtin'
            svgContent: config.svgContent || null,
            svgPath: config.svgPath || null,
            surface: config.surface || 'front', // Поверхность: front, left, right, top, bottom
            heightInModules: config.heightInModules !== undefined ? config.heightInModules : 3,
            x: config.x !== undefined ? config.x : 1,
            row: config.row !== undefined ? config.row : 0,
            baselineOffset: config.baselineOffset !== undefined ? config.baselineOffset : 0,
            visible: config.visible !== undefined ? config.visible : true,
            showBounds: config.showBounds || false,
            originalWidth: config.originalWidth || 100,
            originalHeight: config.originalHeight || 100
        };

        // Валидация
        this.validateBlock(newBlock);

        this.graphicsBlocks.push(newBlock);
        return newBlock;
    }

    /**
     * Получение блока по ID
     */
    getBlock(blockId) {
        // Проверяем сначала встроенные
        if (this.builtInGraphics[blockId]) {
            return this.builtInGraphics[blockId];
        }
        
        return this.graphicsBlocks.find(block => block.id === blockId);
    }

    /**
     * Получение всех блоков (включая встроенные)
     */
    getAllBlocks() {
        const builtIn = Object.values(this.builtInGraphics);
        return [...builtIn, ...this.graphicsBlocks];
    }

    /**
     * Получение видимых блоков
     */
    getVisibleBlocks() {
        return this.getAllBlocks().filter(block => block.visible);
    }

    /**
     * Обновление блока
     */
    updateBlock(blockId, updates) {
        const block = this.getBlock(blockId);
        if (!block) {
            console.warn(`Graphics block not found: ${blockId}`);
            return false;
        }

        // Применяем обновления
        Object.assign(block, updates);

        // Валидация
        this.validateBlock(block);

        return true;
    }

    /**
     * Удаление блока (только пользовательских, встроенные нельзя удалить)
     */
    deleteBlock(blockId) {
        const index = this.graphicsBlocks.findIndex(block => block.id === blockId);
        if (index === -1) {
            console.warn(`Graphics block not found: ${blockId}`);
            return false;
        }

        this.graphicsBlocks.splice(index, 1);
        
        if (this.selectedBlockId === blockId) {
            this.selectedBlockId = null;
        }

        return true;
    }

    /**
     * Валидация блока
     */
    validateBlock(block) {
        const columnCount = this.settings.get('columnCount');
        const rowCount = this.settings.get('rowCount');

        // Ограничение колонки
        block.x = Math.max(1, Math.min(block.x, columnCount));

        // Ограничение строки
        block.row = Math.max(0, Math.min(block.row, rowCount - 1));

        // Ограничение высоты
        block.heightInModules = Math.max(0.25, Math.min(block.heightInModules, 20));

        // Ограничение baseline offset
        const maxBaseline = this.gridCalculator ? 
            this.gridCalculator.getTotalBaselines() : 500;
        block.baselineOffset = Math.max(0, Math.min(block.baselineOffset, maxBaseline));
    }

    /**
     * Ограничение всех блоков к текущей сетке
     */
    constrainAllToGrid() {
        this.getAllBlocks().forEach(block => this.validateBlock(block));
    }

    /**
     * Загрузка SVG из файла
     */
    async loadSVGFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const content = e.target.result;
                
                // Парсим SVG чтобы получить размеры
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'image/svg+xml');
                const svg = doc.querySelector('svg');
                
                if (!svg) {
                    reject(new Error('Invalid SVG file'));
                    return;
                }

                // Получаем размеры
                const viewBox = svg.getAttribute('viewBox');
                let width = 100, height = 100;
                
                if (viewBox) {
                    const parts = viewBox.split(/\s+/);
                    width = parseFloat(parts[2]) || 100;
                    height = parseFloat(parts[3]) || 100;
                } else {
                    width = parseFloat(svg.getAttribute('width')) || 100;
                    height = parseFloat(svg.getAttribute('height')) || 100;
                }

                resolve({
                    content: content,
                    name: file.name.replace(/\.svg$/i, ''),
                    originalWidth: width,
                    originalHeight: height
                });
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Загрузка встроенного SVG
     */
    async loadBuiltInSVG(blockId) {
        const block = this.builtInGraphics[blockId];
        if (!block || !block.svgPath) return null;

        try {
            const response = await fetch(block.svgPath);
            const content = await response.text();
            
            // Сохраняем содержимое
            block.svgContent = content;
            
            return content;
        } catch (error) {
            console.error(`Failed to load built-in SVG: ${blockId}`, error);
            return null;
        }
    }

    /**
     * Установка видимости блока
     */
    setVisible(blockId, visible) {
        return this.updateBlock(blockId, { visible });
    }

    /**
     * Переключение видимости блока
     */
    toggleVisible(blockId) {
        const block = this.getBlock(blockId);
        if (!block) return false;
        
        return this.setVisible(blockId, !block.visible);
    }

    /**
     * Выделение блока
     */
    selectBlock(blockId) {
        const block = this.getBlock(blockId);
        if (!block) {
            console.warn(`Graphics block not found: ${blockId}`);
            return false;
        }

        this.selectedBlockId = blockId;
        return true;
    }

    /**
     * Снятие выделения
     */
    deselectBlock() {
        this.selectedBlockId = null;
    }

    /**
     * Получение выбранного блока
     */
    getSelectedBlock() {
        return this.selectedBlockId ? this.getBlock(this.selectedBlockId) : null;
    }

    /**
     * Перемещение блока
     */
    moveBlock(blockId, x, row, baselineOffset) {
        return this.updateBlock(blockId, {
            x: x !== undefined ? x : undefined,
            row: row !== undefined ? row : undefined,
            baselineOffset: baselineOffset !== undefined ? baselineOffset : undefined
        });
    }

    /**
     * Изменение размера блока
     */
    resizeBlock(blockId, heightInModules) {
        return this.updateBlock(blockId, { heightInModules });
    }

    /**
     * Получение количества блоков
     */
    getCount() {
        return this.graphicsBlocks.length;
    }

    /**
     * Получение количества видимых блоков
     */
    getVisibleCount() {
        const visibleBuiltIn = Object.values(this.builtInGraphics)
            .filter(b => b.visible).length;
        const visibleCustom = this.graphicsBlocks.filter(b => b.visible).length;
        return visibleBuiltIn + visibleCustom;
    }

    /**
     * Очистка пользовательских блоков
     */
    clear() {
        this.graphicsBlocks = [];
        this.selectedBlockId = null;
    }

    /**
     * Экспорт данных блоков
     */
    exportData() {
        // Экспортируем только пользовательские и видимость встроенных
        const builtInStates = {};
        Object.keys(this.builtInGraphics).forEach(key => {
            const block = this.builtInGraphics[key];
            builtInStates[key] = {
                visible: block.visible,
                x: block.x,
                row: block.row,
                baselineOffset: block.baselineOffset,
                heightInModules: block.heightInModules
            };
        });

        return {
            builtIn: builtInStates,
            custom: this.graphicsBlocks.map(block => ({ ...block }))
        };
    }

    /**
     * Импорт данных блоков
     */
    importData(data) {
        if (!data) {
            console.warn('Invalid graphics data for import');
            return false;
        }

        // Восстанавливаем состояние встроенных
        if (data.builtIn) {
            Object.keys(data.builtIn).forEach(key => {
                if (this.builtInGraphics[key]) {
                    Object.assign(this.builtInGraphics[key], data.builtIn[key]);
                }
            });
        }

        // Восстанавливаем пользовательские
        if (data.custom && Array.isArray(data.custom)) {
            this.graphicsBlocks = [];
            data.custom.forEach(blockData => {
                try {
                    const block = this.createBlock(blockData);
                    this.validateBlock(block);
                } catch (error) {
                    console.error('Error importing graphics block:', error);
                }
            });
        }

        return true;
    }

    /**
     * Получение границ блока в пикселях
     */
    getBlockBounds(blockId) {
        const block = this.getBlock(blockId);
        if (!block || !this.gridCalculator) return null;

        const position = this.gridCalculator.gridPositionToXY(
            block.x,
            block.row,
            block.baselineOffset
        );

        const module = this.settings.get('gridModule');
        const heightInMm = block.heightInModules * module;
        const heightInPt = MathUtils.mmToPt(heightInMm);

        // Вычисляем ширину пропорционально
        const aspectRatio = block.originalWidth / block.originalHeight;
        const widthInPt = heightInPt * aspectRatio;

        return {
            x: position.x,
            y: position.y,
            width: widthInPt,
            height: heightInPt
        };
    }
}

