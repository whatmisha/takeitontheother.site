export const CASCADE_LAYOUTS = Object.freeze(['linear', 'radial', 'fan']);
export const CASCADE_PATTERNS = Object.freeze(['stripes', 'sierpinski']);
export const CASCADE_PHASE_MODES = Object.freeze(['right', 'left', 'alternate', 'center', 'random']);
export const CASCADE_POWERS = Object.freeze([1, 2, 4, 8, 16, 32, 64, 128, 256]);
const CANDIDATE_POWERS = CASCADE_POWERS.filter((value) => value >= 4);

const TAU = Math.PI * 2;
const finiteNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export const CASCADE_DEFAULTS = Object.freeze({
    width: 768,
    height: 1000,
    patternType: 'stripes',
    layoutMode: 'linear',
    candidateCount: 32,
    finalistCount: 1,
    fill: 50,
    sierpinskiScale: 100,
    phaseMode: 'right',
    phaseAmount: 50,
    stageBalance: 0,
    seed: 17,
    radialRotation: 0,
    radialInner: 0,
    radialTwist: 0,
    fanConvergence: 76,
    fanCurve: 1.35,
    fanOffset: 0,
    foregroundColor: '#ffffff',
    backgroundColor: '#000000',
    transparentExport: false,
    animate: false,
    stepDuration: 0.5
});

function nearestPower(value, fallback, choices = CASCADE_POWERS) {
    const number = finiteNumber(value, fallback);
    return choices.reduce((best, candidate) => (
        Math.abs(candidate - number) < Math.abs(best - number) ? candidate : best
    ), choices[0]);
}

export function normalizeCascadeSettings(source = {}) {
    const merged = { ...CASCADE_DEFAULTS, ...source };
    const requestedPattern = merged.patternType === 'triangles' ? 'sierpinski' : merged.patternType;
    const candidateCount = nearestPower(merged.candidateCount, CASCADE_DEFAULTS.candidateCount, CANDIDATE_POWERS);
    const finalistCount = Math.min(
        candidateCount,
        nearestPower(merged.finalistCount, CASCADE_DEFAULTS.finalistCount)
    );
    return {
        ...merged,
        width: Math.round(clamp(finiteNumber(merged.width, CASCADE_DEFAULTS.width), 320, 1920)),
        height: Math.round(clamp(finiteNumber(merged.height, CASCADE_DEFAULTS.height), 320, 1920)),
        patternType: CASCADE_PATTERNS.includes(requestedPattern) ? requestedPattern : CASCADE_DEFAULTS.patternType,
        layoutMode: CASCADE_LAYOUTS.includes(merged.layoutMode) ? merged.layoutMode : CASCADE_DEFAULTS.layoutMode,
        candidateCount,
        finalistCount,
        fill: clamp(finiteNumber(merged.fill, CASCADE_DEFAULTS.fill), 10, 90),
        sierpinskiScale: clamp(finiteNumber(merged.sierpinskiScale, CASCADE_DEFAULTS.sierpinskiScale), 25, 100),
        phaseMode: CASCADE_PHASE_MODES.includes(merged.phaseMode) ? merged.phaseMode : CASCADE_DEFAULTS.phaseMode,
        phaseAmount: clamp(finiteNumber(merged.phaseAmount, CASCADE_DEFAULTS.phaseAmount), 0, 100),
        stageBalance: clamp(finiteNumber(merged.stageBalance, CASCADE_DEFAULTS.stageBalance), -100, 100),
        seed: Math.round(clamp(finiteNumber(merged.seed, CASCADE_DEFAULTS.seed), 0, 9999)),
        radialRotation: clamp(finiteNumber(merged.radialRotation, CASCADE_DEFAULTS.radialRotation), -180, 180),
        radialInner: clamp(finiteNumber(merged.radialInner, CASCADE_DEFAULTS.radialInner), 0, 85),
        radialTwist: clamp(finiteNumber(merged.radialTwist, CASCADE_DEFAULTS.radialTwist), -360, 360),
        fanConvergence: clamp(finiteNumber(merged.fanConvergence, CASCADE_DEFAULTS.fanConvergence), 0, 95),
        fanCurve: clamp(finiteNumber(merged.fanCurve, CASCADE_DEFAULTS.fanCurve), 0.25, 3),
        fanOffset: clamp(finiteNumber(merged.fanOffset, CASCADE_DEFAULTS.fanOffset), -50, 50),
        foregroundColor: typeof merged.foregroundColor === 'string' ? merged.foregroundColor : CASCADE_DEFAULTS.foregroundColor,
        backgroundColor: typeof merged.backgroundColor === 'string' ? merged.backgroundColor : CASCADE_DEFAULTS.backgroundColor,
        transparentExport: Boolean(merged.transparentExport),
        animate: Boolean(merged.animate),
        stepDuration: clamp(finiteNumber(merged.stepDuration, CASCADE_DEFAULTS.stepDuration), 0.1, 2)
    };
}

