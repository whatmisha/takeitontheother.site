const DATABASE_NAME = 'upgrade-pizza-boxer-v1';
const STORE_NAME = 'drafts';
const CURRENT_DRAFT_ID = 'current';

const requestResult = request => new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
});

const transactionResult = transaction => new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(true), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
});

/** Small, failure-tolerant IndexedDB store for the current unsaved document. */
export class DraftStore {
    constructor({ indexedDBRef = globalThis.indexedDB, databaseName = DATABASE_NAME } = {}) {
        this.indexedDB = indexedDBRef;
        this.databaseName = databaseName;
        this.databasePromise = null;
    }

    async open() {
        if (!this.indexedDB?.open) return null;
        if (this.databasePromise) return this.databasePromise;
        this.databasePromise = new Promise((resolve, reject) => {
            const request = this.indexedDB.open(this.databaseName, 1);
            request.addEventListener('upgradeneeded', () => {
                if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                    request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            });
            request.addEventListener('success', () => resolve(request.result), { once: true });
            request.addEventListener('error', () => reject(request.error), { once: true });
            request.addEventListener('blocked', () => reject(new Error('Draft database is blocked')), {
                once: true
            });
        }).catch(error => {
            this.databasePromise = null;
            console.warn('Draft storage is unavailable:', error);
            return null;
        });
        return this.databasePromise;
    }

    async load() {
        const database = await this.open();
        if (!database) return null;
        try {
            const transaction = database.transaction(STORE_NAME, 'readonly');
            return (await requestResult(transaction.objectStore(STORE_NAME).get(CURRENT_DRAFT_ID))) || null;
        } catch (error) {
            console.warn('Draft could not be loaded:', error);
            return null;
        }
    }

    async save(draft) {
        const database = await this.open();
        if (!database || !draft) return false;
        try {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const committed = transactionResult(transaction);
            await requestResult(transaction.objectStore(STORE_NAME).put({
                ...draft,
                id: CURRENT_DRAFT_ID,
                version: 1,
                savedAt: new Date().toISOString()
            }));
            await committed;
            return true;
        } catch (error) {
            console.warn('Draft could not be saved:', error);
            return false;
        }
    }

    async clear() {
        const database = await this.open();
        if (!database) return false;
        try {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const committed = transactionResult(transaction);
            await requestResult(transaction.objectStore(STORE_NAME).delete(CURRENT_DRAFT_ID));
            await committed;
            return true;
        } catch (error) {
            console.warn('Draft could not be removed:', error);
            return false;
        }
    }

    dispose() {
        this.databasePromise?.then(database => database?.close?.());
        this.databasePromise = null;
        return true;
    }
}

export { CURRENT_DRAFT_ID, DATABASE_NAME, STORE_NAME };
