export const TOOL_ID = 'ui-garage-canvas-full';
export const DOCUMENT_VERSION = 1;
export const defaults = Object.freeze({
    width: 960,
    height: 640,
    density: 180,
    radius: 14,
    jitter: 0.65,
    opacity: 0.82,
    assetOpacity: 0.45,
    square: false,
    invert: false,
    color: '#ff5c35',
    background: '#131313',
    seed: 90210
});

export function normalizeDocument(input) {
    if (input?.toolId && input.toolId !== TOOL_ID) throw new Error(`Document belongs to a different tool: ${input.toolId}.`);
    if (input?.schemaVersion != null && input.schemaVersion !== DOCUMENT_VERSION) throw new Error(`Unsupported document version: ${input.schemaVersion}.`);
    const candidate = input?.settings ?? input;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Settings must be a JSON object.');
    const next = { ...defaults };
    for (const key of ['width', 'height', 'density', 'radius', 'jitter', 'opacity', 'assetOpacity', 'seed']) {
        const value = Number(candidate[key]);
        if (!Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
        next[key] = value;
    }
    next.width = Math.round(next.width);
    next.height = Math.round(next.height);
    next.density = Math.round(next.density);
    next.seed = Math.round(next.seed) >>> 0;
    if (next.width < 100 || next.width > 4000 || next.height < 100 || next.height > 4000) throw new Error('Document dimensions must be between 100 and 4000.');
    if (next.density < 20 || next.density > 500) throw new Error('Density must be between 20 and 500.');
    if (next.radius < 2 || next.radius > 64) throw new Error('Radius must be between 2 and 64.');
    for (const key of ['jitter', 'opacity', 'assetOpacity']) {
        if (next[key] < 0 || next[key] > 1) throw new Error(`${key} must be between 0 and 1.`);
    }
    for (const key of ['color', 'background']) {
        if (!/^#[0-9a-f]{6}$/iu.test(String(candidate[key]))) throw new Error(`${key} must be a six-digit hex color.`);
        next[key] = String(candidate[key]).toLowerCase();
    }
    next.square = Boolean(candidate.square);
    next.invert = Boolean(candidate.invert);
    return next;
}
