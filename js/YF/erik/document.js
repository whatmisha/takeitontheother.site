import { ENDING_DEFAULTS, ENDING_TYPES, normalizeEnding, decodeLottieAsset } from './ending-model.js';
import { DEFAULTS, RANGES, normalize, normalizeCredits, TEXT_LIMIT } from './model.js';
export const DOCUMENT_VERSION = 5;
export const ANIMATION_TYPES = Object.freeze(['crawl']);
const CONTENT_KEYS = new Set(['title', 'body', 'credits', 'contentMode', 'endingType', 'endingText', 'endingAsset']);
export const STYLE_KEYS = Object.freeze(Object.keys(DEFAULTS).filter(key => !CONTENT_KEYS.has(key) && !['width', 'height'].includes(key)));
export function styleOf(settings) { const clean = normalize(settings); return Object.fromEntries(STYLE_KEYS.map(key => [key, clean[key]])); }
export function applyStyle(settings, style) { return normalize({ ...settings, ...Object.fromEntries(STYLE_KEYS.filter(key => Object.hasOwn(style, key)).map(key => [key, style[key]])) }); }
export function presetDocument(settings, name = 'Untitled') {
    return { toolId: 'erik', schemaVersion: DOCUMENT_VERSION, animation: 'crawl', name: presetName(name), settings: normalize(settings) };
}
export function presetName(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) throw new Error('Use a preset name of 1–80 characters.');
    const name = value.trim();
    return name;
}
export function parsePreset(value) {
    const doc = typeof value === 'string' ? JSON.parse(value) : value;
    if (!doc || doc.toolId !== 'erik' || ![1, 2, 3, 4, DOCUMENT_VERSION].includes(doc.schemaVersion) || !ANIMATION_TYPES.includes(doc.animation)) throw new Error('This is not a supported Erik preset.');
    const s = doc.schemaVersion < 4 ? { ...ENDING_DEFAULTS, ...doc.settings } : doc.settings;
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('The preset has no settings.');
    for (const [key, [min, max]] of Object.entries(RANGES)) if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < min || s[key] > max) throw new Error(`Invalid preset setting: ${key}.`);
    for (const [key, limit] of [['title', 200], ['body', TEXT_LIMIT]]) if (typeof s[key] !== 'string' || s[key].length > limit) throw new Error(`Invalid preset text: ${key}.`);
    if (doc.schemaVersion < 3 && (!['text', 'credits'].includes(s.contentMode) || !Array.isArray(s.credits) || s.credits.length > 100 || s.credits.some(row => !row || typeof row.role !== 'string' || typeof row.name !== 'string') || JSON.stringify(s.credits) !== JSON.stringify(normalizeCredits(s.credits)))) throw new Error('Invalid role/name credits.');
    if (doc.schemaVersion >= 3 && ('contentMode' in s || 'credits' in s)) throw new Error('Use inline notation in the preset body.');
    if (!['left', 'center', 'justify', 'justify-all'].includes(s.alignment) || !['left', 'center', 'right'].includes(s.roleAlignment) || !['left', 'center', 'right'].includes(s.nameAlignment)) throw new Error('Invalid text alignment.');
    for (const key of ['textColor', 'backgroundColor']) if (!/^#[a-f\d]{6}$/i.test(s[key])) throw new Error('Invalid preset color.');
    if (s.width !== 1920 || s.height !== 1080) throw new Error('This version supports 1920 × 1080 presets.');
    if (!ENDING_TYPES.includes(s.endingType) || typeof s.endingText !== 'string' || s.endingText.length > 500 || (doc.schemaVersion === 4 ? typeof s.endingFade !== 'boolean' : typeof s.endingFadeIn !== 'boolean' || typeof s.endingFadeOut !== 'boolean')) throw new Error('Invalid ending settings.');
    if (s.endingAsset !== null) {
        const normalized = normalizeEnding(s).endingAsset;
        if (!normalized || ['kind', 'data', 'name'].some(key => s.endingAsset[key] !== normalized[key])) throw new Error('Invalid ending asset.');
    }
    if (s.endingAsset && s.endingAsset.kind !== 'svg') decodeLottieAsset(s.endingAsset);
    return presetDocument(s, doc.name);
}
