export const TOOL_ID = 'ui-garage-svg-full';
export const DOCUMENT_VERSION = 1;
export const defaults = Object.freeze({
    width: 800,
    height: 800,
    columns: 8,
    rows: 8,
    scale: 0.72,
    rotation: 0,
    square: false,
    showGuides: false,
    color: '#ff5c35',
    background: '#f5f5f2',
    seed: 50421
});

export function normalizeDocument(input) {
    if (input?.toolId && input.toolId !== TOOL_ID) throw new Error(`Document belongs to a different tool: ${input.toolId}.`);
    if (input?.schemaVersion != null && input.schemaVersion !== DOCUMENT_VERSION) throw new Error(`Unsupported document version: ${input.schemaVersion}.`);
    const candidate = input?.settings ?? input;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Settings must be a JSON object.');
    const next = { ...defaults };
    for (const key of ['width', 'height', 'columns', 'rows', 'scale', 'rotation', 'seed']) {
        const value = Number(candidate[key]);
        if (!Number.isFinite(value)) throw new Error(`${key} must be a finite number.`);
        next[key] = value;
    }
    next.columns = Math.round(next.columns);
    next.rows = Math.round(next.rows);
    next.seed = Math.round(next.seed) >>> 0;
    if (next.width < 100 || next.width > 4000 || next.height < 100 || next.height > 4000) throw new Error('Document dimensions must be between 100 and 4000.');
    if (next.columns < 2 || next.columns > 24 || next.rows < 2 || next.rows > 24) throw new Error('Rows and columns must be between 2 and 24.');
    if (next.scale < 0.1 || next.scale > 1 || next.rotation < 0 || next.rotation > 360) throw new Error('Scale or rotation is outside its accepted range.');
    for (const key of ['color', 'background']) {
        if (!/^#[0-9a-f]{6}$/iu.test(String(candidate[key]))) throw new Error(`${key} must be a six-digit hex color.`);
        next[key] = String(candidate[key]).toLowerCase();
    }
    next.square = Boolean(candidate.square);
    next.showGuides = Boolean(candidate.showGuides);
    return next;
}
