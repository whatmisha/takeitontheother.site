/**
 * TextBlockManager - Управление текстовыми блоками
 * CRUD операции, валидация, состояние
 */
export class TextBlockManager {
    constructor(settings, gridCalculator) {
        this.settings = settings;
        this.gridCalculator = gridCalculator;
        this.textBlocks = [];
        this.selectedBlockId = null;
    }

    /**
     * Создание нового текстового блока
     */
    createBlock(config = {}) {
        const newBlock = {
            id: config.id || `text-${Date.now()}`,
            content: config.content || 'Lunnen — бренд компьютерной техники, придуманный в Яндексе. Это спутник, с которым просто. Просто решать задачи. Создавать новое. И изучать неизведанное.',
            styleRef: config.styleRef || 'text',
            x: config.x !== undefined ? config.x : 1, // Колонка
            row: config.row !== undefined ? config.row : 0,
            baselineOffset: config.baselineOffset !== undefined ? config.baselineOffset : 0,
            width: config.width !== undefined ? config.width : 3, // Ширина в колонках
            showBounds: config.showBounds || false,
            visible: config.visible !== undefined ? config.visible : true
        };

        // Валидация
        this.validateBlock(newBlock);

        this.textBlocks.push(newBlock);
        return newBlock;
    }

    /**
     * Получение блока по ID
     */
    getBlock(blockId) {
        return this.textBlocks.find(block => block.id === blockId);
    }

    /**
     * Получение всех блоков
     */
    getAllBlocks() {
        return [...this.textBlocks];
    }

    /**
     * Получение видимых блоков
     */
    getVisibleBlocks() {
        return this.textBlocks.filter(block => block.visible);
    }

    /**
     * Обновление блока
     */
    updateBlock(blockId, updates) {
        const block = this.getBlock(blockId);
        if (!block) {
            console.warn(`TextBlock not found: ${blockId}`);
            return false;
        }

        // Применяем обновления
        Object.assign(block, updates);

        // Валидация
        this.validateBlock(block);

        return true;
    }

    /**
     * Удаление блока
     */
    deleteBlock(blockId) {
        const index = this.textBlocks.findIndex(block => block.id === blockId);
        if (index === -1) {
            console.warn(`TextBlock not found: ${blockId}`);
            return false;
        }

        this.textBlocks.splice(index, 1);
        
        // Сброс выделения если удаляли выбранный блок
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

        // Ограничение ширины
        const maxWidth = columnCount - block.x + 1;
        block.width = Math.max(0.25, Math.min(block.width, maxWidth));

        // Ограничение строки
        block.row = Math.max(0, Math.min(block.row, rowCount - 1));

        // Ограничение baseline offset
        const maxBaseline = this.gridCalculator ? 
            this.gridCalculator.getTotalBaselines() : 500;
        block.baselineOffset = Math.max(0, Math.min(block.baselineOffset, maxBaseline));
    }

    /**
     * Ограничение всех блоков к текущей сетке
     */
    constrainAllToGrid() {
        this.textBlocks.forEach(block => this.validateBlock(block));
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
            console.warn(`TextBlock not found: ${blockId}`);
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
     * Дублирование блока
     */
    duplicateBlock(blockId) {
        const block = this.getBlock(blockId);
        if (!block) {
            console.warn(`TextBlock not found: ${blockId}`);
            return null;
        }

        const duplicate = {
            ...block,
            id: `text-${Date.now()}`,
            x: block.x + 1,
            row: block.row + 1
        };

        // Валидация нового блока
        this.validateBlock(duplicate);

        this.textBlocks.push(duplicate);
        return duplicate;
    }

    /**
     * Перемещение блока на сетке
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
    resizeBlock(blockId, width) {
        return this.updateBlock(blockId, { width });
    }

    /**
     * Изменение стиля блока
     */
    setStyle(blockId, styleRef) {
        return this.updateBlock(blockId, { styleRef });
    }

    /**
     * Изменение содержимого блока
     */
    setContent(blockId, content) {
        return this.updateBlock(blockId, { content });
    }

    /**
     * Получение количества блоков
     */
    getCount() {
        return this.textBlocks.length;
    }

    /**
     * Очистка всех блоков
     */
    clear() {
        this.textBlocks = [];
        this.selectedBlockId = null;
    }

    /**
     * Экспорт данных блоков
     */
    exportData() {
        return this.textBlocks.map(block => ({ ...block }));
    }

    /**
     * Импорт данных блоков
     */
    importData(blocks) {
        if (!Array.isArray(blocks)) {
            console.warn('Invalid blocks data for import');
            return false;
        }

        this.textBlocks = [];
        blocks.forEach(blockData => {
            try {
                const block = this.createBlock(blockData);
                // createBlock уже добавляет в массив, так что просто валидируем
                this.validateBlock(block);
            } catch (error) {
                console.error('Error importing text block:', error);
            }
        });

        return true;
    }

    /**
     * Поиск блоков по содержимому
     */
    findByContent(searchText) {
        const lowerSearch = searchText.toLowerCase();
        return this.textBlocks.filter(block => 
            block.content.toLowerCase().includes(lowerSearch)
        );
    }

    /**
     * Получение блоков по стилю
     */
    getBlocksByStyle(styleRef) {
        return this.textBlocks.filter(block => block.styleRef === styleRef);
    }

    /**
     * Сортировка блоков по позиции (сверху вниз, слева направо)
     */
    sortByPosition() {
        this.textBlocks.sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            if (a.baselineOffset !== b.baselineOffset) return a.baselineOffset - b.baselineOffset;
            return a.x - b.x;
        });
    }

    /**
     * Получение границ блока в пикселях
     */
    getBlockBounds(blockId) {
        const block = this.getBlock(blockId);
        if (!block || !this.gridCalculator) return null;

        // Вычисляем позицию и размер через калькулятор сетки
        const position = this.gridCalculator.gridPositionToXY(
            block.x,
            block.row,
            block.baselineOffset
        );

        const columnWidth = this.gridCalculator.getColumnWidth();
        const width = columnWidth * block.width + 
                     this.gridCalculator.getGutterSize() * (block.width - 1);

        return {
            x: position.x,
            y: position.y,
            width: width,
            height: 0 // Высота зависит от содержимого, рассчитывается в TextRenderer
        };
    }
}

