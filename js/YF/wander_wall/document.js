import { ASSETS, alternatives } from './assets.js';
import { effectDefaults, normalizeEffects } from './effects.js';
import { anchorGround } from './ground.js';
import { normalizeResolution, resolutionError } from './resolutions.js';
export { FORMATS } from './resolutions.js';

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? clamp(Number(value), min, max) : fallback;
export const cleanText = text => String(text ?? '').toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim().split('').reduce((result, char) => (char === ' ' || result.replace(/ /g, '').length < 32) ? result + char : result, '').trim();
export const lettersOf = text => cleanText(text).replace(/ /g, '');
export const defaults = { text: 'WANDER', format: 'desktop', width: 3840, height: 2160, seed: 20261009, shuffle: false, formsEnabled: true, formCount: 4, groundEnabled: true, groundHeight: 35, fill: 100, rotationRange: 24, overflow: 0, ...effectDefaults, items: [] };
// Catalog-dependent initial layouts are never safe defaults for compact links.
export const shareDefaults = { ...defaults, items: null };

export function normalize(input = {}) {
    const letters = lettersOf(input.text ?? defaults.text);
    const seen = new Set();
    let hasGround = false;
    const items = (Array.isArray(input.items) ? input.items : []).slice(0, 49).flatMap(raw => {
        if (!raw || typeof raw.id !== 'string' || seen.has(raw.id) || !ASSETS[raw.asset]) return [];
        const kind = ['form', 'ground'].includes(raw.kind) ? raw.kind : 'letter';
        const index = Math.round(number(raw.index, 0, 0, 31));
        const letter = kind === 'letter' ? letters[index] : '';
        if (kind === 'letter' && (!letter || !alternatives(letter).includes(raw.asset))) return [];
        if (ASSETS[raw.asset].kind !== kind || (kind === 'ground' && hasGround)) return [];
        if (kind === 'ground') hasGround = true;
        seen.add(raw.id);
        return [{ id: raw.id.slice(0, 60), kind, index, letter, asset: raw.asset,
            x: number(raw.x, .5, -Infinity, Infinity), y: number(raw.y, .5, -Infinity, Infinity),
            scale: number(raw.scale, .4, .025, 3), rotation: number(raw.rotation, 0, -180, 180), pinned: raw.pinned === true, visible: raw.visible !== false }];
    });
    const scene = { text: cleanText(input.text ?? defaults.text), ...normalizeResolution(input),
        seed: number(input.seed, defaults.seed, 0, 4294967295) >>> 0,
        shuffle: input.shuffle === true, formsEnabled: input.formsEnabled !== false,
        formCount: Math.round(number(input.formCount, 4, 0, 16)), fill: number(input.fill, 100, 70, 125),
        groundEnabled: input.groundEnabled === true, groundHeight: number(input.groundHeight, defaults.groundHeight, 10, 60),
        rotationRange: number(input.rotationRange, defaults.rotationRange, 0, 180), overflow: number(input.overflow, defaults.overflow, 0, 50), ...normalizeEffects(input), items };
    scene.items = [...items.filter(item => item.kind === 'ground' && scene.groundEnabled).map(item => anchorGround(item, scene)),
        ...items.filter(item => item.kind !== 'ground')];
    return scene;
}

export function makeDocument(settings) { return { type: 'wander-wall', version: 1, settings: normalize(settings) }; }
export function readDocument(value) {
    if (value?.type !== 'wander-wall' || value.version !== 1 || !value.settings || typeof value.settings !== 'object') throw new Error('Choose a Wander Wall JSON document (version 1).');
    if (!Array.isArray(value.settings.items) || value.settings.items.length > 49) throw new Error('This composition has too many elements.');
    if (value.settings.format === 'custom' && resolutionError(value.settings.width, value.settings.height)) throw new Error(resolutionError(value.settings.width, value.settings.height));
    const normalized = normalize(value.settings);
    if (normalized.items.length !== value.settings.items.length) throw new Error('The document contains an unknown or invalid element.');
    return normalized;
}
