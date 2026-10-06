import { canvasDefaults, normalizeCanvas, assertExportSize } from './canvas-size.js?v=alpha-1';
import { normalizeLayerStack, layerSettingsKey } from './layer-data.js?v=alpha-1';
import { normalizeStrokes } from './paint.js?v=alpha-1';
export const TOOL_ID = 'grainy_land';
export const VERSION = 1;
export const palettes = {
    pigment: { sky: '#2353DB', terrain: '#FC796E', depth: '#FF5900', light: '#FFC2EE' },
    ember: { sky: '#2353DB', terrain: '#FF9306', depth: '#FF5900', light: '#FFF0D8' }
};
export const layouts = {auto:'Auto',basin:'Basin',ridge:'Ridge',valley:'Valley',fold:'Fold'};
export const toneCharacters = { pigment: 'Pigment', pearlescent: 'Pearlescent', radiant: 'Radiant' };
// Array order matches the renderer: three low endpoints, then three high endpoints.
export const toneKeys = ['terrainLow', 'depthLow', 'lightLow', 'terrainHigh', 'depthHigh', 'lightHigh'];
export const automaticTones = Object.fromEntries(toneKeys.map(key => [key, null]));
export const ranges = {
    scale: [40, 220, 1], complexity: [1, 6, 1], flow: [0, 100, 1], folds: [0, 100, 1],
    horizon: [15, 80, 1], relief: [0, 100, 1], softness: [0, 100, 1],
    edgeVariation: [0, 100, 1], glowCoverage: [0, 100, 1], glow: [0, 100, 1], halo: [0, 100, 1], contrast: [50, 180, 1],
    grain: [0, 100, 1], grainSize: [0.5, 4, 0.1],
    toneAmount: [0, 100, 1], toneSpread: [0, 100, 1],
    toneScale: [20, 200, 1], toneBleed: [0, 100, 1]
};
export const defaults = {
    schemaVersion: VERSION, width: 1920, height: 1080, seed: 1565559100, mode: 'landscape', layout:'auto',
    scale: 100, complexity: 2, flow: 48, folds: 65, horizon: 53, relief: 62,
    softness: 38, edgeVariation: 70, glowCoverage: 35, glow: 0, halo: 65, contrast: 118, grain: 55, grainSize: 1,
    toneCharacter: 'radiant', toneAmount: 100, toneSpread: 65, toneScale: 110, toneBleed: 50,
    exportScale: 1, transparentBackground: false, ...canvasDefaults, ...palettes.ember, ...automaticTones, landscapeForms: null, abstractForms: null, landscapeLayers: null, abstractLayers: null
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const formNumber = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value)
    ? Math.round(clamp(value, min, max) * 10000) / 10000 : fallback;
export function normalizeForms(value) {
    if (!Array.isArray(value)) return null;
    const forms = Array.from({length:6}, (_, i) => {
        const item = value[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)
            || typeof item.seed !== 'number' || !Number.isFinite(item.seed)) return null;
        const strokes=normalizeStrokes(item.strokes);
        return { ...(strokes.length ? {strokes} : {}), seed:item.seed >>> 0, layout:Object.hasOwn(layouts,item.layout) ? item.layout : 'auto',
            x:formNumber(item.x,0,-1,1), y:formNumber(item.y,0,-1,1),
            scaleX:formNumber(item.scaleX,1,.25,3), scaleY:formNumber(item.scaleY,1,.25,3),
            locked:item.locked === true };
    });
    return forms.some(Boolean) ? forms : null;
}
export const formSettingsKey = mode => mode === 'abstract' ? 'abstractForms' : 'landscapeForms';
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
    for (const key of toneKeys) {
        if (typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key])) out[key] = value[key].toUpperCase();
    }
    Object.assign(out,normalizeCanvas(value,defaults));
    out.transparentBackground=value.transparentBackground===true;
    if (Number.isFinite(Number(value.seed)) && value.seed != null) out.seed = Number(value.seed) >>> 0;
    if (Object.hasOwn(toneCharacters, value.toneCharacter)) out.toneCharacter = value.toneCharacter;
    if (Object.hasOwn(layouts,value.layout)) out.layout=value.layout;
    if (['landscape', 'abstract'].includes(value.mode)) out.mode = value.mode;
    out.landscapeForms = normalizeForms(value.landscapeForms);
    out.abstractForms = normalizeForms(value.abstractForms);
    out.landscapeLayers = normalizeLayerStack(value.landscapeLayers,out);
    out.abstractLayers = normalizeLayerStack(value.abstractLayers,out);
    // Explicit stacks supersede migrated six-form data.
    if(out.landscapeLayers)out.landscapeForms=null;
    if(out.abstractLayers)out.abstractForms=null;
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
    return assertExportSize(width,height);
}

// Backfill only the new fields of shipped presets already in local storage.
// User presets and every explicitly saved value remain intact; this is idempotent.
export const presetTones = {
    Ember: {toneCharacter:'radiant',toneAmount:100,toneSpread:65,toneScale:110,toneBleed:50},
    Drift: {toneCharacter:'radiant',toneAmount:100,toneSpread:65,toneScale:110,toneBleed:50},
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

// Refresh shipped presets cached by returning users. Saving a personal preset
// removes the seeded marker, so personal colors and imported JSON stay intact.
export function migratePresets(store) {
    migrateTonePresets(store);
    const all=store.loadAll();
    if(!all || typeof all!=='object' || Array.isArray(all)) return;
    let changed=false;
    if(all.Pigment?.seeded===true){delete all.Pigment;changed=true;}
    for(const name of Object.keys(presetTones)) {
        const preset=all[name];
        if(!preset || preset.seeded!==true) continue;
        const updates=name==='Ember' ? defaults : name==='Drift' ? {...defaults,mode:'abstract'} : {depth:'#FF5900'};
        if(Object.entries(updates).every(([key,value])=>preset[key]===value)) continue;
        all[name]={...preset,...updates};changed=true;
    }
    if(changed) store.saveAll(all);
}

// A form retains its source seed and layout while edited. Generate releases only
// unlocked forms; global composition and material controls remain live.
export function formEdit(settings, index) {
    const s = normalizeSettings(settings);
    return s[formSettingsKey(s.mode)]?.[index] || {seed:s.seed, layout:s.layout, x:0, y:0, scaleX:1, scaleY:1, locked:false};
}
export function editForm(settings, index, patch) {
    if (!Number.isInteger(index) || index < 0 || index > 5) throw new RangeError('Invalid form.');
    const s = normalizeSettings(settings), key = formSettingsKey(s.mode);
    const forms = s[key] ? [...s[key]] : Array(6).fill(null);
    forms[index] = patch === null ? null : {...formEdit(s,index), ...patch};
    return {...s, [key]:normalizeForms(forms)};
}
export function regenerate(settings, seed) {
    const s = normalizeSettings({...settings,seed});
    for (const key of ['landscapeForms','abstractForms']) s[key] = normalizeForms(s[key]?.map(form => form?.locked ? form : null));
    for(const mode of ['landscape','abstract']) {
        const key=layerSettingsKey(mode);
        if(s[key])s[key]=s[key].map(layer=>layer.mode==='auto'?{
            ...layer,seed:(s.seed+layer.salt)>>>0,layout:s.layout,x:0,y:0,scaleX:1,scaleY:1,strokes:[]
        }:layer);
    }
    return s;
}
