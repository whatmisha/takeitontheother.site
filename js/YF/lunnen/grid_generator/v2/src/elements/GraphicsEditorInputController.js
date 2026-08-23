/**
 * Owns numeric inputs for the graphics editor. Geometry is resolved against
 * the selected surface so this controller can be tested without text-editor
 * or panel lifecycle concerns.
 */
export class GraphicsEditorInputController {
    constructor(host) {
        this.host = host;
    }

    initGraphicsInputs() {
        const block = this.host.objectDocument.getGraphicsBlock(
            this.host.currentEditingGraphicsId
        );
        if (!block) return;

        this.getInputConfigs(block).forEach(config => {
            this.bindInput(block, config);
        });
    }

    getInputConfigs(block) {
        return [
            {
                id: 'graphicsXInput',
                property: 'x',
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                constrain: value => this.constrainX(block, value)
            },
            {
                id: 'graphicsRowInput',
                property: 'row',
                assign: false,
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                constrain: value => this.constrainRow(block, value)
            },
            {
                id: 'graphicsBaselineInput',
                property: 'baseline',
                assign: false,
                baseStep: 1,
                shiftStep: 5,
                decimals: 0,
                constrain: value => this.constrainBaseline(block, value)
            },
            {
                id: 'graphicsWidthInput',
                property: 'widthInColumns',
                baseStep: 0.25,
                shiftStep: 1,
                decimals: 2,
                constrain: value => this.constrainWidth(block, value)
            },
            {
                id: 'graphicsHeightInput',
                property: 'heightInModules',
                baseStep: 0.25,
                shiftStep: 1,
                decimals: 2,
                constrain: value => this.constrainHeight(block, value)
            }
        ];
    }

    bindInput(block, config) {
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
            const value = this.readValue(block, replacement, config);
            this.applyValue(block, replacement, config, value);
        });

        replacement.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                replacement.blur();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                this.restoreValue(block, replacement, config);
                replacement.blur();
                this.host.updateGrid();
                return;
            }

            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

            event.preventDefault();
            const currentValue = this.readValue(block, replacement, config);
            const step = event.shiftKey ? config.shiftStep : config.baseStep;
            const roundedValue = this.roundValue(currentValue, step, config);
            const direction = event.key === 'ArrowUp' ? 1 : -1;
            const value = this.roundToDecimals(
                roundedValue + step * direction,
                this.host.sliderController.getDecimalsFromStep(step) || config.decimals
            );
            this.applyValue(block, replacement, config, value);
        });
    }

    readValue(block, input, config) {
        const parsed = Number.parseFloat(input.value);
        if (!Number.isNaN(parsed)) return parsed;
        if (config.property === 'baseline') {
            return this.host.rowBaselineToY(
                block.row,
                block.baselineOffset,
                this.host.resolveBlockPlane(block)
            ) + 1;
        }
        return block[config.property];
    }

    applyValue(block, input, config, value) {
        const constrained = config.constrain ? config.constrain(value) : value;
        if (config.assign !== false) {
            block[config.property] = constrained;
        }
        input.value = config.decimals > 0
            ? constrained.toFixed(config.decimals)
            : Math.round(constrained);
        this.host.markAsChanged?.();
        this.host.updateGrid();
    }

    restoreValue(block, input, config) {
        input.value = input.dataset.originalValue;
        const originalValue = Number.parseFloat(input.dataset.originalValue);
        if (Number.isNaN(originalValue)) return;

        if (config.property === 'baseline') {
            const position = this.host.yToRowBaseline(
                originalValue - 1,
                this.host.resolveBlockPlane(block)
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

    roundValue(value, step, config) {
        if (config.id === 'graphicsWidthInput' && config.baseStep === 0.25) {
            return Math.round(value / 0.25) * 0.25;
        }
        return this.roundToDecimals(
            value,
            this.host.sliderController.getDecimalsFromStep(step)
        );
    }

    roundToDecimals(value, decimals = 0) {
        return decimals > 0
            ? Number.parseFloat(value.toFixed(decimals))
            : Math.round(value);
    }

    getVerticalLimit(block, heightInModules = block.heightInModules) {
        const surface = this.host.resolveBlockPlane(block);
        const context = this.host.getSurfaceGridContext(surface);
        const contentHeight = context.planeHeight - 2 * context.margins * context.gridModule;
        const totalBaselines = Math.floor(contentHeight / context.gridModule + 1e-9);
        return {
            surface,
            context,
            maxY: totalBaselines - heightInModules
        };
    }

    constrainX(block, value) {
        const context = this.host.getSurfaceGridContext(this.host.resolveBlockPlane(block));
        const height = context.gridModule * block.heightInModules;
        const width = height * (block.originalWidth / block.originalHeight);
        const columnWidth = (
            context.planeWidth -
            context.gridModule * context.margins * 2 -
            context.gridModule * (context.columnCount - 1)
        ) / context.columnCount;
        const occupiedColumns = Math.ceil(width / (columnWidth + context.gridModule));
        const maxX = Math.max(1, context.columnCount - occupiedColumns + 1);
        return Math.max(1, Math.min(value, maxX));
    }

    constrainRow(block, value) {
        const { surface, context, maxY } = this.getVerticalLimit(block);
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

    constrainBaseline(block, value) {
        const { surface, maxY } = this.getVerticalLimit(block);
        const constrainedY = Math.max(0, Math.min(Math.round(value - 1), maxY));
        const position = this.host.yToRowBaseline(constrainedY, surface);

        block.row = Math.max(0, position.row);
        block.baselineOffset = position.baselineOffset;
        if (this.host.dom.graphicsRowInput) {
            this.host.dom.graphicsRowInput.value = block.row + 1;
        }
        return constrainedY + 1;
    }

    constrainWidth(block, value) {
        const surface = this.host.resolveBlockPlane(block);
        const context = this.host.getSurfaceGridContext(surface);
        const width = Math.max(0.25, Math.min(value, context.columnCount));
        const widthMm = this.host.columnsToMm(width, surface);
        const height = widthMm / (block.originalWidth / block.originalHeight) / context.gridModule;

        block.heightInModules = Number.parseFloat(height.toFixed(2));
        if (this.host.dom.graphicsHeightInput) {
            this.host.dom.graphicsHeightInput.value = height.toFixed(2);
        }
        this.constrainVerticalPosition(block, height, surface);
        return width;
    }

    constrainHeight(block, value) {
        const surface = this.host.resolveBlockPlane(block);
        const context = this.host.getSurfaceGridContext(surface);
        const height = Math.max(0.25, Math.min(value, 20));
        const widthMm = height * context.gridModule * (block.originalWidth / block.originalHeight);
        const width = this.host.mmToColumns(widthMm, surface);

        block.widthInColumns = Number.parseFloat(width.toFixed(2));
        if (this.host.dom.graphicsWidthInput) {
            this.host.dom.graphicsWidthInput.value = width.toFixed(2);
        }
        this.constrainVerticalPosition(block, height, surface);
        return height;
    }

    constrainVerticalPosition(block, height, surface) {
        const { maxY } = this.getVerticalLimit(block, height);
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
}
