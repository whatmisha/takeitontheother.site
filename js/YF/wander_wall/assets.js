export const FORMS = [
    { id: 'pillow', name: 'Pink pillow', src: './graphics/blobs/blob_01.png' },
    { id: 'lime', name: 'Lime fur', src: './graphics/blobs/blob_02.png' },
    { id: 'pearl', name: 'Pearlescent', src: './graphics/blobs/blob_03.png' },
    { id: 'lilac', name: 'Lilac fur', src: './graphics/blobs/blob_04.png' }
];

export function alternatives(letter) {
    return Array.from({ length: 9 }, (_, index) => `${letter}-${Math.floor(index / 3) + 1}-${index % 3 + 1}`);
}

export const ASSETS = Object.fromEntries([
    ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').flatMap(letter => alternatives(letter).map(id => {
        const [, set, variant] = id.split('-');
        return [id, { id, name: letter, src: `./graphics/alphabet/set_0${set}/${letter}_0${variant}.png` }];
    })),
    ...FORMS.map(form => [form.id, form])
]);

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
            image.src = new URL(ASSETS[id].src, import.meta.url).href;
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
