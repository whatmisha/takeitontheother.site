export const TOOL_ID = 'grainy_land';
export const VERSION = 1;
export const palettes = {
    pigment: { sky: '#2353DB', terrain: '#FC796E', depth: '#713004', light: '#FFC2EE' },
    ember: { sky: '#2353DB', terrain: '#FF9306', depth: '#D43C00', light: '#FFF0D8' }
};
export const toneCharacters = { pigment: 'Pigment', pearlescent: 'Pearlescent', radiant: 'Radiant' };
export const ranges = {
    scale: [40, 220, 1], complexity: [1, 6, 1], flow: [0, 100, 1],
    horizon: [15, 80, 1], relief: [0, 100, 1], softness: [0, 100, 1],
    glow: [0, 100, 1], halo: [0, 100, 1], contrast: [50, 180, 1],
    grain: [0, 100, 1], grainSize: [0.5, 4, 0.1],
    toneAmount: [0, 100, 1], toneSpread: [0, 100, 1],
    toneScale: [20, 200, 1], toneBleed: [0, 100, 1]
};
export const defaults = {
    schemaVersion: VERSION, width: 1920, height: 1080, seed: 1565559100, mode: 'landscape',
    scale: 100, complexity: 2, flow: 48, horizon: 53, relief: 62,
    softness: 38, glow: 0, halo: 65, contrast: 118, grain: 55, grainSize: 1,
    toneCharacter: 'radiant', toneAmount: 100, toneSpread: 65, toneScale: 110, toneBleed: 50,
    exportScale: 1, ...palettes.ember
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export function normalizeSettings(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid settings.');
    if (value.schemaVersion != null && value.schemaVersion !== VERSION) throw new Error('Unsupported document version.');
    const out = { ...defaults };
    for (const [key, [min, max, step]] of Object.entries(ranges)) {
        const n = Number(value[key]);
        if (Number.isFinite(n) && value[key] != null) out[key] = Number((Math.round(clamp(n, min, max) / step) * step).toFixed(2));
    }
    for (const key of ['sky', 'terrain', 'depth', 'light']) {
        if (/^#[0-9a-f]{6}$/i.test(value[key] ?? '')) out[key] = value[key].toUpperCase();
    }
    for (const key of ['width', 'height']) {
        if (Number.isFinite(Number(value[key])) && value[key] != null) out[key] = Math.round(clamp(Number(value[key]), 256, 4096));
    }
    if (Number.isFinite(Number(value.seed)) && value.seed != null) out.seed = Number(value.seed) >>> 0;
    if (Object.hasOwn(toneCharacters, value.toneCharacter)) out.toneCharacter = value.toneCharacter;
    if (['landscape', 'abstract'].includes(value.mode)) out.mode = value.mode;
    if ([1, 2, 3].includes(Number(value.exportScale))) out.exportScale = Number(value.exportScale);
    return out;
}
export function makeDocument(settings) {
    return { toolId: TOOL_ID, schemaVersion: VERSION, settings: normalizeSettings(settings) };
}
export function readDocument(value) {
    if (value?.toolId !== TOOL_ID || value?.schemaVersion !== VERSION || !value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings)) throw new Error('Choose a Grainy Land v1 JSON file.');
    return normalizeSettings(value.settings);
}
export function exportDimensions(settings) {
    const s = normalizeSettings(settings);
    const width = s.width * s.exportScale, height = s.height * s.exportScale;
    if (Math.max(width, height) > 8192 || width * height > 33554432) {
        throw new Error('Export is too large. Reduce the canvas size or export scale (maximum 8192 px / 32 megapixels).');
    }
    return { width, height };
}

// Backfill only the new fields of shipped presets already in local storage.
// User presets and every explicitly saved value remain intact; this is idempotent.
export const presetTones = {
    Pigment: {toneCharacter:'pigment',toneAmount:60,toneSpread:50,toneScale:100,toneBleed:35},
    Ember: {toneCharacter:'radiant',toneAmount:100,toneSpread:65,toneScale:110,toneBleed:50},
    Drift: {toneCharacter:'pearlescent',toneAmount:75,toneSpread:75,toneScale:90,toneBleed:55},
    'Quiet dunes': {toneCharacter:'pigment',toneAmount:30,toneSpread:30,toneScale:150,toneBleed:20}
};
export function migrateTonePresets(store) {
    const all=store.loadAll();
    if(!all || typeof all!=='object' || Array.isArray(all)) return;
    let changed=false;
    for(const [name,tones] of Object.entries(presetTones)) {
        const blob=all[name];
        if(!blob || blob.seeded!==true) continue;
        for(const [key,value] of Object.entries(tones)) {
            if(Object.hasOwn(blob,key)) continue;
            blob[key]=value;changed=true;
        }
    }
    if(changed) store.saveAll(all);
}

// Refresh the shipped Ember already cached by returning users. Saving a personal
// preset removes the seeded marker, so saved custom presets remain untouched.
export function migratePresets(store) {
    migrateTonePresets(store);
    const all = store.loadAll(), ember = all?.Ember;
    if (!ember || ember.seeded !== true) return;
    if (Object.entries(defaults).every(([key, value]) => ember[key] === value)) return;
    all.Ember = { ...ember, ...defaults };
    store.saveAll(all);
}
