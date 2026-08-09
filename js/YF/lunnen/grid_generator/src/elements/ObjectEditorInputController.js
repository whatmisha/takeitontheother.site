/**
 * Numeric input behavior shared by the text and graphics object editors.
 * Position math remains delegated to GridGenerator's surface-aware helpers.
 */
export class ObjectEditorInputController {
    constructor(host) {
        this.host = host;
    }

    initGraphicsInputs() {
        const block = this.host.graphicsBlocks?.find(
            candidate => candidate.id === this.host.currentEditingGraphicsId
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
}
