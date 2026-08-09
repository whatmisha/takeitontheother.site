/**
 * Maps editor coordinates and grid values to surface-local coordinates.
 *
 * The mapper is intentionally DOM-free. Screen-to-SVG conversion and the
 * current rendered layout are supplied by the editor through callbacks.
 */
export class SurfaceCoordinateMapper {
    constructor({
        settings,
        surfaceManager,
        getLayout = () => null,
        clientToSvgPoint = () => null
    }) {
        this.settings = settings;
        this.surfaceManager = surfaceManager;
        this.getLayout = getLayout;
        this.clientToSvgPoint = clientToSvgPoint;
    }

    getGridContext(surface = 'front') {
        const layout = {
            x: 0,
            y: 0,
            frontWidth: this.settings.get('frontWidth'),
            frontHeight: this.settings.get('frontHeight'),
            thickness: this.settings.get('thickness')
        };
        const geometry = this.surfaceManager.getGeometry(surface, layout);
        return this.surfaceManager.getGridContext(surface, geometry.localWidth, geometry.localHeight);
    }

    rowBaselineToY(row, baselineOffset, surface = 'front') {
        const rowHeight = this.getGridContext(surface).rowHeight;
        return row * (rowHeight + 1) + baselineOffset;
    }

    yToRowBaseline(y, surface = 'front') {
        const rowWithGutter = this.getGridContext(surface).rowHeight + 1;
        return {
            row: Math.floor(y / rowWithGutter),
            baselineOffset: y % rowWithGutter
        };
    }

    getBlockY(block) {
        return this.rowBaselineToY(
            block.row,
            block.baselineOffset,
            block.surface || 'front'
        );
    }

    getColumnMetrics(surface = 'front') {
        const context = this.getGridContext(surface);
        const gutter = context.gridModule;
        const columnWidth = (
            context.frontWidth -
            context.gridModule * context.margins * 2 -
            gutter * (context.columnCount - 1)
        ) / context.columnCount;
        return { context, columnWidth, gutter };
    }

    columnsToMm(columns, surface = 'front') {
        const { columnWidth, gutter } = this.getColumnMetrics(surface);
        return columnWidth * columns + gutter * (columns - 1);
    }

    mmToColumns(widthMm, surface = 'front') {
        const { columnWidth, gutter } = this.getColumnMetrics(surface);
        return (widthMm + gutter) / (columnWidth + gutter);
    }

    getSurfacePointer(clientX, clientY) {
        const layout = this.getLayout();
        if (!layout) return null;

        const point = this.clientToSvgPoint(clientX, clientY);
        if (!point) return null;

        const surface = this.surfaceManager.surfaceAtPoint(point, layout);
        if (!surface) return null;

        const local = this.surfaceManager.globalToLocal(surface, point, layout);
        const scale = layout.scale || 1;
        return {
            point,
            surface,
            local: { x: local.x / scale, y: local.y / scale },
            context: this.getGridContext(surface)
        };
    }
}
