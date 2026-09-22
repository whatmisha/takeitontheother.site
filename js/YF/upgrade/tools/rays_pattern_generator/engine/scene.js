// Private Rays geometry, with no DOM, storage, renderer or file dependencies.
// T.3a: verified against frozen legacy fixtures; not wired into the UI yet.
export const ALLOWED_RAY_COUNTS = Object.freeze([3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24]);
export const DEFAULT_PARAMETERS = Object.freeze({
    lineWidth: 2, gap: 19, rayLength: 56, rayCount: 5, scale: 1,
    roundCap: false, offsetRows: false, rasterMode: false, imageRasterMode: false,
    zeroRayLength: 30, hundredRayLength: 100, zeroLineWidth: 1, hundredLineWidth: 2,
    hideConnectingLines: false, brightnessContrast: 1, invertImage: false,
    horizontalGap: 20, verticalGap: 10,
    vanishingPoint: Object.freeze({ x: 75, y: 75 })
});

export function nearestAllowedRayCount(value) {
    if (ALLOWED_RAY_COUNTS.includes(value)) return value;
    let nearest = ALLOWED_RAY_COUNTS[0];
    let distance = Math.abs(value - nearest);
    for (const count of ALLOWED_RAY_COUNTS.slice(1)) {
        const candidateDistance = Math.abs(value - count);
        if (candidateDistance < distance) {
            nearest = count;
            distance = candidateDistance;
        }
    }
    return nearest;
}

function brightnessAt(p, imageData, relativeX, moduleY, documentHeight) {
    const { width, height, data } = imageData;
    const x = Math.max(0, Math.min(width - 1, Math.floor(relativeX * (width - 1))));
    const y = Math.max(0, Math.min(height - 1, Math.floor((moduleY / documentHeight) * (height - 1))));
    const index = (y * width + x) * 4;
    // Legacy intentionally ignores alpha. Do not introduce compositing in T.3.
    let brightness = (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]) / 255;
    if (p.brightnessContrast !== 1) brightness = Math.max(0, Math.min(1, 0.5 + (brightness - 0.5) * p.brightnessContrast));
    return brightness;
}

function toneAt(p, imageData, relativeX, moduleY, height) {
    let amount;
    // Keep legacy precedence when both flags are set; mode normalization belongs to T.4.
    if (p.rasterMode && relativeX !== undefined) amount = relativeX;
    else if (p.imageRasterMode && imageData && relativeX !== undefined) {
        const brightness = brightnessAt(p, imageData, relativeX, moduleY, height);
        amount = p.invertImage ? brightness : 1 - brightness;
    } else return { rayLength: p.rayLength, lineWidth: p.lineWidth };
    const factor = p.rayLength / 56;
    const low = p.zeroRayLength * factor;
    const high = p.hundredRayLength * factor;
    return {
        rayLength: low + amount * (high - low),
        lineWidth: p.zeroLineWidth + amount * (p.hundredLineWidth - p.zeroLineWidth)
    };
}

function rayAngles(count) {
    const angles = [Math.PI, 0, Math.PI * 1.5];
    if (count === 5) return [...angles, Math.PI * 1.25, Math.PI * 1.75];
    const additional = count - 3;
    for (let i = 0; i < additional; i++) angles.push(Math.PI + (i + 1) * Math.PI / (additional + 1));
    // Even counts deliberately retain the duplicate vertical ray from legacy.
    return angles;
}

/**
 * Produces ordered module groups and dividers. Module points are already scaled
 * but local to their x/y origin; divider points are document coordinates.
 * Preview colour, SVG colour/background and preview-only page border are not geometry.
 * imageData contains decoded RGBA pixels; decoding remains adapter-owned.
 */
export function buildRaysScene(settings = {}, { width = 3000, height = 1000, imageData = null } = {}) {
    const p = { ...DEFAULT_PARAMETERS, ...settings };
    const moduleWidth = 150 * p.scale;
    const moduleHeight = 75 * p.scale;
    const horizontalGap = p.horizontalGap * p.scale;
    const verticalGap = p.verticalGap * p.scale;
    const stepX = moduleWidth + horizontalGap;
    const stepY = moduleHeight + verticalGap;
    if (![width, height, p.scale, stepX, stepY].every(value => Number.isFinite(value) && value > 0)
        || !Number.isFinite(p.rayCount)) throw new RangeError('Rays scene requires finite dimensions, scale, spacing and ray count');

    const columns = Math.ceil(width / stepX);
    const rows = Math.ceil(height / stepY);
    if (!Number.isSafeInteger(columns * rows)) throw new RangeError('Rays grid dimensions overflow');
    const rowOffset = !p.offsetRows ? stepX / 2 : 0;
    const extraWidth = !p.offsetRows && rows % 2 === 0 ? rowOffset : 0;
    const totalWidth = columns * moduleWidth + (columns - 1) * horizontalGap + extraWidth;
    const totalHeight = rows * moduleHeight + (rows - 1) * verticalGap;
    const offsetX = (width - totalWidth) / 2;
    const offsetY = (height - totalHeight) / 2;
    const angles = rayAngles(p.rayCount);
    const cap = p.roundCap ? 'round' : 'butt';
    const tonal = p.rasterMode || p.imageRasterMode;
    const items = [];

    for (let row = 0; row < rows; row++) {
        const shifted = row % 2 === 1 && !p.offsetRows;
        const rowColumns = columns + (shifted ? 1 : 0);
        for (let col = 0; col < rowColumns; col++) {
            const x = offsetX + (shifted ? rowOffset : 0) + col * stepX;
            const y = offsetY + row * stepY;
            if (!(x < width && y < height && x + moduleWidth > 0 && y + moduleHeight > 0)) continue;
            const relativeX = tonal ? Math.min(1, Math.max(0, x / width)) : undefined;
            const tone = toneAt(p, imageData, relativeX, y, height);
            const lines = angles.map(angle => ({
                points: [
                    p.vanishingPoint.x * p.scale + Math.cos(angle) * p.gap * p.scale,
                    p.vanishingPoint.y * p.scale + Math.sin(angle) * p.gap * p.scale,
                    p.vanishingPoint.x * p.scale + Math.cos(angle) * (p.gap + tone.rayLength) * p.scale,
                    p.vanishingPoint.y * p.scale + Math.sin(angle) * (p.gap + tone.rayLength) * p.scale
                ],
                width: tone.lineWidth * p.scale, cap
            }));
            items.push({ kind: 'module', x, y, lines });
            if (col < rowColumns - 1 && !p.hideConnectingLines) {
                const edgeX = x + moduleWidth;
                // Unlike module samples, legacy divider relativeX is NOT clamped.
                const dividerTone = toneAt(p, imageData, tonal ? edgeX / width : undefined, y, height);
                const length = dividerTone.rayLength * p.scale;
                const lineX = edgeX + horizontalGap / 2;
                const lineY = y + moduleHeight / 2 - length / 2;
                items.push({ kind: 'divider', points: [lineX, lineY, lineX, lineY + length], width: dividerTone.lineWidth * p.scale, cap });
            }
        }
    }
    return { width, height, items };
}
