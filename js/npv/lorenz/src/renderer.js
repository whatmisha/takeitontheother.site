import { projectTrajectory } from './projection.js';

const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const compact = (value) => Number(value.toFixed(2));

let projectionCache = { trajectory: null, key: '', projected: null };

function projectionFor(trajectory, settings, width, height) {
    const key = [
        width,
        height,
        settings.rotationX,
        settings.rotationY,
        settings.rotationZ,
        settings.perspective,
        settings.viewScale,
        settings.depthStretch
    ].join('|');
    if (projectionCache.trajectory === trajectory && projectionCache.key === key) {
        return projectionCache.projected;
    }
    projectionCache = {
        trajectory,
        key,
        projected: projectTrajectory(trajectory, settings, width, height)
    };
    return projectionCache.projected;
}

function axisGeometry(projected) {
    const b = projected.rawBounds;
    const origin = projected.projectRawPoint(b.minX, b.minY, b.minZ);
    return [
        { label: 'X', from: origin, to: projected.projectRawPoint(b.maxX, b.minY, b.minZ) },
        { label: 'Y', from: origin, to: projected.projectRawPoint(b.minX, b.maxY, b.minZ) },
        { label: 'Z', from: origin, to: projected.projectRawPoint(b.minX, b.minY, b.maxZ) }
    ];
}

function drawAxes(context, projected, settings) {
    if (!settings.showAxes) return;
    const axes = axisGeometry(projected);
    context.save();
    context.strokeStyle = 'rgba(210,210,210,0.38)';
    context.fillStyle = 'rgba(210,210,210,0.72)';
    context.lineWidth = 1;
    context.font = '12px CoFo Sans, sans-serif';
    axes.forEach((axis) => {
        context.beginPath();
        context.moveTo(axis.from.x, axis.from.y);
        context.lineTo(axis.to.x, axis.to.y);
        context.stroke();
        context.fillText(axis.label, axis.to.x + 7, axis.to.y - 7);
    });
    context.restore();
}

export function preparePixelPositions(projected, settings) {
    const gridStep = Math.max(0, Number(settings.gridStep || 0));
    if (gridStep < 0.25) {
        return { points: projected.points, pixelCount: projected.points.length / 3 };
    }

    const unique = new Map();
    for (let offset = 0; offset < projected.points.length; offset += 3) {
        const column = Math.round(projected.points[offset] / gridStep);
        const row = Math.round(projected.points[offset + 1] / gridStep);
        const key = `${column}:${row}`;
        // Keep the foremost sample when several trajectory points occupy one cell.
        const previous = unique.get(key);
        const depth = projected.points[offset + 2];
        if (!previous || depth > previous.depth) {
            unique.set(key, { x: column * gridStep, y: row * gridStep, depth });
        }
    }

    const sorted = [...unique.values()].sort((a, b) => a.depth - b.depth);
    const points = new Float32Array(sorted.length * 3);
    sorted.forEach((point, index) => {
        const offset = index * 3;
        points[offset] = point.x;
        points[offset + 1] = point.y;
        points[offset + 2] = point.depth;
    });
    return { points, pixelCount: sorted.length };
}

