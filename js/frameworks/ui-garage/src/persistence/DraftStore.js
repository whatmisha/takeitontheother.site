function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed.')), { once: true });
    });
}

function transactionComplete(transaction) {
    return new Promise((resolve, reject) => {
        transaction.addEventListener('complete', resolve, { once: true });
        transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB transaction aborted.')), { once: true });
        transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB transaction failed.')), { once: true });
    });
}

/** Namespaced, optional IndexedDB storage for application-owned recovery drafts. */
export class DraftStore {
    constructor({ namespace, version = 1, indexedDB = globalThis.indexedDB, clock = () => Date.now() } = {}) {
        if (!String(namespace || '').trim()) throw new Error('DraftStore requires a non-empty namespace.');
        if (!Number.isInteger(version) || version < 1) throw new Error('DraftStore version must be a positive integer.');
        this.namespace = String(namespace).trim();
        this.version = version;
        this.factory = indexedDB;
        this.clock = clock;
        this.databaseName = `ui-garage:${this.namespace}:drafts:v${this.version}`;
        this.database = null;
        this.openPromise = null;
        this.destroyed = false;
    }

    get available() { return Boolean(this.factory) && !this.destroyed; }

    async open() {
        if (!this.available) return null;
        if (this.database) return this.database;
        if (this.openPromise) return this.openPromise;
        const request = this.factory.open(this.databaseName, 1);
        request.addEventListener('upgradeneeded', () => {
            if (!request.result.objectStoreNames.contains('drafts')) request.result.createObjectStore('drafts', { keyPath: 'key' });
        }, { once: true });
        this.openPromise = requestResult(request).then(database => {
            if (this.destroyed) { database.close(); return null; }
            database.addEventListener('versionchange', () => { database.close(); this.database = null; });
            this.database = database;
            return database;
        }).finally(() => { this.openPromise = null; });
        return this.openPromise;
    }

    async save(value, key = 'active') {
        const database = await this.open();
        if (!database) return false;
        const transaction = database.transaction('drafts', 'readwrite');
        const completion = transactionComplete(transaction);
        transaction.objectStore('drafts').put({ key: String(key), value: structuredClone(value), updatedAt: this.clock() });
        await completion;
        return true;
    }

    async load(key = 'active') {
        const database = await this.open();
        if (!database) return null;
        const transaction = database.transaction('drafts', 'readonly');
        const completion = transactionComplete(transaction);
        const record = await requestResult(transaction.objectStore('drafts').get(String(key)));
        await completion;
        return record ? structuredClone(record) : null;
    }

    async remove(key = 'active') {
        const database = await this.open();
        if (!database) return false;
        const transaction = database.transaction('drafts', 'readwrite');
        const completion = transactionComplete(transaction);
        transaction.objectStore('drafts').delete(String(key));
        await completion;
        return true;
    }

    async clear() {
        const database = await this.open();
        if (!database) return false;
        const transaction = database.transaction('drafts', 'readwrite');
        const completion = transactionComplete(transaction);
        transaction.objectStore('drafts').clear();
        await completion;
        return true;
    }

    destroy() {
        this.destroyed = true;
        this.database?.close();
        this.database = null;
    }
}
