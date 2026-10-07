// Stable color IDs are shared by both layer stacks and survive palette edits.
export const MAX_CUSTOM_COLORS = 16;
export function normalizeCustomColors(value) {
    if (!Array.isArray(value)) return [];
    const ids = new Set();
    return value.slice(0, MAX_CUSTOM_COLORS).flatMap((item, i) => {
        if (!item || typeof item !== 'object' || typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color)) return [];
        let id = typeof item.id === 'string' && /^custom-[a-zA-Z0-9_-]{1,48}$/.test(item.id) ? item.id : 'custom-' + (i + 1);
        if (ids.has(id)) return [];
        ids.add(id);
        return [{id, name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 32) : 'Custom ' + (i + 1), color: item.color.toUpperCase()}];
    });
}
export function groupColor(settings, group) {
    return settings.customColors?.find(color => color.id === group)?.color ?? settings[group] ?? settings.terrain;
}
export function colorIsUsed(settings, id) {
    return ['landscapeLayers', 'abstractLayers'].some(key => settings[key]?.some(layer => layer.group === id));
}
export function addCustomColor(settings) {
    const colors = normalizeCustomColors(settings.customColors);
    if (colors.length >= MAX_CUSTOM_COLORS) throw new Error('Maximum ' + MAX_CUSTOM_COLORS + ' custom colors.');
    let n = 1; while (colors.some(color => color.id === 'custom-' + n)) n++;
    const color = {id: 'custom-' + n, name: 'Custom ' + n, color: '#80C9A1'};
    return {settings: {...settings, customColors: [...colors, color]}, id: color.id};
}
export function removeCustomColor(settings, id) {
    if (colorIsUsed(settings, id)) throw new Error('Assign another color to the layers using this color first.');
    return {...settings, customColors: normalizeCustomColors(settings.customColors).filter(color => color.id !== id)};
}
