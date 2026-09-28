export const TUBE_DEFAULTS = Object.freeze({
    tubeDiameter: 100, tubeBodyHeight: 180, tubeCapHeight: 60,
    tubeOverlap: 30, tubeWall: 1, tubeClearance: 0.2
});
export const TUBE_FIELDS = Object.freeze(Object.keys(TUBE_DEFAULTS));
export const isTube = settings => ['tube', 'telescopic-tube'].includes(settings?.constructionType);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** All lengths are millimeters, or uniformly scaled millimeters in a canvas layout. */
export function tubeParameters(settings = {}) {
    const scale = settings.netScale ?? 1;
    const read = key => Number.isFinite(settings[key]) ? settings[key] : TUBE_DEFAULTS[key] * scale;
    const diameter = clamp(read('tubeDiameter'), 10 * scale, 500 * scale);
    const bodyHeight = clamp(read('tubeBodyHeight'), 10 * scale, 1000 * scale);
    const capHeight = clamp(read('tubeCapHeight'), 5 * scale, 1000 * scale);
    const wall = clamp(read('tubeWall'), 0.1 * scale, Math.min(10 * scale, diameter / 4, bodyHeight / 4, capHeight / 4));
    const clearance = clamp(read('tubeClearance'), 0, 3 * scale);
    const maxOverlap = Math.min(bodyHeight, capHeight) - wall;
    const overlap = clamp(read('tubeOverlap'), 0, maxOverlap);
    const capDiameter = diameter + 2 * (wall + clearance);
    return { diameter, bodyHeight, capHeight, wall, clearance, overlap, maxOverlap, capDiameter,
        bodyWidth: Math.PI * diameter, capWidth: Math.PI * capDiameter,
        assembledHeight: settings.constructionType === 'telescopic-tube' ? bodyHeight + capHeight - overlap : bodyHeight };
}

export function normalizedTubeFields(settings) {
    const p = tubeParameters(settings);
    return { tubeDiameter: p.diameter, tubeBodyHeight: p.bodyHeight, tubeCapHeight: p.capHeight,
        tubeOverlap: p.overlap, tubeWall: p.wall, tubeClearance: p.clearance };
}

/** Keep rectangular-grid dimensions derived from the curved body, never independently editable. */
export function normalizeConstructionSettings(settings) {
    const next = { ...settings, ...normalizedTubeFields(settings) };
    if (isTube(next)) {
        const p = tubeParameters(next);
        next.frontWidth = p.bodyWidth;
        next.frontHeight = p.bodyHeight;
    }
    return next;
}

export function constructionPatch(settings, patch) {
    const next = { ...settings, ...patch };
    if (!isTube(settings) && isTube(next)) {
        next.boxDimensions = { frontWidth: settings.frontWidth, frontHeight: settings.frontHeight, thickness: settings.thickness };
    } else if (isTube(settings) && !isTube(next) && settings.boxDimensions) {
        Object.assign(next, settings.boxDimensions);
    }
    return normalizeConstructionSettings(next);
}

export function scaledPackagingSettings(settings, scale) {
    const lengths = ['frontWidth', 'frontHeight', 'thickness', 'flapDepth', ...TUBE_FIELDS];
    return { ...settings, ...Object.fromEntries(lengths.filter(key => Number.isFinite(settings[key])).map(key => [key, settings[key] * scale])), netScale: scale };
}

export function tubeNet(settings) {
    const p = tubeParameters(settings), paired = settings.constructionType === 'telescopic-tube';
    const x = settings.x ?? 0, y = settings.y ?? 0, gap = 10 * (settings.netScale ?? 1);
    const width = paired ? p.capWidth : p.bodyWidth;
    return { type: settings.constructionType, width, height: p.bodyHeight + (paired ? p.capHeight + gap : 0), panels: {
        front: { x: x + (width - p.bodyWidth) / 2, y: y + (paired ? p.capHeight + gap : 0), width: p.bodyWidth, height: p.bodyHeight },
        tubeCap: { x, y, width: p.capWidth, height: p.capHeight }
    } };
}

export function createTubeModel(settings) {
    const net = tubeNet(settings), parameters = tubeParameters(settings);
    const ids = settings.constructionType === 'telescopic-tube' ? ['front', 'tubeCap'] : ['front'];
    return { type: net.type, net, parameters, panels: ids.map(id => ({
        id, shape: 'cylinder', parent: null,
        radius: (id === 'front' ? parameters.diameter : parameters.capDiameter) / 2,
        width: net.panels[id].width, height: net.panels[id].height,
        rect: net.panels[id], atlasWidth: net.width, atlasHeight: net.height
    })) };
}

export function constructionDimensionsLabel(settings) {
    if (!isTube(settings)) return `${Math.round(settings.frontWidth)}\u2009×\u2009${Math.round(settings.frontHeight)}\u2009×\u2009${Math.round(settings.thickness)} mm`;
    const p = tubeParameters(settings);
    return `Ø ${Number(p.diameter.toFixed(1))} × ${Number(p.assembledHeight.toFixed(1))} mm`;
}