export function prepareAnimatedPixelPositions(projected, settings, phase = 0) {
    const pointCount = Math.max(0, Number(projected.pointCount) || projected.points.length / 3);
    if (pointCount < 1 || projected.points.length < 3) {
        return { points: new Float32Array(), pixelCount: 0 };
    }
    const particleCount = Math.max(1, Math.min(3000, Math.round(Number(settings.particleCount) || 600)));
    const trailLength = Math.max(0, Math.min(24, Math.round(Number(settings.trailLength) || 0)));
    const animated = new Float32Array(particleCount * (trailLength + 1) * 3);
    const normalizedPhase = ((Number(phase) || 0) % 1 + 1) % 1;
    const goldenRatioConjugate = 0.6180339887498949;
    let written = 0;

    const trailStep = Math.max(1, Math.floor(pointCount / particleCount / (trailLength + 3)));
    for (let head = 0; head < particleCount; head++) {
        const offsetPhase = (head * goldenRatioConjugate) % 1;
        const headPosition = ((normalizedPhase + offsetPhase) % 1) * (pointCount - 1);
        for (let trail = 0; trail <= trailLength; trail++) {
            const unwrapped = headPosition - trail * trailStep;
            const position = (unwrapped % pointCount + pointCount) % pointCount;
            const index = Math.floor(position);
            const nextIndex = Math.min(pointCount - 1, index + 1);
            const mix = position - index;
            const a = index * 3;
            const b = nextIndex * 3;
            const target = written * 3;
            animated[target] = projected.points[a] + (projected.points[b] - projected.points[a]) * mix;
            animated[target + 1] = projected.points[a + 1] + (projected.points[b + 1] - projected.points[a + 1]) * mix;
            animated[target + 2] = projected.points[a + 2] + (projected.points[b + 2] - projected.points[a + 2]) * mix;
            written++;
        }
    }

    return preparePixelPositions({ points: animated.subarray(0, written * 3) }, settings);
}

function pixelsFor(projected, settings, motionPhase) {
    return settings.animateParticles
        ? prepareAnimatedPixelPositions(projected, settings, motionPhase)
        : preparePixelPositions(projected, settings);
}

export function renderLorenzCanvas(context, width, height, settings, trajectory, {
    transparent = false,
    motionPhase = 0
} = {}) {
    context.save();
    if (!transparent) {
        context.fillStyle = settings.backgroundColor;
        context.fillRect(0, 0, width, height);
    }
    const projected = projectionFor(trajectory, settings, width, height);
    drawAxes(context, projected, settings);
    const pixels = pixelsFor(projected, settings, motionPhase);

    const pixelWidth = Math.max(0.25, Number(settings.pixelWidth || 1));
    const pixelHeight = Math.max(0.25, Number(settings.pixelHeight || 1));
    context.fillStyle = settings.pixelColor;
    for (let offset = 0; offset < pixels.points.length; offset += 3) {
        context.fillRect(
            pixels.points[offset] - pixelWidth * 0.5,
            pixels.points[offset + 1] - pixelHeight * 0.5,
            pixelWidth,
            pixelHeight
        );
    }
    context.restore();
    return { projected, pixelCount: pixels.pixelCount };
}

export function renderLorenzSvg(width, height, settings, trajectory, { motionPhase = 0 } = {}) {
    const projected = projectionFor(trajectory, settings, width, height);
    const pixels = pixelsFor(projected, settings, motionPhase);
    const pixelWidth = Math.max(0.25, Number(settings.pixelWidth || 1));
    const pixelHeight = Math.max(0.25, Number(settings.pixelHeight || 1));
    const halfW = pixelWidth * 0.5;
    const halfH = pixelHeight * 0.5;
    const path = [];
    for (let offset = 0; offset < pixels.points.length; offset += 3) {
        const x = compact(pixels.points[offset] - halfW);
        const y = compact(pixels.points[offset + 1] - halfH);
        path.push(`M${x} ${y}h${compact(pixelWidth)}v${compact(pixelHeight)}h-${compact(pixelWidth)}Z`);
    }
    const axes = settings.showAxes
        ? axisGeometry(projected).map((axis) => `<path d="M${compact(axis.from.x)} ${compact(axis.from.y)}L${compact(axis.to.x)} ${compact(axis.to.y)}" fill="none"/><text x="${compact(axis.to.x + 7)}" y="${compact(axis.to.y - 7)}" stroke="none">${axis.label}</text>`).join('')
        : '';
    const background = settings.transparentExport
        ? ''
        : `<rect width="${width}" height="${height}" fill="${escapeXml(settings.backgroundColor)}"/>`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
        + background
        + (axes ? `<g fill="#d2d2d2" fill-opacity=".72" stroke="#d2d2d2" stroke-opacity=".38" font-family="sans-serif" font-size="12">${axes}</g>` : '')
        + `<path d="${path.join('')}" fill="${escapeXml(settings.pixelColor)}"/>`
        + `</svg>`;
}
