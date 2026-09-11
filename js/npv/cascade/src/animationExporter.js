import { motionFrameCount } from './motion.js';

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class CascadeAnimationExporter {
    constructor({ container, status, progress, message, cancelButton, buttons, onError }) {
        this.container = container;
        this.status = status;
        this.progress = progress;
        this.message = message;
        this.cancelButton = cancelButton;
        this.buttons = buttons.filter(Boolean);
        this.onError = onError;
        this.worker = null;
        this.reject = null;
        this.restoreTimer = null;
        cancelButton?.addEventListener('click', () => this.cancel());
    }

    setBusy(busy, state = 'working') {
        this.buttons.forEach((button) => { button.disabled = busy; });
        this.container?.classList.toggle('is-exporting', busy);
        if (this.status) {
            this.status.hidden = !busy;
            this.status.dataset.state = busy ? state : 'idle';
        }
        if (this.cancelButton) this.cancelButton.hidden = state === 'complete';
    }

    update(completed, total, message) {
        const safeTotal = Math.max(1, Number(total) || 1);
        const ratio = Math.min(1, Math.max(0, Number(completed) / safeTotal));
        if (this.progress) {
            this.progress.max = safeTotal;
            this.progress.value = completed;
        }
        this.status?.style.setProperty('--progress', `${ratio * 100}%`);
        if (this.message) this.message.textContent = message;
    }

    complete(total) {
        this.update(total, total, 'Done');
        this.setBusy(true, 'complete');
        clearTimeout(this.restoreTimer);
        this.restoreTimer = setTimeout(() => this.setBusy(false), 800);
    }

    cancel() {
        if (!this.worker) return;
        const reject = this.reject;
        this.worker.terminate();
        this.worker = null;
        this.reject = null;
        this.setBusy(false);
        reject?.(new DOMException('Export cancelled.', 'AbortError'));
    }

    export({ format, settings, baseName }) {
        if (this.worker) return Promise.reject(new Error('An animation export is already running.'));
        const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const worker = new Worker(new URL('./animationExportWorker.js', import.meta.url), { type: 'module' });
        const frameCount = motionFrameCount(settings);
        this.worker = worker;
        this.setBusy(true);
        this.update(0, frameCount, 'Preparing');

        return new Promise((resolve, reject) => {
            this.reject = reject;
            const finish = (complete = false) => {
                worker.terminate();
                if (this.worker === worker) {
                    this.worker = null;
                    this.reject = null;
                    if (complete) this.complete(frameCount);
                    else this.setBusy(false);
                }
            };
            worker.addEventListener('message', (event) => {
                const result = event.data;
                if (result?.jobId !== jobId) return;
                if (result.type === 'progress') {
                    this.update(result.completed, result.total, result.message);
                    return;
                }
                if (result.type === 'complete') {
                    const blob = result.blob instanceof Blob
                        ? result.blob
                        : new Blob([result.data], { type: result.mimeType });
                    downloadBlob(blob, result.filename);
                    finish(true);
                    resolve(result.filename);
                    return;
                }
                const error = new Error(result.message || 'Animation export failed.');
                finish(false);
                this.onError?.(error);
                reject(error);
            });
            worker.addEventListener('error', (event) => {
                const error = new Error(event.message || 'Animation export worker failed.');
                finish(false);
                this.onError?.(error);
                reject(error);
            }, { once: true });
            worker.postMessage({ type: 'export', jobId, format, settings, baseName });
        });
    }
}
