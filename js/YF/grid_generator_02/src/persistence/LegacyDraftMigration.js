const SOURCE_DATABASE = 'lunnen-grid-generator';
const MARKER = 'yf:pizza:legacy-draft:v1';

// Read an existing database only. The databases() check avoids creating a
// phantom legacy store. A timeout/blocked store never prevents startup.
export async function readLegacyDraft(indexedDBRef) {
    try { indexedDBRef ??= globalThis.indexedDB; } catch { return null; }
    if (!indexedDBRef?.databases) return null;
    let cancelled = false, timer, database;
    const read = async () => {
        const databases = await indexedDBRef.databases();
        if (cancelled || !databases.some(item => item.name === SOURCE_DATABASE)) return null;
        return new Promise(resolve => {
            const request = indexedDBRef.open(SOURCE_DATABASE);
            request.addEventListener('upgradeneeded', () => { request.transaction.abort(); resolve(null); }, { once: true });
            request.addEventListener('blocked', () => resolve(null), { once: true });
            request.addEventListener('error', () => resolve(null), { once: true });
            request.addEventListener('success', () => {
                database = request.result;
                if (cancelled || !database.objectStoreNames.contains('drafts')) { database.close(); resolve(null); return; }
                const query = database.transaction('drafts', 'readonly').objectStore('drafts').get('current');
                query.addEventListener('success', () => { database.close(); resolve(query.result || null); }, { once: true });
                query.addEventListener('error', () => { database.close(); resolve(null); }, { once: true });
            }, { once: true });
        });
    };
    try {
        return await Promise.race([read(), new Promise(resolve => { timer = setTimeout(() => { cancelled = true; database?.close(); resolve(null); }, 1500); })]);
    } catch { return null; }
    finally { cancelled = true; clearTimeout(timer); }
}

export async function importPreviousDraft(store, current, options = {}) {
    try {
        const storage = options.storage ?? globalThis.localStorage;
        const read = options.read || readLegacyDraft;
        if (!storage || storage.getItem(MARKER) === '1') return current;
        if (current) { storage.setItem(MARKER, '1'); return current; }
        const legacy = await read();
        if (legacy?.version !== 1 || !legacy.snapshot?.settings || !legacy.snapshot?.document) return current;
        // The destination check and insert share one readwrite transaction, so
        // an autosave racing the import can never be overwritten by old data.
        const imported = await store.importIfEmpty(legacy);
        if (imported) { storage.setItem(MARKER, '1'); return imported; }
        return current;
    } catch { return current; }
}
