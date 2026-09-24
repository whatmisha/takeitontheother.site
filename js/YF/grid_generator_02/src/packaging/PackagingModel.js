export const CONSTRUCTION_TYPES = Object.freeze(['lid', 'box', 'tuck-box']);
export const ALL_PANEL_IDS = Object.freeze(['front', 'left', 'right', 'top', 'bottom', 'base', 'flap']);
export const PANEL_NAMES = Object.freeze({ front: 'Lid', left: 'Left', right: 'Right', top: 'Rear', bottom: 'Front wall', base: 'Base', flap: 'Flap' });
export const CONSTRUCTION_NAMES = Object.freeze({ lid: '5-panel lid', box: '6-panel box', 'tuck-box': '7-panel tuck box' });

export function constructionType(settings = {}) {
    return CONSTRUCTION_TYPES.includes(settings.constructionType) ? settings.constructionType : 'lid';
}
export function panelNames(settings = {}) {
    return { ...PANEL_NAMES, ...(constructionType(settings) === 'lid' ? { top: 'Top', bottom: 'Bottom' } : {}) };
}
export function activePanelIds(settings = {}) {
    const type = constructionType(settings);
    return ALL_PANEL_IDS.slice(0, type === 'lid' ? 5 : type === 'box' ? 6 : 7);
}
export function effectiveFlapDepth(settings = {}) {
    const requested = Number(settings.flapDepth ?? 20);
    return Math.max(0, Math.min(Number.isFinite(requested) && requested > 0 ? requested : 20, settings.thickness));
}

/** One millimeter net shared by editing, hit testing, export and texture UVs. */
export function packagingNet(settings) {
    const { frontWidth: w, frontHeight: h, thickness: d, x = 0, y = 0 } = settings;
    const type = constructionType(settings), f = effectiveFlapDepth(settings);
    const rect = (dx, dy, width, height) => ({ x: x + dx, y: y + dy, width, height });
    const panels = type === 'lid' ? {
        front: rect(d, d, w, h), left: rect(0, d, d, h), right: rect(d + w, d, d, h),
        top: rect(d, 0, w, d), bottom: rect(d, d + h, w, d),
        base: rect(d, d, w, h), flap: rect(d, d, w, f)
    } : {
        base: rect(d, d, w, h), top: rect(d, d + h, w, d), front: rect(d, h + 2 * d, w, h),
        left: rect(0, d, d, h), right: rect(d + w, d, d, h), bottom: rect(d, 0, w, d),
        flap: rect(d, 2 * h + 2 * d, w, f)
    };
    return { type, panels, width: w + 2 * d, height: type === 'lid' ? h + 2 * d : 2 * h + 2 * d + (type === 'tuck-box' ? f : 0) };
}

/** A tree of panels and hinges. Hidden faces keep their joints for descendants. */
export function createPackagingModel(settings) {
    const { frontWidth: w, frontHeight: h, thickness: d } = settings;
    if (![w, h, d].every(value => Number.isFinite(value) && value > 0)) throw new Error('Packaging needs positive width, height and depth.');
    const net = packagingNet(settings), type = net.type, f = effectiveFlapDepth(settings);
    const panel = (id, parent, width, height, hinge, offset, axis, sign) => ({
        id, parent, width, height, hinge, offset, axis, sign, rect: net.panels[id],
        atlasWidth: net.width, atlasHeight: net.height
    });
    const front = panel('front', null, w, h, [0, 0, 0], [0, 0, 0], 'x', 0);
    const top = panel('top', 'front', w, d, [0, h / 2, 0], [0, d / 2, 0], 'x', -1);
    let panels;
    if (type === 'lid') {
        panels = [front,
            panel('left', 'front', d, h, [-w / 2, 0, 0], [-d / 2, 0, 0], 'y', -1),
            panel('right', 'front', d, h, [w / 2, 0, 0], [d / 2, 0, 0], 'y', 1), top,
            panel('bottom', 'front', w, d, [0, -h / 2, 0], [0, -d / 2, 0], 'x', 1)];
    } else {
        panels = [front, top,
            panel('base', 'top', w, h, [0, d, 0], [0, h / 2, 0], 'x', -1),
            panel('left', 'base', d, h, [-w / 2, h / 2, 0], [-d / 2, 0, 0], 'y', -1),
            panel('right', 'base', d, h, [w / 2, h / 2, 0], [d / 2, 0, 0], 'y', 1),
            panel('bottom', 'base', w, d, [0, h, 0], [0, d / 2, 0], 'x', -1)];
        if (type === 'tuck-box') panels.push(panel('flap', 'front', w, f, [0, -h / 2, 0], [0, -f / 2, 0], 'x', 1));
    }
    return { type, panels, net };
}
