/**
 * PresetStore — localStorage-backed preset CRUD.
 *
 * Stores presets as a flat map { name → blob } under a single storage key. Blobs
 * are opaque to the store (whatever the app's `collectPresetData()` returns) plus
 * bookkeeping timestamps. Seeding from a shipped library is optional and driven
 * by a manifest, so the store stays domain-agnostic.
 */
export class PresetStore {
    /**
     * @param {Object} [options]
     * @param {string} [options.storageKey='upgrade:framework:presets:v1']
     * @param {number} [options.fetchTimeoutMs=5000] — seed request timeout
     */
    constructor({ storageKey = 'upgrade:framework:presets:v1', fetchTimeoutMs = 5000 } = {}) {
        this.storageKey = storageKey;
        this.seedMarkerKey = `${storageKey}__seeded`;
        this.fetchTimeoutMs = Math.max(1, Number(fetchTimeoutMs) || 5000);
    }

    /* --------------------------------- read ---------------------------------- */

    loadAll() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.error('PresetStore.loadAll failed:', e);
            return {};
        }
    }

    load(name) {
        const all = this.loadAll();
        return all[name] || null;
    }

    has(name) {
        return Object.prototype.hasOwnProperty.call(this.loadAll(), name);
    }

    /**
     * Names sorted alphabetically. Names with a `pinnedPrefix` (default '+')
     * are floated to the top in original order.
     */
    getNames({ pinnedPrefix = null } = {}) {
        const names = Object.keys(this.loadAll());
        if (!pinnedPrefix) return names.sort((a, b) => a.localeCompare(b));
        const pinned = names.filter(n => n.startsWith(pinnedPrefix));
        const rest = names.filter(n => !n.startsWith(pinnedPrefix)).sort((a, b) => a.localeCompare(b));
        return [...pinned, ...rest];
    }

    /* --------------------------------- write --------------------------------- */

    saveAll(map) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(map));
            return true;
        } catch (e) {
            console.error('PresetStore.saveAll failed:', e);
            return false;
        }
    }

    /**
     * Create a new preset. Rejects duplicates unless `overwrite` is true.
     * @returns {{ok:boolean, reason?:string}}
     */
    create(name, blob, { overwrite = false } = {}) {
        const clean = String(name || '').trim();
        if (!clean) return { ok: false, reason: 'empty-name' };
        const all = this.loadAll();
        if (all[clean] && !overwrite) return { ok: false, reason: 'exists' };
        const now = Date.now();
        all[clean] = { ...blob, createdAt: all[clean]?.createdAt || now, updatedAt: now };
        return this.saveAll(all) ? { ok: true } : { ok: false, reason: 'storage' };
    }

    /** Update (or create) a preset's blob, preserving createdAt. */
    update(name, blob) {
        const all = this.loadAll();
        const prev = all[name] || {};
        all[name] = { ...blob, createdAt: prev.createdAt || Date.now(), updatedAt: Date.now() };
        return this.saveAll(all);
    }

    rename(oldName, newName) {
        const clean = String(newName || '').trim();
        if (!clean) return { ok: false, reason: 'empty-name' };
        const all = this.loadAll();
        if (!all[oldName]) return { ok: false, reason: 'not-found' };
        if (all[clean] && clean !== oldName) return { ok: false, reason: 'exists' };
        all[clean] = { ...all[oldName], updatedAt: Date.now() };
        if (clean !== oldName) delete all[oldName];
        return this.saveAll(all) ? { ok: true } : { ok: false, reason: 'storage' };
    }

    delete(name) {
        const all = this.loadAll();
        if (!all[name]) return false;
        delete all[name];
        return this.saveAll(all);
    }

    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.seedMarkerKey);
            return true;
        } catch (e) {
            console.error('PresetStore.clearAll failed:', e);
            return false;
        }
    }

    /* --------------------------------- seeding -------------------------------- */

    isSeeded() {
        return localStorage.getItem(this.seedMarkerKey) === '1';
    }

    markSeeded() {
        try { localStorage.setItem(this.seedMarkerKey, '1'); } catch (_) { /* ignore */ }
    }

    /**
     * Load shipped presets once. Reads `${basePath}/manifest.json`
     * ({ presets: [{ name, file }] }) and merges any not already present.
     * @param {Object} [options]
     * @param {string} [options.basePath='presets']
     * @param {boolean} [options.force=false] — reseed even if already seeded
     * @param {(blob:Object)=>Object} [options.transform] — adapt each loaded blob
     * @returns {Promise<number>} number of presets seeded
     */
    async loadSeed({ basePath = 'presets', force = false, transform } = {}) {
        if (this.isSeeded() && !force) return 0;
        let manifest;
        try {
            manifest = await this._fetchJSON(`${basePath}/manifest.json`, 'manifest');
        } catch (e) {
            console.warn('PresetStore.loadSeed: no manifest:', e.message);
            this.markSeeded();
            return 0;
        }
        const entries = Array.isArray(manifest?.presets) ? manifest.presets : [];
        const all = this.loadAll();
        let count = 0;
        for (const entry of entries) {
            const name = entry.name || entry.file?.replace(/\.json$/i, '');
            if (!name || all[name]) continue;
            try {
                let blob = await this._fetchJSON(`${basePath}/${entry.file}`, entry.file);
                if (typeof transform === 'function') blob = transform(blob, entry);
                const now = Date.now();
                all[name] = { ...blob, seeded: true, createdAt: now, updatedAt: now };
                count++;
            } catch (e) {
                console.warn(`PresetStore.loadSeed: failed "${entry.file}":`, e.message);
            }
        }
        this.saveAll(all);
        this.markSeeded();
        return count;
    }

    async _fetchJSON(url, label = url) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timer = null;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => {
                controller?.abort();
                reject(new Error(`${label} timed out after ${this.fetchTimeoutMs} ms`));
            }, this.fetchTimeoutMs);
        });
        try {
            const response = await Promise.race([
                fetch(url, { cache: 'no-cache', signal: controller?.signal }),
                timeout
            ]);
            if (!response.ok) throw new Error(`${label} ${response.status}`);
            return await response.json();
        } finally {
            if (timer) clearTimeout(timer);
        }
    }
}
