/**
 * shapes.js — geometry for a single pattern element.
 *
 * Ported from the original Wander Bender ShapeGenerator. Builds a rounded
 * "capsule" (straight or arched) as a paper.js Path so overlapping elements
 * can be united into one organic outline. Uses the global `paper` (loaded via
 * CDN) — keeps this tool self-contained from the framework folder.
 *
 * All values are interpreted in millimetres (1 SVG user unit = 1 mm).
 */

/**
 * Build a shape from a line definition.
 * @param {Array} line - [{x,y}, {x,y}, arcAmount?] — start, end and optional sagitta.
 * @param {number} width - element thickness (mm).
 * @param {number} cornerRadius - corner radius for the straight capsule (mm).
 * @param {number} pivotDistance - distance along the line used as the pivot.
 * @returns {{shape: paper.Path, pivotPoint: {x:number,y:number}}|null}
 */
export function createShapeFromLine(line, width, cornerRadius, pivotDistance) {
    if (line.length < 2) return null;

    const start = line[0];
    const end = line[1];
    const arcAmount = line[2] || 0;

    const pivotPoint = getPointOnLine(line, pivotDistance);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 0.001) return null;

    // Straight capsule → rounded rectangle.
    if (arcAmount === 0 || arcAmount < 0.1) {
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const rect = new paper.Path.Rectangle({
            point: [start.x, start.y - width / 2],
            size: [length, width],
            radius: Math.min(cornerRadius, width / 2)
        });
        if (angle !== 0) rect.rotate(angle, new paper.Point(start.x, start.y));
        return { shape: rect, pivotPoint };
    }

    // Arched capsule.
    const chord = length;
    const sagitta = arcAmount;
    const radius = (chord * chord + 4 * sagitta * sagitta) / (8 * sagitta);

    const midX = start.x + dx * 0.5;
    const midY = start.y + dy * 0.5;
    const perpX = -dy / length;
    const perpY = dx / length;
    const centerX = midX + perpX * (radius - sagitta);
    const centerY = midY + perpY * (radius - sagitta);

    const halfChord = chord / 2;
    const angleSpan = 2 * Math.asin(Math.min(1, halfChord / radius));
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);

    // Caps live INSIDE the line length so total length stays constant.
    const capLength = width / 2;
    const tStart = capLength / length;
    const tEnd = 1 - capLength / length;

    const segments = 30;
    const shape = new paper.Path();

    // Outer edge.
    for (let i = 0; i <= segments; i++) {
        const t = tStart + (tEnd - tStart) * (i / segments);
        const a = startAngle + angleSpan * t;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        shape.add(new paper.Point(
            centerX + radius * nx + nx * width / 2,
            centerY + radius * ny + ny * width / 2
        ));
    }

    // End cap (right).
    const endAngle = startAngle + angleSpan * tEnd;
    const endCx = centerX + radius * Math.cos(endAngle);
    const endCy = centerY + radius * Math.sin(endAngle);
    const endTx = -Math.sin(endAngle);
    const endTy = Math.cos(endAngle);
    const endNx = Math.cos(endAngle);
    const endNy = Math.sin(endAngle);
    const capSteps = 10;
    for (let i = 1; i <= capSteps; i++) {
        const ca = (i / capSteps) * Math.PI;
        shape.add(new paper.Point(
            endCx + endNx * Math.cos(ca) * width / 2 + endTx * Math.sin(ca) * width / 2,
            endCy + endNy * Math.cos(ca) * width / 2 + endTy * Math.sin(ca) * width / 2
        ));
    }

    // Inner edge (reverse).
    for (let i = segments; i >= 0; i--) {
        const t = tStart + (tEnd - tStart) * (i / segments);
        const a = startAngle + angleSpan * t;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        shape.add(new paper.Point(
            centerX + radius * nx - nx * width / 2,
            centerY + radius * ny - ny * width / 2
        ));
    }

    // Start cap (left).
    const sAngle = startAngle + angleSpan * tStart;
    const sCx = centerX + radius * Math.cos(sAngle);
    const sCy = centerY + radius * Math.sin(sAngle);
    const sTx = -Math.sin(sAngle);
    const sTy = Math.cos(sAngle);
    const sNx = Math.cos(sAngle);
    const sNy = Math.sin(sAngle);
    for (let i = 1; i <= capSteps; i++) {
        const ca = (i / capSteps) * Math.PI;
        shape.add(new paper.Point(
            sCx - sNx * Math.cos(ca) * width / 2 - sTx * Math.sin(ca) * width / 2,
            sCy - sNy * Math.cos(ca) * width / 2 - sTy * Math.sin(ca) * width / 2
        ));
    }

    shape.closePath();
    if (cornerRadius > 0) {
        shape.smooth({ type: 'continuous', factor: Math.min(cornerRadius / width, 0.5) });
    }
    return { shape, pivotPoint };
}

/**
 * Point at `distance` along a (possibly arched) line.
 */
export function getPointOnLine(line, distance) {
    if (line.length < 2) return { x: 0, y: 0 };
    const start = line[0];
    const end = line[1];
    const arcAmount = line[2] || 0;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy) || 1;
    const t = Math.min(distance / lineLength, 1);

    if (arcAmount === 0) {
        return { x: start.x + dx * t, y: start.y + dy * t };
    }

    const chord = lineLength;
    const sagitta = arcAmount;
    const radius = (chord * chord + 4 * sagitta * sagitta) / (8 * sagitta);
    const midX = start.x + dx * 0.5;
    const midY = start.y + dy * 0.5;
    const perpX = -dy / lineLength;
    const perpY = dx / lineLength;
    const centerX = midX + perpX * (radius - sagitta);
    const centerY = midY + perpY * (radius - sagitta);
    const halfChord = chord / 2;
    const angleSpan = 2 * Math.asin(Math.min(1, halfChord / radius));
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
    const currentAngle = startAngle + angleSpan * t;
    return {
        x: centerX + radius * Math.cos(currentAngle),
        y: centerY + radius * Math.sin(currentAngle)
    };
}
