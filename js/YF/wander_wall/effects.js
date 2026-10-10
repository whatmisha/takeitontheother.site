export const shadowDefaults = { shadowEnabled: true, shadowColor: '#000000', shadowOpacity: 50, shadowBlur: 80, shadowDistance: 20, shadowAngle: 90 };
export const effectDefaults = {
    backgroundMode: 'gradient', backgroundAngle: 0,
    backgroundStart: '#D0D2E4',
    backgroundStops: [{ color: '#D0D2E4', offset: 0 }, { color: '#9AA0DC', offset: .302885 }, { color: '#2348B4', offset: .649038 }, { color: '#0E257F', offset: 1 }],
    ...shadowDefaults
};
export const effectRanges = {
    backgroundAngle: [0, 360], shadowOpacity: [0, 100], shadowBlur: [0, 80],
    shadowDistance: [0, 80], shadowAngle: [0, 360]
};
const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function normalizeGradientStops(input = {}) {
    const legacy = ['backgroundMidLow', 'backgroundMidHigh', 'backgroundEnd'].some(key => validColor(input[key]));
    const stops = !legacy && Array.isArray(input.backgroundStops) ? input.backgroundStops.filter(stop => validColor(stop?.color)).slice(0, 8)
        .map((stop, i, list) => ({ color: stop.color, offset: Number.isFinite(stop.offset) ? Math.max(0, Math.min(1, stop.offset)) : i / Math.max(1, list.length - 1) })) : [];
    if (stops.length < 2) return ['backgroundStart', 'backgroundMidLow', 'backgroundMidHigh', 'backgroundEnd'].map((key, i) => ({
        color: validColor(input[key]) ? input[key] : effectDefaults.backgroundStops[i].color, offset: effectDefaults.backgroundStops[i].offset
    }));
    stops.sort((a, b) => a.offset - b.offset); stops[0].offset = 0; stops.at(-1).offset = 1;
    return stops;
}

export function addGradientStop(stops) {
    if (stops.length >= 8) return stops;
    let index = 0;
    for (let i = 1; i < stops.length - 1; i++) if (stops[i + 1].offset - stops[i].offset > stops[index + 1].offset - stops[index].offset) index = i;
    const a = stops[index], b = stops[index + 1];
    const color = '#' + [1, 3, 5].map(start => Math.round((parseInt(a.color.slice(start, start + 2), 16) + parseInt(b.color.slice(start, start + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');
    return [...stops.slice(0, index + 1), { color, offset: (a.offset + b.offset) / 2 }, ...stops.slice(index + 1)];
}

export function removeGradientStop(stops, index) {
    if (stops.length <= 2 || !Number.isInteger(index) || index < 0 || index >= stops.length) return stops;
    return normalizeGradientStops({ backgroundStops: stops.filter((_, i) => i !== index) });
}

export function normalizeEffects(input) {
    const result = { ...effectDefaults, backgroundMode: input.backgroundMode === 'solid' ? 'solid' : 'gradient',
        shadowEnabled: input.shadowEnabled !== false, backgroundStops: normalizeGradientStops(input) };
    for (const [key, [min, max]] of Object.entries(effectRanges)) {
        const value = Number(input[key]);
        if (Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value));
    }
    for (const key of ['backgroundStart', 'shadowColor']) if (validColor(input[key])) result[key] = input[key];
    return result;
}

export function gradientLine(width, height, angle) {
    const radians = angle * Math.PI / 180, dx = Math.sin(radians), dy = -Math.cos(radians);
    const length = Math.abs(width * dx) + Math.abs(height * dy);
    return [width / 2 - dx * length / 2, height / 2 - dy * length / 2, width / 2 + dx * length / 2, height / 2 + dy * length / 2];
}
