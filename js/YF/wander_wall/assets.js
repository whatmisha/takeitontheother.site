export const FORMS = [];
export const ASSETS = Object.create(null);
const letters = new Map();

export function alternatives(letter) {
    return letters.get(letter) ?? [];
}

export function installCatalog(catalog) {
    if (catalog?.version !== 1 || !Array.isArray(catalog.assets)) throw new Error('Invalid artwork catalog.');
    const metrics = {}, ids = new Set();
    for (const asset of catalog.assets) {
        if (!asset?.id || ids.has(asset.id) || !['letter', 'form'].includes(asset.kind) || !asset.src?.startsWith('./graphics/') ||
            !Array.isArray(asset.metrics?.bounds) || asset.metrics.bounds.length !== 4 || asset.metrics.rows?.length !== 32 ||
            (asset.kind === 'letter' && !/^[A-Z]$/.test(asset.letter))) throw new Error('Invalid artwork catalog entry.');
        ids.add(asset.id);
    }
    for (const id of Object.keys(ASSETS)) delete ASSETS[id];
    FORMS.length = 0; letters.clear();
    for (const asset of catalog.assets) {
        ASSETS[asset.id] = asset; metrics[asset.id] = asset.metrics;
        if (asset.kind === 'form') FORMS.push(asset);
        else { if (!letters.has(asset.letter)) letters.set(asset.letter, []); letters.get(asset.letter).push(asset.id); }
    }
    return metrics;
}

export class AssetStore {
    constructor() { this.entries = new Map(); this.visible = new Set(); }

    retain(items) { this.visible = new Set(items.map(item => item.asset)); }

    get(id) { return this.entries.get(id)?.image; }

    load(id) {
        if (!ASSETS[id]) return Promise.reject(new Error('Unknown artwork: ' + id));
        if (this.entries.has(id)) return this.entries.get(id).promise;
        const entry = {};
        entry.promise = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => { entry.image = image; resolve(image); };
            image.onerror = () => { this.entries.delete(id); reject(new Error('Could not load ' + ASSETS[id].src)); };
            const url = new URL(ASSETS[id].src, import.meta.url);
            url.searchParams.set('v', ASSETS[id].hash);
            image.src = url.href;
        });
        this.entries.set(id, entry);
        return entry.promise;
    }

    async prepare(items) {
        await Promise.all([...new Set(items.map(item => item.asset))].map(id => this.load(id)));
        const used = new Set(items.map(item => item.asset));
        for (const [id, entry] of this.entries) {
            if (this.entries.size <= 64) break;
            if (!used.has(id) && !this.visible.has(id) && entry.image) this.entries.delete(id);
        }
    }
}
