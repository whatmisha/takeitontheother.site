// Keep large ending sources once, outside localStorage's small shared quota.
// References exist only in browser storage; snapshots and exported JSON stay complete.
export class EndingAssetStorage {
    constructor(db, sources) { this.db = db; this.sources = sources; this.ids = new Map([...sources].map(([id, data]) => [data, id])); }
    static async open(name = 'upgrade:erik:ending-assets:v1') {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            request.onupgradeneeded = () => request.result.createObjectStore('sources');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('Close other Erik tabs and reload to open ending storage.'));
        });
        db.onversionchange = () => db.close();
        const sources = await new Promise((resolve, reject) => {
            const transaction = db.transaction('sources'), values = new Map();
            const request = transaction.objectStore('sources').openCursor();
            request.onsuccess = () => { const cursor = request.result; if (cursor) { values.set(cursor.key, cursor.value); cursor.continue(); } };
            transaction.oncomplete = () => resolve(values);
            transaction.onabort = () => reject(transaction.error);
        });
        return new EndingAssetStorage(db, sources);
    }
    async prepare(asset) {
        if (!asset || typeof asset.data !== 'string' || asset.data.length < 65536 || this.ids.has(asset.data)) return;
        const data = asset.data;
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
        const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction('sources', 'readwrite');
            transaction.objectStore('sources').put(data, id);
            transaction.oncomplete = resolve;
            transaction.onabort = () => reject(transaction.error || new Error('Ending file could not be saved.'));
        });
        this.sources.set(id, data); this.ids.set(data, id);
    }
    pack(doc) {
        const asset = doc?.settings?.endingAsset, assetId = asset && this.ids.get(asset.data);
        if (!assetId) return doc;
        return { ...doc, settings: { ...doc.settings, endingAsset: { kind: asset.kind, name: asset.name, assetId } } };
    }
    unpack(doc) {
        const asset = doc?.settings?.endingAsset;
        if (!asset?.assetId) return doc;
        const data = this.sources.get(asset.assetId);
        if (typeof data !== 'string') throw new Error('A saved ending file is missing. Import its original preset JSON to recover it.');
        return { ...doc, settings: { ...doc.settings, endingAsset: { kind: asset.kind, name: asset.name, data } } };
    }
    async attach(store) {
        const load = store.loadAll.bind(store), save = store.saveAll.bind(store);
        const entries = Object.values(load());
        for (const doc of entries) await this.prepare(this.unpack(doc)?.settings?.endingAsset);
        store.loadAll = () => Object.fromEntries(Object.entries(load()).map(([name, doc]) => [name, this.unpack(doc)]));
        store.saveAll = map => save(Object.fromEntries(Object.entries(map).map(([name, doc]) => [name, this.pack(doc)])));
        // Rewrite inline legacy assets only after their IndexedDB transaction committed.
        if (entries.some(doc => this.ids.has(doc?.settings?.endingAsset?.data)) && !store.saveAll(store.loadAll())) throw new Error('Presets could not be saved. The original library is intact.');
    }
    close() { this.db.close(); }
}
