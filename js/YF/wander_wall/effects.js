export const effectDefaults = {
    backgroundMode: 'gradient', backgroundAngle: 0,
    backgroundStart: '#D0D2E4', backgroundMidLow: '#9AA0DC', backgroundMidHigh: '#2348B4', backgroundEnd: '#0E257F',
    shadowEnabled: false, shadowColor: '#151523', shadowOpacity: 30, shadowBlur: 18, shadowDistance: 14, shadowAngle: 90,
    outlineEnabled: false, outlineColor: '#FFFFFF', outlineWidth: 6
};
export const effectRanges = {
    backgroundAngle: [0, 360], shadowOpacity: [0, 100], shadowBlur: [0, 80],
    shadowDistance: [0, 80], shadowAngle: [0, 360], outlineWidth: [0, 24]
};
export const effectColors = ['backgroundStart', 'backgroundMidLow', 'backgroundMidHigh', 'backgroundEnd', 'shadowColor', 'outlineColor'];

export function normalizeEffects(input) {
    const result = { ...effectDefaults, backgroundMode: input.backgroundMode === 'solid' ? 'solid' : 'gradient',
        shadowEnabled: input.shadowEnabled === true, outlineEnabled: input.outlineEnabled === true };
    for (const [key, [min, max]] of Object.entries(effectRanges)) {
        const value = Number(input[key]);
        if (Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value));
    }
    for (const key of effectColors) if (/^#[0-9a-f]{6}$/i.test(input[key])) result[key] = input[key];
    return result;
}

export function gradientLine(width, height, angle) {
    const radians = angle * Math.PI / 180, dx = Math.sin(radians), dy = -Math.cos(radians);
    const length = Math.abs(width * dx) + Math.abs(height * dy);
    return [width / 2 - dx * length / 2, height / 2 - dy * length / 2, width / 2 + dx * length / 2, height / 2 + dy * length / 2];
}
