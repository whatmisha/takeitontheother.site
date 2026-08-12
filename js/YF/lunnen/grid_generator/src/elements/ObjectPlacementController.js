/**
 * Surface-aware placement and bounds for every editable object type.
 */
export class ObjectPlacementController {
    constructor(host) {
        this.host = host;
    }

    constrainAll() {
        this.host.objectDocument.textBlocks.forEach(block => this.constrain(block, 'text'));
        this.host.objectDocument.graphicsBlocks.forEach(block => this.constrain(block, 'graphics'));
    }

    getColumnMetrics(context) {
        const gutter = context.gridModule;
        const contentWidth = Math.max(
            gutter,
            context.frontWidth - 2 * context.margins * gutter
        );
        const columnWidth = Math.max(
            gutter * 0.1,
            (contentWidth - (context.columnCount - 1) * gutter) / context.columnCount
        );
        return { columnWidth, gutter };
    }

    columnsToMm(columns, context) {
        const { columnWidth, gutter } = this.getColumnMetrics(context);
        return columnWidth * columns + gutter * (columns - 1);
    }

    mmToColumns(widthMm, context) {
        const { columnWidth, gutter } = this.getColumnMetrics(context);
        return (widthMm + gutter) / (columnWidth + gutter);
    }

    getWidthInColumns(block, type, context) {
        if (type === 'text') return Number(block.width) || 1;
        if (block.sizeMode === 'width') return Number(block.widthInColumns) || 1;

        const aspectRatio = Number(block.originalWidth) / Number(block.originalHeight);
        if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
            return Number(block.widthInColumns) || 1;
        }
        const widthMm = context.gridModule * (Number(block.heightInModules) || 3) * aspectRatio;
        return this.mmToColumns(widthMm, context);
    }

    /** Preserve the object's share of the source grid when crossing surfaces. */
    transferRelativeWidth(block, targetSurface, type) {
        const sourceSurface = block.surface || 'front';
        if (sourceSurface === targetSurface) return false;

        const sourceContext = this.host.surfaceCoordinates.getGridContext(sourceSurface);
        const targetContext = this.host.surfaceCoordinates.getGridContext(targetSurface);
        const sourceWidth = this.getWidthInColumns(block, type, sourceContext);
        const widthRatio = Math.max(0, Math.min(1, sourceWidth / sourceContext.columnCount));
        const targetWidth = Math.max(
            0.25,
            Math.min(targetContext.columnCount, widthRatio * targetContext.columnCount)
        );
        const roundedWidth = Number.parseFloat(targetWidth.toFixed(4));

        if (type === 'text') {
            block.width = roundedWidth;
        } else {
            block.widthInColumns = roundedWidth;
            const aspectRatio = Number(block.originalWidth) / Number(block.originalHeight);
            if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
                const widthMm = this.columnsToMm(targetWidth, targetContext);
                block.heightInModules = Number.parseFloat(
                    Math.max(0.25, widthMm / aspectRatio / targetContext.gridModule).toFixed(4)
                );
            }
        }
        block.surface = targetSurface;
        return true;
    }

    moveToSurface(block, targetSurface, type) {
        this.transferRelativeWidth(block, targetSurface, type);
        block.surface = targetSurface;
        block.x = 1;
        block.row = 0;
        block.baselineOffset = 0;
        this.constrain(block, type);
        this.syncOpenEditor(block, type);
    }

    constrain(block, type) {
        if (!block || !block.lockPosition) return;
        const surface = block.surface || 'front';
        const context = this.host.surfaceCoordinates.getGridContext(surface);
        const module = context.gridModule;
        const margins = context.margins;
        const columnCount = context.columnCount;
        const rowHeight = context.rowHeight;
        const contentHeight = Math.max(module, context.frontHeight - 2 * margins * module);
        const maxBaseline = Math.max(1, Math.floor(contentHeight / module + 1e-9));

        block.surface = surface;
        block.baselineOffset = Math.max(0, Math.min(rowHeight, Number(block.baselineOffset) || 0));

        if (type === 'text') {
            block.width = Math.max(0.25, Math.min(Number(block.width) || 1, columnCount));
            const alignsRight = block.alignment === 'right';
            const minX = alignsRight ? Math.ceil(block.width) : 1;
            const maxX = alignsRight
                ? columnCount
                : Math.max(1, columnCount - block.width + 1);
            block.x = Math.max(minX, Math.min(Number(block.x) || 1, maxX));
        } else {
            const columnWidth = Math.max(
                module * 0.1,
                (context.frontWidth - module * margins * 2 - module * (columnCount - 1)) /
                    columnCount
            );
            let widthInColumns = Number(block.widthInColumns) || 1;
            if (block.sizeMode !== 'width') {
                const aspectRatio = block.originalWidth && block.originalHeight
                    ? block.originalWidth / block.originalHeight
                    : 1;
                const widthInMm = module * (Number(block.heightInModules) || 3) * aspectRatio;
                widthInColumns = Math.max(1, (widthInMm + module) / (columnWidth + module));
            }
            const maxX = Math.max(1, Math.floor(columnCount - widthInColumns) + 1);
            block.x = Math.max(1, Math.min(Number(block.x) || 1, maxX));
        }

        const elementHeight = type === 'graphics' ? Number(block.heightInModules) || 3 : 1;
        const currentY = this.host.surfaceCoordinates.getBlockY(block);
        const constrainedY = Math.max(0, Math.min(currentY, Math.max(0, maxBaseline - elementHeight)));
        const position = this.host.surfaceCoordinates.yToRowBaseline(constrainedY, surface);
        block.row = Math.max(0, Math.min(context.rowCount - 1, position.row));
        block.baselineOffset = Math.max(0, Math.min(rowHeight, position.baselineOffset));
    }

    getPointerOffset(block, clientX, clientY) {
        const pointer = this.host.surfaceCoordinates.getSurfacePointer(clientX, clientY);
        if (!pointer || pointer.surface !== (block.surface || 'front')) return { x: 0, y: 0 };
        const position = this.host.textLayout.calculateBlockPosition(block, 1);
        return {
            x: pointer.local.x - position.x,
            y: pointer.local.y - (position.y + pointer.context.gridModule * pointer.context.margins)
        };
    }

    positionAtPointer(block, clientX, clientY, type, offset = { x: 0, y: 0 }) {
        const pointer = this.host.surfaceCoordinates.getSurfacePointer(clientX, clientY);
        if (!pointer) return false;
        const { context, surface } = pointer;
        const module = context.gridModule;
        const margin = module * context.margins;
        const columnWidth = Math.max(
            module * 0.1,
            (context.frontWidth - 2 * margin - (context.columnCount - 1) * module) /
                context.columnCount
        );
        const localX = pointer.local.x - offset.x;
        const localY = pointer.local.y - offset.y;

        this.transferRelativeWidth(block, surface, type);
        block.surface = surface;
        block.x = Math.round((localX - margin) / (columnWidth + module)) + 1;
        const baseline = Math.max(0, Math.round((localY - margin) / module));
        const position = this.host.surfaceCoordinates.yToRowBaseline(baseline, surface);
        block.row = position.row;
        block.baselineOffset = position.baselineOffset;
        this.constrain(block, type);
        this.syncOpenEditor(block, type);
        return true;
    }

    recalculateGraphicsWidthFromHeight(block) {
        if (!block.originalWidth || !block.originalHeight) {
            block.widthInColumns = 4;
            return;
        }
        const surface = block.surface || 'front';
        const context = this.host.surfaceCoordinates.getGridContext(surface);
        const widthMm = context.gridModule * (block.heightInModules || 3) *
            (block.originalWidth / block.originalHeight);
        block.widthInColumns = Number.parseFloat(
            this.host.surfaceCoordinates.mmToColumns(widthMm, surface).toFixed(2)
        );
    }

    updateBuiltInPositions() {
        const settings = this.host.settingsModule;
        const module = settings.get('gridModule');
        const contentHeight = settings.get('frontHeight') - settings.get('margins') * 2 * module;
        const lastModule = Math.floor(contentHeight / module);

        this.host.objectDocument.getBuiltInGraphicsBlocks().forEach(block => {
            const position = this.host.surfaceCoordinates.yToRowBaseline(
                Math.max(0, lastModule - block.heightInModules),
                block.surface || 'front'
            );
            block.row = position.row;
            block.baselineOffset = position.baselineOffset;
        });
    }

    syncOpenEditor(block, type) {
        const dom = this.host.dom || {};
        const surface = block.surface || 'front';
        if (type === 'text' && this.host.currentEditingBlock?.id === block.id) {
            if (dom.paragraphSurfaceSelect) dom.paragraphSurfaceSelect.value = surface;
            if (dom.paragraphXInput) dom.paragraphXInput.value = Math.round(block.x);
            if (dom.paragraphRowInput) dom.paragraphRowInput.value = block.row + 1;
            if (dom.paragraphBaselineInput) {
                dom.paragraphBaselineInput.value =
                    this.host.surfaceCoordinates.rowBaselineToY(block.row, block.baselineOffset, surface) + 1;
            }
            if (dom.paragraphWidthInput) dom.paragraphWidthInput.value = block.width.toFixed(2);
        }
        if (type === 'graphics' && this.host.currentEditingGraphicsId === block.id) {
            if (dom.graphicsSurfaceSelect) dom.graphicsSurfaceSelect.value = surface;
            if (dom.graphicsXInput) dom.graphicsXInput.value = Math.round(block.x);
            if (dom.graphicsRowInput) dom.graphicsRowInput.value = block.row + 1;
            if (dom.graphicsBaselineInput) {
                dom.graphicsBaselineInput.value =
                    this.host.surfaceCoordinates.rowBaselineToY(block.row, block.baselineOffset, surface) + 1;
            }
            if (dom.graphicsWidthInput) {
                dom.graphicsWidthInput.value = (block.widthInColumns || 1).toFixed(2);
            }
            if (dom.graphicsHeightInput) {
                dom.graphicsHeightInput.value = (block.heightInModules || 1).toFixed(2);
            }
        }
    }
}
