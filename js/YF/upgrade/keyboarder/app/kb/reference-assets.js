const WORK_2_L = {
    label: 'Work 2.0 L',
    layout: 'reference/keyboards/Work_2_L.layout.json',
    legends: 'reference/keyboards/Work_2_L.legends.json',
    visual: {
        url: 'reference/keyboards/Work_2_L_curv.svg',
        viewBox: { x: 0, y: 0, w: 1138.9521, h: 294.9419 },
        box: { x: 11.7309, y: 20.2271, w: 1139.0827, h: 294.9414 }
    }
};

export const REFERENCE_ASSETS = {
    LCAKB23: WORK_2_L,
    Work_2_L: WORK_2_L,
    Perform_L: {
        label: 'Perform L',
        layout: 'reference/keyboards/Perform_L.layout.json',
        visual: {
            url: 'reference/keyboards/Perform_L_curv.svg',
            viewBox: { x: 0, y: 0, w: 1180.2872, h: 296.3719 },
            box: { x: 31.0691, y: 34.7423, w: 1182.8992, h: 307.9266 }
        }
    },
    Perform_S: {
        label: 'Perform S',
        layout: 'reference/keyboards/Perform_S.layout.json',
        visual: {
            url: 'reference/keyboards/Perform_S_curv.svg',
            viewBox: { x: 0, y: 0, w: 831.7358, h: 286.0123 },
            box: { x: 32.5907, y: 39.9601, w: 834.6756, h: 294.2229 }
        }
    },
    Work_1_L_Pad: {
        label: 'Work 1.0 L Pad',
        layout: 'reference/keyboards/Work_1_L_Pad.layout.json',
        visual: {
            url: 'reference/keyboards/Work_1_L_Pad_curv.svg',
            viewBox: { x: 0, y: 0, w: 1172.1797, h: 288.1066 },
            box: { x: 34.0547, y: 78.1516, w: 1172.1956, h: 287.8980 }
        }
    },
    Airis_14: {
        label: 'Airis 14',
        layout: 'reference/laptops/Airis_14.layout.json',
        visual: {
            url: 'reference/laptops/Airis_14_curv.svg',
            viewBox: { x: 0, y: 0, w: 772.2281, h: 279.7324 },
            box: { x: 14.2723, y: 12.4582, w: 771.9773, h: 287.2657 }
        }
    },
    Ground_14: {
        label: 'Ground 14',
        layout: 'reference/laptops/Ground_14.layout.json',
        visual: {
            url: 'reference/laptops/Ground_14_curv.svg',
            viewBox: { x: 0, y: 0, w: 801.0403, h: 280.6765 },
            box: { x: 13.7915, y: 13.9479, w: 802.6656, h: 284.1912 }
        }
    },
    Ground_15: {
        label: 'Ground 15',
        layout: 'reference/laptops/Ground_15.layout.json',
        visual: {
            url: 'reference/laptops/Ground_15_curv.svg',
            viewBox: { x: 0, y: 0, w: 916.9761, h: 284.0337 },
            box: { x: 13.9231, y: 13.2153, w: 917.1047, h: 288.4192 }
        }
    }
};

function layoutNameOf(layoutOrName) {
    return typeof layoutOrName === 'string'
        ? layoutOrName
        : layoutOrName?.meta?.name || '';
}

export function referenceAssetsForLayout(layoutOrName) {
    return REFERENCE_ASSETS[layoutNameOf(layoutOrName)] || null;
}

export function hasReferenceAssets(layoutOrName, kind = 'any') {
    const assets = referenceAssetsForLayout(layoutOrName);
    if (!assets) return false;
    if (kind === 'layout') return !!assets.layout;
    if (kind === 'visual') return !!assets.visual?.url;
    if (kind === 'legends') return !!assets.legends;
    return !!(assets.layout || assets.visual?.url || assets.legends);
}