export function cascadeLevelCount(settings = CASCADE_DEFAULTS) {
    const normalized = normalizeCascadeSettings(settings);
    return Math.round(Math.log2(normalized.candidateCount / normalized.finalistCount)) + 1;
}

export function cascadeStageCount(settings = CASCADE_DEFAULTS) {
    const normalized = normalizeCascadeSettings(settings);
    return cascadeLevelCount(normalized) + (normalized.finalistCount === 1 ? 1 : 0);
}

export function buildStageBands(settings = CASCADE_DEFAULTS, heightOverride) {
    const normalized = normalizeCascadeSettings(settings);
    const height = finiteNumber(heightOverride, normalized.height);
    const levelCount = cascadeLevelCount(normalized);
    const stageCount = cascadeStageCount(normalized);
    const balance = normalized.stageBalance / 100;
    const weights = Array.from({ length: stageCount }, (_, stage) => {
        if (stageCount === 1 || balance === 0) return 1;
        const centered = stage / (stageCount - 1) * 2 - 1;
        return Math.exp(centered * balance * 1.4);
    });
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = 0;
    return weights.map((weight, stage) => {
        const y0 = cursor;
        cursor = stage === stageCount - 1 ? height : cursor + height * weight / weightTotal;
        return {
            stage,
            level: Math.min(stage, levelCount - 1),
            empty: stage >= levelCount,
            y0,
            y1: cursor,
            height: cursor - y0
        };
    });
}

function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
        value |= 0;
        value = (value + 0x6D2B79F5) | 0;
        let result = Math.imul(value ^ (value >>> 15), 1 | value);
        result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export function phaseForLevel(settings, level, widthOverride) {
    const normalized = normalizeCascadeSettings(settings);
    const width = finiteNumber(widthOverride, normalized.width);
    const safeLevel = Math.max(0, Math.round(finiteNumber(level, 0)));
    const targetCount = normalized.candidateCount / (2 ** safeLevel);
    const period = width / targetCount;
    const stripeWidth = period * normalized.fill / 100;

    if (normalized.phaseMode === 'center') {
        return modulo(width / 2 - stripeWidth / 2, period);
    }

    const random = mulberry32(normalized.seed);
    let phase = 0;
    for (let index = 0; index < safeLevel; index += 1) {
        const previousCount = normalized.candidateCount / (2 ** index);
        const previousPeriod = width / previousCount;
        const shift = previousPeriod * normalized.phaseAmount / 100;
        let direction = 1;
        if (normalized.phaseMode === 'left') direction = -1;
        if (normalized.phaseMode === 'alternate') direction = index % 2 === 0 ? 1 : -1;
        if (normalized.phaseMode === 'random') direction = random() < 0.5 ? -1 : 1;
        phase += shift * direction;
    }
    return modulo(phase, period);
}

