import { MARKING_CATALOG_V1 } from './MarkingCatalogV1.js';

export const MARKINGS_BY_ID = new Map(MARKING_CATALOG_V1.map(entry => [entry.id, entry]));
export const MARKING_SETS = Object.freeze([
    { id: 'standard', name: 'Original set · PAP 21', ids: ['eac-v1', 'manual-v1', 'fragile-v1', 'keep-dry-v1', 'pap21-v1', 'weee-v1'] },
    { id: 'keyboard', name: 'Keyboard set · PAP 20', ids: ['eac-v1', 'manual-v1', 'pap20-v1', 'weee-v1'] },
    { id: 'handling', name: 'Handling', ids: ['fragile-v1', 'keep-dry-v1'] },
    { id: 'individual', name: 'Choose individual signs', ids: [] }
]);

export function markingRecipe(setId = 'standard') {
    const set = MARKING_SETS.find(entry => entry.id === setId) || MARKING_SETS[0];
    return { version: 1, items: set.ids.map(id => ({ id, enabled: true })), direction: 'row', gap: 0.35, align: 'center' };
}

/** Recipes reference frozen team artwork; they contain no imported SVG or file data. */
export function assertMarkingRecipe(recipe) {
    if (!recipe || recipe.version !== 1 || !Array.isArray(recipe.items) || !recipe.items.length || recipe.items.length > MARKING_CATALOG_V1.length) throw new Error('Unsupported marking group.');
    const ids = new Set();
    for (const item of recipe.items) {
        if (!MARKINGS_BY_ID.has(item.id) || ids.has(item.id) || typeof item.enabled !== 'boolean') throw new Error('Unknown or duplicate marking.');
        ids.add(item.id);
    }
    if (!recipe.items.some(item => item.enabled)) throw new Error('Choose at least one marking.');
    if (!['row', 'column'].includes(recipe.direction) || !['start', 'center', 'end'].includes(recipe.align) || !Number.isFinite(recipe.gap) || recipe.gap < 0 || recipe.gap > 3) throw new Error('Invalid marking layout.');
    return recipe;
}

/** Each enabled sign has the same visible height; spacing is a fraction of that height. */
export function buildMarkingGroup(recipe) {
    assertMarkingRecipe(recipe);
    const items = recipe.items.filter(item => item.enabled).map(item => MARKINGS_BY_ID.get(item.id));
    const gap = recipe.gap * 100;
    const widths = items.map(item => 100 * item.width / item.height);
    const column = recipe.direction === 'column';
    const width = column ? Math.max(...widths) : widths.reduce((sum, value) => sum + value, 0) + gap * (items.length - 1);
    const height = column ? 100 * items.length + gap * (items.length - 1) : 100;
    let offset = 0;
    const n = value => Number(value.toFixed(7));
    const parts = items.map((item, index) => {
        const x = column ? (width - widths[index]) * ({ start: 0, center: 0.5, end: 1 }[recipe.align]) : offset;
        const y = column ? offset : 0;
        offset += (column ? 100 : widths[index]) + gap;
        return `<g data-marking-id="${item.id}" transform="translate(${n(x)} ${n(y)}) scale(${n(100 / item.height)})">${item.svgContent}</g>`;
    });
    return { originalWidth: width, originalHeight: height, svgContent: parts.join('') };
}

export function markingName(recipe) {
    return recipe.items.filter(item => item.enabled).map(item => MARKINGS_BY_ID.get(item.id)?.name || '').join(' · ');
}
