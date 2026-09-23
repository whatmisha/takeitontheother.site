export const TOOL_ID = 'ribbon-field';
export const DOCUMENT_VERSION = 1;

export const defaults = Object.freeze({
    width: 960,
    height: 640,
    ribbons: 14,
    amplitude: 64,
    frequency: 2.5,
    thickness: 10,
    phase: 0,
    mirrored: false,
    showGuides: false,
    color: '#4f46e5',
    background: '#f7f7f2',
    seed: 73129
});

export function normalizeDocument(input) {
    if (input?.toolId && input.toolId !== TOOL_ID) throw new Error(`Document belongs to a different tool: ${input.toolId}.`);
    if (input?.schemaVersion != null && input.schemaVersion !== DOCUMENT_VERSION) throw new Error(`Unsupported document version: ${input.schemaVersion}.`);
    const candidate = input?.settings ?? input;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Settings must be a JSON object.');
    const next = { ...defaults };
    for (const key of ['width', 'height', 'ribbons', 'amplitude', 'frequency', 'thickness', 'phase', 'seed']) {
        const value = Number(candidate[key]);
        if (!Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
        next[key] = value;
    }
    next.ribbons = Math.round(next.ribbons);
    next.seed = Math.round(next.seed) >>> 0;
    if (next.width < 100 || next.width > 4000 || next.height < 100 || next.height > 4000) throw new Error('Document dimensions must be between 100 and 4000.');
    if (next.ribbons < 2 || next.ribbons > 40) throw new Error('Ribbon count must be between 2 and 40.');
    if (next.amplitude < 0 || next.amplitude > 240 || next.frequency < 0.25 || next.frequency > 8) throw new Error('Wave geometry is outside its accepted range.');
    if (next.thickness < 1 || next.thickness > 48 || next.phase < 0 || next.phase > 360) throw new Error('Stroke geometry is outside its accepted range.');
    for (const key of ['color', 'background']) {
        if (!/^#[0-9a-f]{6}$/iu.test(String(candidate[key]))) throw new Error(`${key} must be a six-digit hex color.`);
        next[key] = String(candidate[key]).toLowerCase();
    }
    next.mirrored = Boolean(candidate.mirrored);
    next.showGuides = Boolean(candidate.showGuides);
    return next;
}
