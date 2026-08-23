const FLOATING_POINT_EPSILON = 1e-6;

export function calculateColumnRects({
    x,
    y,
    width,
    height,
    scale,
    module,
    margins,
    columnCount,
    columnWidth
}) {
    const margin = module * margins * scale;
    const scaledColumnWidth = columnWidth * scale;
    const gutter = module * scale;

    return Array.from({ length: columnCount }, (_, index) => ({
        x: x + margin + index * (scaledColumnWidth + gutter),
        y: y + margin,
        width: scaledColumnWidth,
        height: height - 2 * margin
    }));
}

export function calculateRowRects({
    x,
    y,
    width,
    height,
    scale,
    module,
    margins,
    rowCount,
    rowHeight
}) {
    const margin = module * margins * scale;
    const scaledRowHeight = module * rowHeight * scale;
    const gutter = module * scale;
    const rects = [];

    for (let index = 0; index < rowCount; index++) {
        const currentY = y + margin + index * (scaledRowHeight + gutter);
        if (currentY + scaledRowHeight > y + height + FLOATING_POINT_EPSILON) break;
        rects.push({
            x: x + margin,
            y: currentY,
            width: width - 2 * margin,
            height: scaledRowHeight
        });
    }

    return rects;
}

export function calculateBaselineRects({ x, y, width, height, scale, module, margins }) {
    const margin = module * margins * scale;
    const baselineHeight = module * scale;
    const maxY = y + height - margin;
    const rects = [];

    for (
        let currentY = y + margin;
        currentY + baselineHeight <= maxY;
        currentY += baselineHeight
    ) {
        rects.push({
            x: x + margin,
            y: currentY,
            width: width - 2 * margin,
            height: baselineHeight
        });
    }

    return rects;
}
