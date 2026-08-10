const TEXT_PRESETS = [
    { label: 'Brand', text: 'Lunnen — бренд компьютерной техники и аксессуаров, придуманный в Яндекс Фабрике. Сопровождает в исследованиях, работе и развлечениях.' },
    { label: 'Outer', text: 'Продвинутая линейка Lunnen Outer для исследований неизведанного. Эффективные технологии для работы с графикой или развлечений разного уровня сложностей.' },
    { label: 'Ground', text: 'Базовая линейка Lunnen Ground для решения земных задач. Всё необходимое для повседневной работы: от прочного корпуса до современных технологий.' },
    { label: 'Airis', text: 'Lunnen Airis — лёгкая линейка с мощными возможностями. Справляется с тяжёлыми задачами и расширяет границы невесомости.' },
    { label: 'Work', text: 'Серия аксессуаров для компьютерной техники Lunnen Work — подходит для работы и повседневных задач.' },
    { label: 'Изготовитель', text: 'Изготовитель: Винд Мобилити Текнолоджи (Пекин) Лимитед. Адрес: офис 11605, 13 этаж, корпус 1, дом 2, переулок Наньчжугань, район Дунчэн, Пекин, Китай. Сделано в Китае.' },
    { label: 'Маркет.Трейд', text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «Маркет. Трейд». Адрес: 121099, Россия, г. Москва, Новинский б-р, д. 8. Info@lunnen.pro' },
    { label: 'Сайберстор', text: 'Импортёр/Организация, принимающая претензии на территории РФ: ООО «САЙБЕРСТОР». Адрес импортёра: 123112, Россия, г. Москва, вн.тер.г. Муниципальный Округ Пресненский, 1-й Красногвардейский, д. 21, стр. 1. Info@lunnen.pro' }
].map(preset => ({ ...preset, text: preset.text.replace(/ {2,}/g, ' ') }));

/**
 * Numeric input behavior shared by the text and graphics object editors.
 * Position math remains delegated to the surface-aware controllers.
 */
export class ObjectEditorInputController {
    constructor(host) {
        this.host = host;
    }

    initGraphicsInputs() {
        const block = this.host.objectDocument.getGraphicsBlock(
            this.host.currentEditingGraphicsId
        );
        if (!block) return;

        this.getGraphicsInputConfigs(block).forEach(config => {
            this.bindGraphicsInput(block, config);
        });
    }

    getGraphicsInputConfigs(block) {
        return [
            {
                id: 'graphicsXInput',
                property: 'x',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                constrain: value => this.constrainGraphicsX(block, value)
            },
            {
                id: 'graphicsRowInput',
                property: 'row',
                assign: false,
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                constrain: value => this.constrainGraphicsRow(block, value)
            },
            {
                id: 'graphicsBaselineInput',
                property: 'baseline',
                assign: false,
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                constrain: value => this.constrainGraphicsBaseline(block, value)
            },
            {
                id: 'graphicsWidthInput',
                property: 'widthInColumns',
                baseStep: 0.25,
                shiftStep: 1,
                decimals: 2,
                constrain: value => this.constrainGraphicsWidth(block, value)
            },
            {
                id: 'graphicsHeightInput',
                property: 'heightInModules',
                baseStep: 0.25,
                shiftStep: 1,
                decimals: 2,
                constrain: value => this.constrainGraphicsHeight(block, value)
            }
        ];
    }

    bindGraphicsInput(block, config) {
        const input = this.host.dom[config.id];
        if (!input?.parentNode) return;

        // Reopening the editor replaces previous handlers instead of stacking them.
        const replacement = input.cloneNode(true);
        input.parentNode.replaceChild(replacement, input);
        this.host.dom[config.id] = replacement;

        replacement.addEventListener('focus', () => {
            replacement.dataset.originalValue = replacement.value;
            replacement.select();
            this.host.historyManager.beginAction(
                `edit graphics ${config.id}`,
                this.host.getStateSnapshot()
            );
        });

        replacement.addEventListener('blur', () => {
            this.host.historyManager.commitAction(this.host.getStateSnapshot());
        });

        replacement.addEventListener('change', () => {
            const value = this.readGraphicsValue(block, replacement, config);
            this.applyGraphicsValue(block, replacement, config, value);
        });

        replacement.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                replacement.blur();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                this.restoreGraphicsValue(block, replacement, config);
                replacement.blur();
                this.host.updateGrid();
                return;
            }

            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

            event.preventDefault();
            const currentValue = this.readGraphicsValue(block, replacement, config);
            const step = event.shiftKey ? config.shiftStep : config.baseStep;
            const roundedValue = this.roundGraphicsValue(currentValue, step, config);
            const direction = event.key === 'ArrowUp' ? 1 : -1;
            const value = this.roundToDecimals(
                roundedValue + step * direction,
                this.host.getDecimalsFromStep(step) || config.decimals
            );
            this.applyGraphicsValue(block, replacement, config, value);
        });
    }

    readGraphicsValue(block, input, config) {
        const parsed = Number.parseFloat(input.value);
        if (!Number.isNaN(parsed)) return parsed;
        if (config.property === 'baseline') {
            return this.host.rowBaselineToY(
                block.row,
                block.baselineOffset,
                block.surface || 'front'
            ) + 1;
        }
        return block[config.property];
    }

    applyGraphicsValue(block, input, config, value) {
        const constrained = config.constrain ? config.constrain(value) : value;
        if (config.assign !== false) {
            block[config.property] = constrained;
        }
        input.value = config.decimals > 0
            ? constrained.toFixed(config.decimals)
            : Math.round(constrained);
        this.host.updateGrid();
    }

    restoreGraphicsValue(block, input, config) {
        input.value = input.dataset.originalValue;
        const originalValue = Number.parseFloat(input.dataset.originalValue);
        if (Number.isNaN(originalValue)) return;

        if (config.property === 'baseline') {
            const position = this.host.yToRowBaseline(
                originalValue - 1,
                block.surface || 'front'
            );
            block.row = position.row;
            block.baselineOffset = position.baselineOffset;
        } else if (config.property === 'row') {
            block.row = Math.max(0, Math.round(originalValue) - 1);
            block.baselineOffset = 0;
        } else {
            block[config.property] = originalValue;
        }
    }

    roundGraphicsValue(value, step, config) {
        if (config.id === 'graphicsWidthInput' && config.baseStep === 0.25) {
            return Math.round(value / 0.25) * 0.25;
        }
        return this.roundToDecimals(value, this.host.getDecimalsFromStep(step));
    }

    roundToDecimals(value, decimals = 0) {
        return decimals > 0
            ? Number.parseFloat(value.toFixed(decimals))
            : Math.round(value);
    }

    getGraphicsVerticalLimit(block, heightInModules = block.heightInModules) {
        const surface = block.surface || 'front';
        const context = this.host.getSurfaceGridContext(surface);
        const contentHeight = context.frontHeight - 2 * context.margins * context.gridModule;
        const totalBaselines = Math.floor(contentHeight / context.gridModule + 1e-9);
        return {
            surface,
            context,
            maxY: totalBaselines - heightInModules
        };
    }

    constrainGraphicsX(block, value) {
        const context = this.host.getSurfaceGridContext(block.surface || 'front');
        const height = context.gridModule * block.heightInModules;
        const width = height * (block.originalWidth / block.originalHeight);
        const columnWidth = (
            context.frontWidth -
            context.gridModule * context.margins * 2 -
            context.gridModule * (context.columnCount - 1)
        ) / context.columnCount;
        const occupiedColumns = Math.ceil(width / (columnWidth + context.gridModule));
        const maxX = Math.max(1, context.columnCount - occupiedColumns + 1);
        return Math.max(1, Math.min(value, maxX));
    }

    constrainGraphicsRow(block, value) {
        const { surface, context, maxY } = this.getGraphicsVerticalLimit(block);
        const y = (value - 1) * (context.rowHeight + 1);
        const constrainedY = Math.max(0, Math.min(y, maxY));
        const row = Math.floor(constrainedY / (context.rowHeight + 1));

        block.row = Math.max(0, row);
        block.baselineOffset = 0;
        if (this.host.dom.graphicsBaselineInput) {
            this.host.dom.graphicsBaselineInput.value =
                this.host.rowBaselineToY(row, 0, surface) + 1;
        }
        return block.row + 1;
    }

    constrainGraphicsBaseline(block, value) {
        const { surface, maxY } = this.getGraphicsVerticalLimit(block);
        const constrainedY = Math.max(0, Math.min(Math.round(value - 1), maxY));
        const position = this.host.yToRowBaseline(constrainedY, surface);

        block.row = Math.max(0, position.row);
        block.baselineOffset = position.baselineOffset;
        if (this.host.dom.graphicsRowInput) {
            this.host.dom.graphicsRowInput.value = block.row + 1;
        }
        return constrainedY + 1;
    }

    constrainGraphicsWidth(block, value) {
        const surface = block.surface || 'front';
        const context = this.host.getSurfaceGridContext(surface);
        const width = Math.max(0.25, Math.min(value, context.columnCount));
        const widthMm = this.host.columnsToMm(width, surface);
        const height = widthMm / (block.originalWidth / block.originalHeight) / context.gridModule;

        block.heightInModules = Number.parseFloat(height.toFixed(2));
        if (this.host.dom.graphicsHeightInput) {
            this.host.dom.graphicsHeightInput.value = height.toFixed(2);
        }
        this.constrainGraphicsVerticalPosition(block, height, surface);
        return width;
    }

    constrainGraphicsHeight(block, value) {
        const surface = block.surface || 'front';
        const context = this.host.getSurfaceGridContext(surface);
        const height = Math.max(0.25, Math.min(value, 20));
        const widthMm = height * context.gridModule * (block.originalWidth / block.originalHeight);
        const width = this.host.mmToColumns(widthMm, surface);

        block.widthInColumns = Number.parseFloat(width.toFixed(2));
        if (this.host.dom.graphicsWidthInput) {
            this.host.dom.graphicsWidthInput.value = width.toFixed(2);
        }
        this.constrainGraphicsVerticalPosition(block, height, surface);
        return height;
    }

    constrainGraphicsVerticalPosition(block, height, surface) {
        const { maxY } = this.getGraphicsVerticalLimit(block, height);
        const currentY = this.host.getBlockY(block);
        if (currentY <= maxY) return;

        const position = this.host.yToRowBaseline(Math.max(0, maxY), surface);
        block.row = position.row;
        block.baselineOffset = position.baselineOffset;
        if (this.host.dom.graphicsRowInput) {
            this.host.dom.graphicsRowInput.value = position.row + 1;
        }
        if (this.host.dom.graphicsBaselineInput) {
            this.host.dom.graphicsBaselineInput.value =
                this.host.rowBaselineToY(position.row, position.baselineOffset, surface) + 1;
        }
    }

    handleTextArrow(event, property, inputId) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        const block = this.host.currentEditingBlock;
        if (!block) return;

        event.preventDefault();
        const surface = block.surface || 'front';
        const context = this.host.getSurfaceGridContext(surface);
        const baseStep = property === 'width' ? 0.25 : 1;
        const step = event.shiftKey ? (property === 'width' ? 1 : 10) : baseStep;
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        let value = this.roundToDecimals(
            block[property],
            this.host.getDecimalsFromStep(step)
        ) + step * direction;

        if (property === 'x') {
            value = Math.max(1, Math.min(value, context.columnCount));
            block.x = value;
            this.host.dom[inputId].value = value;
            if (block.x + block.width - 1 > context.columnCount) {
                block.width = Math.max(0.25, context.columnCount - block.x + 1);
                this.host.dom.paragraphWidthInput.value = block.width.toFixed(2);
            }
        } else if (property === 'row') {
            const contentHeight = context.frontHeight - 2 * context.margins * context.gridModule;
            const maxY = Math.floor(contentHeight / context.gridModule + 1e-9) - 1;
            const y = value * (context.rowHeight + 1);
            const constrainedY = Math.max(0, Math.min(y, maxY));
            block.row = Math.max(0, Math.floor(constrainedY / (context.rowHeight + 1)));
            block.baselineOffset = 0;
            this.host.dom[inputId].value = block.row + 1;
            if (this.host.dom.paragraphBaselineInput) {
                this.host.dom.paragraphBaselineInput.value =
                    this.host.rowBaselineToY(block.row, 0, surface) + 1;
            }
        } else if (property === 'width') {
            value = Math.round(value * 4) / 4;
            value = Math.max(0.25, Math.min(value, context.columnCount));
            block.width = value;
            this.host.dom[inputId].value = value.toFixed(2);
            const maxX = context.columnCount - block.width;
            if (block.x > maxX) {
                block.x = Math.max(1, Math.floor(maxX + 1));
            }
            block.x = Math.round(block.x);
            this.host.dom.paragraphXInput.value = block.x;
        }

        this.host.updateGrid();
    }

    initTextEditor() {
        // ===== History: focus/blur обработчики для инпутов текстовых блоков =====
        // Группируют все изменения (набор текста, стрелки) в одно действие
        const textBlockInputIds = [
            'paragraphXInput', 'paragraphRowInput', 'paragraphBaselineInput', 'paragraphWidthInput'
        ];
        textBlockInputIds.forEach(inputId => {
            const input = this.host.dom[inputId];
            if (input) {
                input.addEventListener('focus', () => {
                    this.host.historyManager.beginAction(`edit text block ${inputId}`, this.host.getStateSnapshot());
                });
                input.addEventListener('blur', () => {
                    this.host.historyManager.commitAction(this.host.getStateSnapshot());
                });
            }
        });

        // Обработчики изменений параметров
        if (this.host.dom.paragraphXInput) {
            this.host.dom.paragraphXInput.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.markAsChanged();
                    let newX = parseInt(this.host.dom.paragraphXInput.value);
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const { columnCount } = this.host.getSurfaceGridContext(surface);

                    // Ограничиваем X в зависимости от alignment
                    const alignment = this.host.currentEditingBlock.alignment || 'left';
                    if (alignment === 'right') {
                        // For right-aligned: минимум = ceil(width), максимум = columnCount
                        const minX = Math.ceil(this.host.currentEditingBlock.width);
                        newX = Math.max(minX, Math.min(newX, columnCount));
                    } else {
                        // For left-aligned: минимум = 1, максимум зависит от ширины
                        newX = Math.max(1, Math.min(newX, columnCount));
                    }

                    // Устанавливаем новое значение X
                    this.host.currentEditingBlock.x = newX;

                    // Корректируем width если блок выходит за пределы
                    if (alignment === 'right') {
                        // For right-aligned: block grows left, so max width = x
                        if (this.host.currentEditingBlock.width > this.host.currentEditingBlock.x) {
                            this.host.currentEditingBlock.width = Math.max(0.25, this.host.currentEditingBlock.x);
                            this.host.dom.paragraphWidthInput.value = this.host.currentEditingBlock.width.toFixed(2);
                        }
                    } else {
                        // For left-aligned: block grows right
                        // x начинается с 1, поэтому последняя занятая колонка = x + width - 1
                        if (this.host.currentEditingBlock.x + this.host.currentEditingBlock.width - 1 > columnCount) {
                            this.host.currentEditingBlock.width = Math.max(0.25, columnCount - this.host.currentEditingBlock.x + 1);
                            this.host.dom.paragraphWidthInput.value = this.host.currentEditingBlock.width.toFixed(2);
                        }
                    }

                    // Обновляем отображение X (на случай коррекции), округляем до целого
                    this.host.dom.paragraphXInput.value = Math.round(this.host.currentEditingBlock.x);
                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphXInput.addEventListener('keydown', (e) => {
                this.handleTextArrow(e, 'x', 'paragraphXInput');
            });
        }

        if (this.host.dom.paragraphRowInput) {
            this.host.dom.paragraphRowInput.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.markAsChanged();
                    const newRow = parseInt(this.host.dom.paragraphRowInput.value) - 1;
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const context = this.host.getSurfaceGridContext(surface);

                    // Calculate max allowed row based on content height and text block height
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции: первая строка блока должна быть
                    // в пределах контентной области. Остальное (lineHeight) может выходить за поля.
                    const maxY = maxYInBaseline - 1;

                    // Calculate Y position from row (baselineOffset всегда сбрасывается в 0)
                    const rowHeight = context.rowHeight;
                    const yPos = newRow * (rowHeight + 1);

                    // Constrain Y
                    const constrainedY = Math.max(0, Math.min(yPos, maxY));

                    // При изменении Row всегда ставим объект на первый baseline новой row
                    // Поэтому вычисляем только row из constrainedY, а baselineOffset = 0
                    const rowWithGutter = rowHeight + 1;
                    const finalRow = Math.floor(constrainedY / rowWithGutter);

                    this.host.currentEditingBlock.row = Math.max(0, finalRow);
                    this.host.currentEditingBlock.baselineOffset = 0; // Всегда на первый baseline в row
                    this.host.dom.paragraphRowInput.value = this.host.currentEditingBlock.row + 1;

                    // Update baseline input if needed
                    if (this.host.dom.paragraphBaselineInput) {
                        const globalBaseline = this.host.rowBaselineToY(this.host.currentEditingBlock.row, this.host.currentEditingBlock.baselineOffset, surface);
                        this.host.dom.paragraphBaselineInput.value = globalBaseline + 1;
                    }

                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphRowInput.addEventListener('keydown', (e) => {
                this.handleTextArrow(e, 'row', 'paragraphRowInput');
            });
        }

        if (this.host.dom.paragraphBaselineInput) {
            this.host.dom.paragraphBaselineInput.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.markAsChanged();
                    const globalBaseline = parseInt(this.host.dom.paragraphBaselineInput.value) - 1;
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const context = this.host.getSurfaceGridContext(surface);

                    // Calculate max allowed baseline based on content height and text block height
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции первой строки
                    const maxY = maxYInBaseline - 1;

                    // Constrain baseline
                    const constrainedBaseline = Math.max(0, Math.min(globalBaseline, maxY));

                    // Преобразуем глобальный номер baseline в row и baselineOffset
                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.host.yToRowBaseline(constrainedBaseline, surface);

                    this.host.currentEditingBlock.row = Math.max(0, newRow);
                    this.host.currentEditingBlock.baselineOffset = newBaselineOffset;

                    // Обновляем отображение (на случай коррекции)
                    const correctedGlobalBaseline = this.host.rowBaselineToY(this.host.currentEditingBlock.row, this.host.currentEditingBlock.baselineOffset, surface);
                    this.host.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.host.dom.paragraphRowInput.value = this.host.currentEditingBlock.row + 1;

                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphBaselineInput.addEventListener('keydown', (e) => {
                if (this.host.currentEditingBlock && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    const globalBaseline = parseInt(this.host.dom.paragraphBaselineInput.value) - 1;
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    const step = e.shiftKey ? 10 : 1;
                    let newGlobalBaseline = globalBaseline + delta * step;
                    const surface = this.host.currentEditingBlock.surface || 'front';
                    const context = this.host.getSurfaceGridContext(surface);

                    // Calculate max allowed baseline
                    const module = context.gridModule;
                    const margins = context.margins;
                    const contentHeightMm = context.frontHeight - 2 * margins * module;
                    const maxYInBaseline = Math.floor(contentHeightMm / module + 1e-9);
                    // Ограничиваем по стартовой позиции первой строки
                    const maxY = maxYInBaseline - 1;

                    newGlobalBaseline = Math.max(0, Math.min(newGlobalBaseline, maxY));

                    // Используем yToRowBaseline для правильного учета gutter между rows
                    const { row: newRow, baselineOffset: newBaselineOffset } = this.host.yToRowBaseline(newGlobalBaseline, surface);
                    this.host.currentEditingBlock.row = Math.max(0, newRow);
                    this.host.currentEditingBlock.baselineOffset = newBaselineOffset;

                    // Обновляем отображение с правильным значением
                    const correctedGlobalBaseline = this.host.rowBaselineToY(this.host.currentEditingBlock.row, this.host.currentEditingBlock.baselineOffset, surface);
                    this.host.dom.paragraphBaselineInput.value = correctedGlobalBaseline + 1;
                    this.host.dom.paragraphRowInput.value = this.host.currentEditingBlock.row + 1;
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.paragraphWidthInput) {
            this.host.dom.paragraphWidthInput.addEventListener('change', () => {
                this.host.markAsChanged();
                if (this.host.currentEditingBlock) {
                    const newWidth = parseFloat(this.host.dom.paragraphWidthInput.value);
                    const alignment = this.host.currentEditingBlock.alignment || 'left';
                    const { columnCount } = this.host.getSurfaceGridContext(this.host.currentEditingBlock.surface || 'front');

                    // Округляем до ближайшего кратного 0.25
                    const roundedWidth = Math.round(newWidth * 4) / 4;

                    // Max width depends on alignment
                    let maxWidth;
                    if (alignment === 'right') {
                        // For right-aligned: max width = x (block grows left from column x)
                        maxWidth = this.host.currentEditingBlock.x;
                    } else {
                        // For left-aligned: max width = columns available to the right
                        maxWidth = columnCount - this.host.currentEditingBlock.x + 1;
                    }

                    this.host.currentEditingBlock.width = Math.max(0.25, Math.min(roundedWidth, maxWidth));
                    this.host.dom.paragraphWidthInput.value = this.host.currentEditingBlock.width.toFixed(2);

                    this.host.updateGrid();
                }
            });
            // Обработка стрелок клавиатуры
            this.host.dom.paragraphWidthInput.addEventListener('keydown', (e) => {
                this.handleTextArrow(e, 'width', 'paragraphWidthInput');
            });
        }

        // Обработчик для текстового поля - изменения применяются только при blur или Enter
        if (this.host.dom.paragraphTextArea) {
            // Обработка клавиш для принудительных переносов и неразрывных пробелов
            this.host.dom.paragraphTextArea.addEventListener('keydown', (e) => {
                // Shift+Enter или Shift+Space - принудительный перенос строки (\n)
                if ((e.key === 'Enter' || e.key === ' ') && e.shiftKey) {
                    e.preventDefault();
                    const textarea = e.target;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;

                    // Вставляем \n в позицию курсора
                    textarea.value = text.substring(0, start) + '\n' + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                    this.host.objectEditorPanelController.updateCharacterCount();
                }
                // Option+Space (Alt+Space на Windows/Linux) - неразрывный пробел (\u00A0)
                else if (e.key === ' ' && (e.altKey || e.metaKey)) {
                    e.preventDefault();
                    const textarea = e.target;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const text = textarea.value;

                    // Вставляем неразрывный пробел в позицию курсора
                    textarea.value = text.substring(0, start) + '\u00A0' + text.substring(end);
                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                    this.host.objectEditorPanelController.updateCharacterCount();
                }
                // Обычный Enter без Shift - закрываем редактор
                else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.host.dom.paragraphTextArea.blur();
                }
            });

            // Применение изменений при потере фокуса
            this.host.dom.paragraphTextArea.addEventListener('blur', () => {
                if (this.host.currentEditingBlock) {
                    this.host.currentEditingBlock.content = this.host.dom.paragraphTextArea.value;
                    this.host.objectEditorPanelController.updateCharacterCount();
                    this.host.updateGrid();
                }
            });
        }

        // Кнопки быстрой вставки текстовых пресетов
        this.initTextPresetChips();

        // Обработчик для дропдауна стиля текста
        if (this.host.dom.paragraphStyleSelect) {
            this.host.dom.paragraphStyleSelect.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.currentEditingBlock.styleRef = this.host.dom.paragraphStyleSelect.value;

                    // Показываем/скрываем секцию настроек Lunnen Display
                    const lunnenDisplayFeaturesSection = document.getElementById('lunnenDisplayFeaturesSection');
                    if (lunnenDisplayFeaturesSection) {
                        if (this.host.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            lunnenDisplayFeaturesSection.style.display = 'block';
                        } else {
                            lunnenDisplayFeaturesSection.style.display = 'none';
                        }
                    }

                    // Показываем/скрываем Alignment Mode (для Lunnen Display не показываем)
                    const alignmentModeSection = document.querySelector('#paragraphPanel .control-group:has([name="alignmentMode"])');
                    if (alignmentModeSection) {
                        if (this.host.dom.paragraphStyleSelect.value === 'lunnenDisplay') {
                            alignmentModeSection.style.display = 'none';
                        } else {
                            alignmentModeSection.style.display = 'block';
                        }
                    }

                    this.host.objectNavigatorController.render();
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для дропдауна выбора поверхности (текст)
        if (this.host.dom.paragraphSurfaceSelect) {
            this.host.dom.paragraphSurfaceSelect.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.historyManager.beginAction('move text to surface', this.host.getStateSnapshot());
                    this.host.moveBlockToSurface(this.host.currentEditingBlock, this.host.dom.paragraphSurfaceSelect.value);
                    this.host.markAsChanged();
                    this.host.objectNavigatorController.render();
                    this.host.updateGrid();
                    this.host.historyManager.commitAction(this.host.getStateSnapshot());
                }
            });
        }

        // Обработчик для кнопки Hide
        const paragraphHideBtn = document.getElementById('paragraphHideBtn');
        if (paragraphHideBtn) {
            paragraphHideBtn.addEventListener('click', () => {
                if (this.host.currentEditingBlock) {
                    this.host.objectNavigatorController.toggleVisibility(
                        'text',
                        this.host.currentEditingBlock.id
                    );
                    // Update button icon based on visibility
                    const block = this.host.textBlocks.find(b => b.id === this.host.currentEditingBlock.id);
                    if (block) {
                        const svg = paragraphHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                // Show hide icon (eye with slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                // Show visible icon (eye without slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            });
        }

        // Обработчик для кнопки Duplicate
        const paragraphDuplicateBtn = document.getElementById('paragraphDuplicateBtn');
        if (paragraphDuplicateBtn) {
            paragraphDuplicateBtn.addEventListener('click', () => {
                if (this.host.currentEditingBlock) {
                    this.host.objectNavigatorController.duplicate(
                        'text',
                        this.host.currentEditingBlock.id
                    );
                }
            });
        }

        // Обработчик для кнопки Delete
        const paragraphDeleteBtn = document.getElementById('paragraphDeleteBtn');
        if (paragraphDeleteBtn) {
            paragraphDeleteBtn.addEventListener('click', () => {
                if (this.host.currentEditingBlock) {
                    const blockId = this.host.currentEditingBlock.id;
                    const block = this.host.textBlocks.find(b => b.id === blockId);
                    if (block) {
                        const name = block.content.substring(0, 30) + (block.content.length > 30 ? '...' : '');

                        // Close panel first
                        this.host.objectEditorPanelController.closeTextPanel();

                        // Find the delete button in elements list and trigger delete
                        const elementButton = this.host.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                        if (elementButton) {
                            const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                            if (deleteBtn) {
                                this.host.objectNavigatorController.startDelete(
                                    deleteBtn,
                                    'text',
                                    blockId,
                                    name
                                );
                            }
                        }
                    }
                }
            });
        }

        // Обработчики для режима выравнивания (Alignment Mode)
        if (this.host.dom.alignmentModeBaseline) {
            this.host.dom.alignmentModeBaseline.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.alignmentModeBaseline.checked) {
                    this.host.currentEditingBlock.alignmentMode = 'baseline';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.alignmentModeXHeight) {
            this.host.dom.alignmentModeXHeight.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.alignmentModeXHeight.checked) {
                    this.host.currentEditingBlock.alignmentMode = 'x-height';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.alignmentModeCapHeight) {
            this.host.dom.alignmentModeCapHeight.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.alignmentModeCapHeight.checked) {
                    this.host.currentEditingBlock.alignmentMode = 'cap-height';
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для Constrain to Grid toggle
        if (this.host.dom.paragraphLockPositionToggle) {
            this.host.dom.paragraphLockPositionToggle.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    this.host.currentEditingBlock.lockPosition = this.host.dom.paragraphLockPositionToggle.checked;
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для Align Right toggle
        if (this.host.dom.paragraphAlignRightToggle) {
            this.host.dom.paragraphAlignRightToggle.addEventListener('change', () => {
                if (this.host.currentEditingBlock) {
                    const wasRight = this.host.currentEditingBlock.alignment === 'right';
                    const nowRight = this.host.dom.paragraphAlignRightToggle.checked;

                    // Adjust X position to keep block visually in the same place
                    if (nowRight && !wasRight) {
                        // Switching from left to right alignment
                        // X should move right by (width - 1) columns
                        // Example: X=7, width=3, left → X=9, width=3, right (occupies columns 7,8,9 in both cases)
                        const widthInColumns = Math.ceil(this.host.currentEditingBlock.width);
                        this.host.currentEditingBlock.x += (widthInColumns - 1);

                        // Update input display
                        if (this.host.dom.paragraphXInput) {
                            this.host.dom.paragraphXInput.value = this.host.currentEditingBlock.x;
                        }
                    } else if (!nowRight && wasRight) {
                        // Switching from right to left alignment
                        // X should move left by (width - 1) columns
                        const widthInColumns = Math.ceil(this.host.currentEditingBlock.width);
                        this.host.currentEditingBlock.x -= (widthInColumns - 1);

                        // Ensure X doesn't go below 1
                        this.host.currentEditingBlock.x = Math.max(1, this.host.currentEditingBlock.x);

                        // Update input display
                        if (this.host.dom.paragraphXInput) {
                            this.host.dom.paragraphXInput.value = this.host.currentEditingBlock.x;
                        }
                    }

                    this.host.currentEditingBlock.alignment = nowRight ? 'right' : 'left';
                    this.host.updateGrid();
                }
            });
        }

        // Обработчики для Text Alignment radio buttons
        if (this.host.dom.textAlignmentLeft) {
            this.host.dom.textAlignmentLeft.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.textAlignmentLeft.checked) {
                    this.host.currentEditingBlock.textAlign = 'left';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.textAlignmentCenter) {
            this.host.dom.textAlignmentCenter.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.textAlignmentCenter.checked) {
                    this.host.currentEditingBlock.textAlign = 'center';
                    this.host.updateGrid();
                }
            });
        }

        if (this.host.dom.textAlignmentRight) {
            this.host.dom.textAlignmentRight.addEventListener('change', () => {
                if (this.host.currentEditingBlock && this.host.dom.textAlignmentRight.checked) {
                    this.host.currentEditingBlock.textAlign = 'right';
                    this.host.updateGrid();
                }
            });
        }

        // Обработчик для weight slider (Lunnen Display)
        const lunnenDisplayWeightSlider = document.getElementById('lunnenDisplayWeightSlider');
        const lunnenDisplayWeightValue = document.getElementById('lunnenDisplayWeightValue');
        if (lunnenDisplayWeightSlider && lunnenDisplayWeightValue) {
            // Обновление значения при изменении слайдера
            lunnenDisplayWeightSlider.addEventListener('input', () => {
                if (this.host.currentEditingBlock) {
                    const weight = parseInt(lunnenDisplayWeightSlider.value);
                    lunnenDisplayWeightValue.value = weight;
                    this.host.currentEditingBlock.fontWeight = weight;
                    this.host.updateGrid();
                }
            });

            // Обновление слайдера при изменении текстового поля - применяется при blur или Enter
            lunnenDisplayWeightValue.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    lunnenDisplayWeightValue.blur();
                }
            });

            lunnenDisplayWeightValue.addEventListener('blur', () => {
                if (this.host.currentEditingBlock) {
                    let weight = parseInt(lunnenDisplayWeightValue.value);
                    weight = Math.max(100, Math.min(400, weight));
                    lunnenDisplayWeightValue.value = weight;
                    lunnenDisplayWeightSlider.value = weight;
                    this.host.currentEditingBlock.fontWeight = weight;
                    this.host.updateGrid();
                }
            });
        }

        // Обработчики для OpenType features checkboxes
        const featureCheckboxes = [
            { id: 'featureSalt', key: 'salt' },
            { id: 'featureAalt', key: 'aalt' },
            { id: 'featureSs01', key: 'ss01' },
            { id: 'featureSs02', key: 'ss02' },
            { id: 'featureTnum', key: 'tnum' },
            { id: 'featureDlig', key: 'dlig' }
        ];

        featureCheckboxes.forEach(({ id, key }) => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (this.host.currentEditingBlock) {
                        if (!this.host.currentEditingBlock.fontFeatures) {
                            this.host.currentEditingBlock.fontFeatures = {
                                salt: false,
                                aalt: false,
                                ss01: false,
                                ss02: false,
                                tnum: false,
                                dlig: false
                            };
                        }
                        this.host.currentEditingBlock.fontFeatures[key] = checkbox.checked;
                        this.host.updateGrid();
                    }
                });
            }
        });

        // Graphics Lock Position toggle
        if (this.host.dom.graphicsLockPositionToggle) {
            this.host.dom.graphicsLockPositionToggle.addEventListener('change', () => {
                const block = this.host.graphicsBlocks?.find(b => b.id === this.host.currentEditingGraphicsId);
                if (block) {
                    block.lockPosition = this.host.dom.graphicsLockPositionToggle.checked;
                    this.host.updateGrid();
                }
            });
        }

        // Graphics Align Right toggle
        if (this.host.dom.graphicsAlignRightToggle) {
            this.host.dom.graphicsAlignRightToggle.addEventListener('change', () => {
                const block = this.host.graphicsBlocks?.find(b => b.id === this.host.currentEditingGraphicsId);
                if (block) {
                    const wasRight = block.alignment === 'right';
                    const nowRight = this.host.dom.graphicsAlignRightToggle.checked;

                    // Don't adjust X position - just change alignment mode
                    // The rendering code will handle positioning correctly based on alignment
                    block.alignment = nowRight ? 'right' : 'left';
                    this.host.updateGrid();
                }
            });
        }
    }


    initTextPresetChips() {
        const container = document.getElementById('textPresetChips');
        if (!container) return;

        const plusSvg = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

        TEXT_PRESETS.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = 'text-preset-chip';
            btn.type = 'button';
            btn.setAttribute('aria-label', `Insert text: ${preset.label}`);
            btn.innerHTML = `${plusSvg}<span>${preset.label}</span>`;

            btn.addEventListener('click', () => {
                if (!this.host.currentEditingBlock || !this.host.dom.paragraphTextArea) return;

                this.host.historyManager.beginAction(`insert text preset: ${preset.label}`, this.host.getStateSnapshot());
                this.host.markAsChanged();

                this.host.dom.paragraphTextArea.value = preset.text;
                this.host.currentEditingBlock.content = preset.text;
                this.host.objectEditorPanelController.updateCharacterCount();
                this.host.updateGrid();

                this.host.historyManager.commitAction(this.host.getStateSnapshot());
            });

            container.appendChild(btn);
        });
    }

    // Обновить счетчик символов

    initGraphicsEditor() {
        if (this.host.dom.graphicsSurfaceSelect) {
            this.host.dom.graphicsSurfaceSelect.addEventListener('change', () => {
                const block = this.host.objectDocument.getGraphicsBlock(this.host.currentEditingGraphicsId);
                if (!block) return;
                this.host.historyManager.beginAction('move graphics to surface', this.host.getStateSnapshot());
                this.host.moveBlockToSurface(block, this.host.dom.graphicsSurfaceSelect.value);
                this.initGraphicsInputs();
                this.host.markAsChanged();
                this.host.objectNavigatorController.render();
                this.host.updateGrid();
                this.host.historyManager.commitAction(this.host.getStateSnapshot());
            });
        }

        // File upload area click handler
        if (this.host.dom.fileUploadArea) {
            this.host.dom.fileUploadArea.addEventListener('click', () => {
                if (this.host.dom.svgFileInput) {
                    this.host.dom.svgFileInput.click();
                }
            });

            // Drag and drop handlers
            this.host.dom.fileUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.host.dom.fileUploadArea.classList.add('dragover');
            });

            this.host.dom.fileUploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.host.dom.fileUploadArea.classList.remove('dragover');
            });

            this.host.dom.fileUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.host.dom.fileUploadArea.classList.remove('dragover');

                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type === 'image/svg+xml') {
                    this.host.graphicsAssetController.handleFile(files[0]);
                }
            });
        }

        // File input change handler
        if (this.host.dom.svgFileInput) {
            this.host.dom.svgFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.host.graphicsAssetController.handleFile(e.target.files[0]);
                }
            });
        }

        // Hide button handler
        const graphicsHideBtn = document.getElementById('graphicsHideBtn');
        if (graphicsHideBtn) {
            graphicsHideBtn.addEventListener('click', () => {
                if (this.host.currentEditingGraphicsId) {
                    this.host.objectNavigatorController.toggleVisibility(
                        'graphics',
                        this.host.currentEditingGraphicsId
                    );
                    // Update button icon based on visibility
                    const block = this.host.graphicsBlocks?.find(b => b.id === this.host.currentEditingGraphicsId);
                    if (block) {
                        const svg = graphicsHideBtn.querySelector('svg');
                        if (svg) {
                            if (block.visible) {
                                // Show hide icon (eye with slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
                            } else {
                                // Show visible icon (eye without slash)
                                svg.innerHTML = '<path d="M8 3C4.5 3 1.7 5.6 1 8c.7 2.4 3.5 5 7 5s6.3-2.6 7-5c-.7-2.4-3.5-5-7-5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>';
                            }
                        }
                    }
                }
            });
        }

        // Duplicate button handler
        const graphicsDuplicateBtn = document.getElementById('graphicsDuplicateBtn');
        if (graphicsDuplicateBtn) {
            graphicsDuplicateBtn.addEventListener('click', () => {
                if (this.host.currentEditingGraphicsId) {
                    const block = this.host.objectDocument.getGraphicsBlock(this.host.currentEditingGraphicsId);
                    if (block) {
                        // Determine element type
                        let elementType = 'graphics';
                        if (block.isBuiltIn) {
                            if (block.id === 'icons') elementType = 'icons';
                            else if (block.id === 'claim') elementType = 'claim';
                        }
                        this.host.objectNavigatorController.duplicate(
                            elementType,
                            this.host.currentEditingGraphicsId
                        );
                    }
                }
            });
        }

        // Delete button handler
        const graphicsDeleteBtn = document.getElementById('graphicsDeleteBtn');
        if (graphicsDeleteBtn) {
            graphicsDeleteBtn.addEventListener('click', () => {
                if (this.host.currentEditingGraphicsId) {
                    const blockId = this.host.currentEditingGraphicsId;
                    const block = this.host.objectDocument.getGraphicsBlock(blockId);
                    if (block) {
                        const name = block.name || 'Graphic';

                        // Close panel first
                        this.host.objectEditorPanelController.closeGraphicsPanel();

                        // Find the delete button in elements list and trigger delete
                        const elementButton = this.host.dom.elementsList.querySelector(`[data-element-id="${blockId}"]`);
                        if (elementButton) {
                            const deleteBtn = elementButton.parentElement.querySelector('.element-action-btn:last-child');
                            if (deleteBtn) {
                                this.host.objectNavigatorController.startDelete(
                                    deleteBtn,
                                    'graphics',
                                    blockId,
                                    name
                                );
                            }
                        }
                    }
                }
            });
        }

        // Size mode radio buttons handler
        if (this.host.dom.graphicsSizeModeWidth && this.host.dom.graphicsSizeModeHeight) {
            const handleSizeModeChange = () => {
                if (!this.host.currentEditingGraphicsId) return;

                const block = this.host.graphicsBlocks?.find(b => b.id === this.host.currentEditingGraphicsId);
                if (!block) return;

                // Update sizeMode
                block.sizeMode = this.host.dom.graphicsSizeModeWidth.checked ? 'width' : 'height';

                // Show/hide width or height input based on sizeMode
                if (this.host.dom.graphicsWidthGroup) {
                    this.host.dom.graphicsWidthGroup.style.display = block.sizeMode === 'width' ? 'flex' : 'none';
                }
                if (this.host.dom.graphicsHeightGroup) {
                    this.host.dom.graphicsHeightGroup.style.display = block.sizeMode === 'height' ? 'flex' : 'none';
                }

                // Если переключились на режим по ширине, нужно рассчитать widthInColumns из текущих размеров
                if (block.sizeMode === 'width') {
                    const module = this.host.settingsModule.get('gridModule');
                    const aspectRatio = block.originalWidth / block.originalHeight;
                    const heightInMm = module * block.heightInModules;
                    const widthInMm = heightInMm * aspectRatio;
                    block.widthInColumns = parseFloat(this.host.mmToColumns(widthInMm).toFixed(2));
                    if (this.host.dom.graphicsWidthInput) {
                        this.host.dom.graphicsWidthInput.value = block.widthInColumns.toFixed(2);
                    }
                } else {
                    // Если переключились на режим по высоте, нужно рассчитать heightInModules из текущих размеров
                    const module = this.host.settingsModule.get('gridModule');
                    const aspectRatio = block.originalWidth / block.originalHeight;
                    const widthInMm = this.host.columnsToMm(block.widthInColumns);
                    const heightInMm = widthInMm / aspectRatio;
                    block.heightInModules = parseFloat((heightInMm / module).toFixed(2));
                    if (this.host.dom.graphicsHeightInput) {
                        this.host.dom.graphicsHeightInput.value = block.heightInModules.toFixed(2);
                    }
                }

                this.host.updateGrid();
            };

            this.host.dom.graphicsSizeModeWidth.addEventListener('change', handleSizeModeChange);
            this.host.dom.graphicsSizeModeHeight.addEventListener('change', handleSizeModeChange);
        }
    }

    // Initialize click outside handler for closing panels
}