export function foregroundIntervals(settings, level, widthOverride) {
    const normalized = normalizeCascadeSettings(settings);
    const width = finiteNumber(widthOverride, normalized.width);
    const targetCount = normalized.candidateCount / (2 ** level);
    const period = width / targetCount;
    const stripeWidth = period * normalized.fill / 100;
    const phase = phaseForLevel(normalized, level, width);
    const firstIndex = Math.floor((0 - phase) / period) - 1;
    const lastIndex = Math.ceil((width - phase) / period) + 1;
    const intervals = [];

    for (let index = firstIndex; index <= lastIndex; index += 1) {
        const x0 = phase + index * period;
        const x1 = x0 + stripeWidth;
        const clippedStart = Math.max(0, x0);
        const clippedEnd = Math.min(width, x1);
        if (clippedEnd - clippedStart > 1e-7) intervals.push([clippedStart, clippedEnd]);
    }
    return intervals;
}

function linearPolygon(cell) {
    return [
        { x: cell.x0, y: cell.y0 },
        { x: cell.x1, y: cell.y0 },
        { x: cell.x1, y: cell.y1 },
        { x: cell.x0, y: cell.y1 }
    ];
}

function fanPoint(x, y, settings, width, height) {
    const progress = clamp(y / height, 0, 1);
    const scale = Math.max(0.03, 1 - settings.fanConvergence / 100 * (progress ** settings.fanCurve));
    const offset = settings.fanOffset / 100 * width * progress;
    return {
        x: width / 2 + (x - width / 2) * scale + offset,
        y
    };
}

function fanPolygon(cell, settings, width, height) {
    const sideSteps = 5;
    const points = [fanPoint(cell.x0, cell.y0, settings, width, height)];
    points.push(fanPoint(cell.x1, cell.y0, settings, width, height));
    for (let step = 1; step <= sideSteps; step += 1) {
        const y = cell.y0 + (cell.y1 - cell.y0) * step / sideSteps;
        points.push(fanPoint(cell.x1, y, settings, width, height));
    }
    points.push(fanPoint(cell.x0, cell.y1, settings, width, height));
    for (let step = sideSteps - 1; step > 0; step -= 1) {
        const y = cell.y0 + (cell.y1 - cell.y0) * step / sideSteps;
        points.push(fanPoint(cell.x0, y, settings, width, height));
    }
    return points;
}

function radialPoint(x, y, settings, width, height) {
    const outerRadius = Math.min(width, height) * 0.48;
    const innerRadius = outerRadius * settings.radialInner / 100;
    const progress = clamp(y / height, 0, 1);
    const radius = outerRadius + (innerRadius - outerRadius) * progress;
    const rotation = (settings.radialRotation - 90) * Math.PI / 180;
    const twist = settings.radialTwist * Math.PI / 180 * progress;
    const angle = rotation + x / width * TAU + twist;
    return {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius
    };
}

function radialPolygon(cell, settings, width, height) {
    const arcSteps = Math.max(2, Math.min(16, Math.ceil((cell.x1 - cell.x0) / width * 96)));
    const sideSteps = Math.max(2, Math.min(12, Math.ceil(Math.abs(settings.radialTwist) / 60)));
    const points = [];
    for (let step = 0; step <= arcSteps; step += 1) {
        const x = cell.x0 + (cell.x1 - cell.x0) * step / arcSteps;
        points.push(radialPoint(x, cell.y0, settings, width, height));
    }
    for (let step = 1; step <= sideSteps; step += 1) {
        const y = cell.y0 + (cell.y1 - cell.y0) * step / sideSteps;
        points.push(radialPoint(cell.x1, y, settings, width, height));
    }
    for (let step = arcSteps - 1; step >= 0; step -= 1) {
        const x = cell.x0 + (cell.x1 - cell.x0) * step / arcSteps;
        points.push(radialPoint(x, cell.y1, settings, width, height));
    }
    for (let step = sideSteps - 1; step > 0; step -= 1) {
        const y = cell.y0 + (cell.y1 - cell.y0) * step / sideSteps;
        points.push(radialPoint(cell.x0, y, settings, width, height));
    }
    return points;
}

function mapCell(cell, settings, width, height) {
    if (settings.layoutMode === 'radial') return radialPolygon(cell, settings, width, height);
    if (settings.layoutMode === 'fan') return fanPolygon(cell, settings, width, height);
    return linearPolygon(cell);
}

