/** Owns surface-aware constraints for text position, width and baseline. */
export class TextPositionGeometry {
    constructor(host) {
        this.host = host;
    }

    getContext(block) {
        return this.host.getSurfaceGridContext(this.host.resolveBlockPlane(block));
    }

    round(value, decimals = 0) {
        return decimals > 0 ? Number.parseFloat(value.toFixed(decimals)) : Math.round(value);
    }

    maxBaseline(context) {
        const height = context.planeHeight - 2 * context.margins * context.gridModule;
        return Math.max(0, Math.floor(height / context.gridModule + 1e-9) - 1);
    }

    constrainX(block, requested, context = this.getContext(block)) {
        const alignment = block.alignment || 'left';
        block.x = alignment === 'right'
            ? Math.max(Math.ceil(block.width), Math.min(requested, context.columnCount))
            : Math.max(1, Math.min(requested, context.columnCount));
        const maxWidth = alignment === 'right' ? block.x : context.columnCount - block.x + 1;
        if (block.width > maxWidth) block.width = Math.max(0.25, maxWidth);
        return block.x;
    }

    constrainRow(block, row, context = this.getContext(block)) {
        const y = row * (context.rowHeight + 1);
        const constrained = Math.max(0, Math.min(y, this.maxBaseline(context)));
        block.row = Math.floor(constrained / (context.rowHeight + 1));
        block.baselineOffset = 0;
        return block.row;
    }

    constrainWidth(block, requested, context = this.getContext(block)) {
        const width = Math.round(requested * 4) / 4;
        const maxWidth = (block.alignment || 'left') === 'right'
            ? block.x
            : context.columnCount - block.x + 1;
        block.width = Math.max(0.25, Math.min(width, maxWidth));
        return block.width;
    }

    applyGlobalBaseline(block, baseline, context = this.getContext(block)) {
        const surface = this.host.resolveBlockPlane(block);
        const constrained = Math.max(0, Math.min(baseline, this.maxBaseline(context)));
        const position = this.host.yToRowBaseline(constrained, surface);
        block.row = Math.max(0, position.row);
        block.baselineOffset = position.baselineOffset;
        return constrained;
    }

    switchAnchor(block, right, context = this.getContext(block)) {
        const wasRight = block.alignment === 'right';
        if (right === wasRight) return block.x;
        const delta = Math.max(0, Math.ceil(block.width) - 1);
        block.x = right
            ? Math.min(context.columnCount, block.x + delta)
            : Math.max(1, block.x - delta);
        block.alignment = right ? 'right' : 'left';
        return block.x;
    }
}
