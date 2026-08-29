export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;

export function roundWeight(value) {
    return clamp(Math.round(Number(value) / 100) * 100, 100, 900);
}

export function densityPitchScale(density) {
    const value = clamp(Number(density ?? 0) / 100, -1, 1);
    return value >= 0 ? lerp(1, 0.62, value) : lerp(1, 1.28, -value);
}

export function makeResolutionGrid(width, height, resolution, density = 0) {
    const cols = Math.max(1, Math.round(resolution));
    const rows = Math.max(1, Math.round(cols * height / width));
    const cellW = width / cols;
    const cellH = height / rows;
    const pitchScale = densityPitchScale(density);
    const pitchW = cellW * pitchScale;
    const pitchH = cellH * pitchScale;
    return {
        cols,
        rows,
        cellW,
        cellH,
        pitchW,
        pitchH,
        originX: width / 2 - ((cols - 1) * pitchW) / 2,
        originY: height / 2 - ((rows - 1) * pitchH) / 2
    };
}

export function signedNoise(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453123;
    return (value - Math.floor(value)) * 2 - 1;
}

export function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