function midpoint(first, second) {
    return {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2
    };
}

function scaleTriangle(points, percent) {
    if (percent >= 100) return points;
    const scale = percent / 100;
    const center = points.reduce((result, point) => ({
        x: result.x + point.x / points.length,
        y: result.y + point.y / points.length
    }), { x: 0, y: 0 });
    return points.map((point) => ({
        x: center.x + (point.x - center.x) * scale,
        y: center.y + (point.y - center.y) * scale
    }));
}

function subdivideSierpinski(points, depth, output, level, scale) {
    if (depth <= 0) {
        output.push({ level, points: scaleTriangle(points, scale) });
        return;
    }
    const [left, right, apex] = points;
    const top = midpoint(left, right);
    const leftSide = midpoint(left, apex);
    const rightSide = midpoint(right, apex);
    subdivideSierpinski([left, top, leftSide], depth - 1, output, level, scale);
    subdivideSierpinski([top, right, rightSide], depth - 1, output, level, scale);
    subdivideSierpinski([leftSide, rightSide, apex], depth - 1, output, level, scale);
}

function buildSierpinskiPolygons(settings, width, height, bands, generation) {
    const levelCount = cascadeLevelCount(settings);
    if (generation >= levelCount) return [];

    const depth = Math.max(0, levelCount - generation - 1);
    const rootCount = settings.finalistCount;
    const padding = Math.min(width, height) * 0.04;
    const terminalTop = settings.finalistCount === 1 ? bands.at(-1).y0 : height;
    const availableWidth = Math.max(1, width - padding * 2);
    const availableHeight = Math.max(1, terminalTop - padding * 2);
    const totalWidth = Math.min(
        availableWidth,
        availableHeight * 2 / Math.sqrt(3) * rootCount
    );
    const rootWidth = totalWidth / rootCount;
    const rootHeight = rootWidth * Math.sqrt(3) / 2;
    const startX = (width - totalWidth) / 2;
    const topY = padding + (availableHeight - rootHeight) / 2;
    const polygons = [];

    for (let root = 0; root < rootCount; root += 1) {
        const x0 = startX + root * rootWidth;
        const x1 = x0 + rootWidth;
        subdivideSierpinski([
            { x: x0, y: topY },
            { x: x1, y: topY },
            { x: (x0 + x1) / 2, y: topY + rootHeight }
        ], depth, polygons, generation, settings.sierpinskiScale);
    }
    return polygons;
}

export function buildCascadeScene(source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    const width = finiteNumber(options.width, settings.width);
    const height = finiteNumber(options.height, settings.height);
    const bands = buildStageBands(settings, height);
    const generation = options.generation == null
        ? (settings.patternType === 'sierpinski' ? 0 : bands.length - 1)
        : Math.round(clamp(finiteNumber(options.generation, 0), 0, bands.length - 1));
    const polygons = [];
    const segments = [];
    const levelCount = cascadeLevelCount(settings);

    if (settings.patternType === 'sierpinski') {
        return {
            settings,
            width,
            height,
            generation,
            bands,
            segments,
            polygons: buildSierpinskiPolygons(settings, width, height, bands, generation)
        };
    }

    for (const band of bands) {
        const terminalIsActive = band.empty && generation >= band.stage;
        const effectiveLevel = terminalIsActive
            ? null
            : Math.min(band.stage, generation, levelCount - 1);
        const previous = segments[segments.length - 1];
        if (previous?.level === effectiveLevel) previous.y1 = band.y1;
        else segments.push({ y0: band.y0, y1: band.y1, level: effectiveLevel });
    }

    for (const segment of segments) {
        if (segment.level == null) continue;
        for (const [x0, x1] of foregroundIntervals(settings, segment.level, width)) {
            const cell = { x0, x1, y0: segment.y0, y1: segment.y1, level: segment.level };
            polygons.push({ level: segment.level, points: mapCell(cell, settings, width, height) });
        }
    }

    return { settings, width, height, generation, bands, segments, polygons };
}
