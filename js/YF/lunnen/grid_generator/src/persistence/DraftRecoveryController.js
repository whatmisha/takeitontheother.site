import { DraftStore } from './DraftStore.js';

/** Autosaves edited state and offers an explicit Restore/Discard choice on startup. */
export class DraftRecoveryController {
    constructor({
        store = new DraftStore(),
        createDraft,
        restoreDraft,
        documentRef = globalThis.document,
        windowRef = globalThis.window,
        debounceMs = 350
    } = {}) {
        this.store = store;
        this.createDraft = createDraft;
        this.restoreDraft = restoreDraft;
        this.document = documentRef;
        this.window = windowRef;
        this.debounceMs = debounceMs;
        this.timer = null;
        this.element = null;
        this.disposed = false;
        this.pendingOperation = Promise.resolve();
        this.handleViewportChange = () => this.positionAboveExports();
    }

    scheduleSave() {
        if (this.disposed) return false;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.saveNow(), this.debounceMs);
        return true;
    }

    async saveNow() {
        clearTimeout(this.timer);
        this.timer = null;
        if (this.disposed || typeof this.createDraft !== 'function') return false;
        const draft = this.createDraft();
        if (!draft) return false;
        this.pendingOperation = this.pendingOperation.then(() => this.store.save(draft));
        return this.pendingOperation;
    }

    async checkForRecovery() {
        if (this.disposed) return false;
        const draft = await this.store.load();
        if (!this.isValidDraft(draft)) return false;
        return this.present(draft);
    }

    isValidDraft(draft) {
        return Boolean(
            draft?.version === 1 &&
            draft.snapshot?.settings &&
            draft.snapshot?.document
        );
    }

    present(draft) {
        const documentRef = this.document;
        if (!documentRef?.body?.appendChild) return false;
        this.dismiss();

        const element = documentRef.createElement('section');
        element.className = 'app-notification app-draft-recovery';
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-label', 'Unsaved draft');

        const heading = documentRef.createElement('strong');
        heading.textContent = 'Unsaved draft';
        const detail = documentRef.createElement('span');
        const presetName = draft.presetName || 'Custom';
        const savedAt = this.formatTimestamp(draft.savedAt);
        detail.textContent = savedAt
            ? `${presetName} · saved ${savedAt}`
            : presetName;

        const actions = documentRef.createElement('div');
        actions.className = 'app-draft-recovery-actions';
        const restore = this.createButton('Restore', 'app-draft-restore');
        const discard = this.createButton('Discard', 'app-draft-discard');
        restore.addEventListener('click', async () => {
            restore.disabled = true;
            discard.disabled = true;
            try {
                await this.restoreDraft?.(draft);
                this.dismiss();
            } catch (error) {
                console.error('Draft recovery failed:', error);
                restore.disabled = false;
                discard.disabled = false;
            }
        });
        discard.addEventListener('click', async () => {
            restore.disabled = true;
            discard.disabled = true;
            await this.clearDraft();
        });
        actions.append(restore, discard);
        element.append(heading, detail, actions);
        documentRef.body.appendChild(element);
        this.element = element;
        this.window?.addEventListener?.('resize', this.handleViewportChange);
        this.positionAboveExports();
        return true;
    }

    positionAboveExports() {
        if (!this.element || !this.window) return false;
        const exportControls = this.document?.querySelector?.('.bottom-buttons');
        const controlsRect = exportControls?.getBoundingClientRect?.();
        if (!controlsRect) return false;
        const rootStyles = this.window.getComputedStyle?.(this.document.documentElement);
        const gap = Number.parseFloat(rootStyles?.getPropertyValue('--spacing-lg')) || 8;
        const bottom = Math.max(gap, this.window.innerHeight - controlsRect.top + gap);
        this.element.style.bottom = `${bottom}px`;
        return true;
    }

    createButton(label, className) {
        const button = this.document.createElement('button');
        button.type = 'button';
        button.className = `app-draft-action ${className}`;
        button.textContent = label;
        return button;
    }

    formatTimestamp(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    }

    dismiss() {
        this.window?.removeEventListener?.('resize', this.handleViewportChange);
        this.element?.remove();
        this.element = null;
    }

    async clearDraft() {
        clearTimeout(this.timer);
        this.timer = null;
        this.pendingOperation = this.pendingOperation.then(() => this.store.clear());
        const cleared = await this.pendingOperation;
        this.dismiss();
        return cleared;
    }

    dispose() {
        if (this.disposed) return false;
        clearTimeout(this.timer);
        this.timer = null;
        this.dismiss();
        void this.pendingOperation.finally(() => this.store.dispose?.());
        this.disposed = true;
        return true;
    }
}
