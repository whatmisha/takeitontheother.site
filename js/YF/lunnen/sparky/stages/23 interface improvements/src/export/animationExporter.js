import { ANIMATION_EXPORT_FPS } from './animationExportDefaults.js';

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

export function animationResultBlob(result) {
    return result.blob instanceof Blob
        ? result.blob
        : new Blob([result.data], { type: result.mimeType });
}

export class AnimationExporter {
    constructor({ status, progress, message, cancelButton, exportButtons = [], onError } = {}) {
        this.elements = { status, progress, message, cancelButton, exportButtons };
        this.onError = onError;
        this.worker = null;
        this.jobId = null;
        this.rejectCurrent = null;
        cancelButton?.addEventListener('click', () => this.cancel());
    }

    setBusy(busy) {
        this.elements.exportButtons.forEach((button) => {
            if (button) button.disabled = busy;
        });
        if (this.elements.status) this.elements.status.hidden = !busy;
    }

    updateProgress(completed, total, message) {
        if (this.elements.progress) {
            this.elements.progress.max = Math.max(1, total);
            this.elements.progress.value = completed;
        }
        if (this.elements.message) this.elements.message.textContent = message;
    }

    cancel() {
        if (!this.worker) return;
        const reject = this.rejectCurrent;
        this.worker.terminate();
        this.worker = null;
        this.jobId = null;
        this.rejectCurrent = null;
        this.setBusy(false);
        this.updateProgress(0, 1, 'Export cancelled');
        reject?.(new DOMException('Export cancelled.', 'AbortError'));
    }

    export({ format, settings, startFocus, motionPath = null, baseName }) {
        if (this.worker) return Promise.reject(new Error('An animation export is already running.'));
        const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const worker = new Worker(
            new URL('./animationExportWorker.js?v=20260826-3', import.meta.url),
            { type: 'module' }
        );
        this.worker = worker;
        this.jobId = jobId;
        this.setBusy(true);
        this.updateProgress(
            0,
            Math.round(settings.motionDuration * ANIMATION_EXPORT_FPS),
            'Preparing animation'
        );

        return new Promise((resolve, reject) => {
            this.rejectCurrent = reject;
            const finish = () => {
                worker.terminate();
                if (this.worker === worker) {
                    this.worker = null;
                    this.jobId = null;
                    this.rejectCurrent = null;
                    this.setBusy(false);
                }
            };
            worker.addEventListener('message', (event) => {
                const result = event.data;
                if (result?.jobId !== jobId) return;
                if (result.type === 'progress') {
                    this.updateProgress(result.completed, result.total, result.message);
                    return;
                }
                if (result.type === 'complete') {
                    const blob = animationResultBlob(result);
                    downloadBlob(blob, result.filename);
                    finish();
                    resolve(result.filename);
                    return;
                }
                const error = new Error(result.message || 'Animation export failed.');
                finish();
                if (result.type !== 'cancelled') this.onError?.(error);
                reject(error);
            });
            worker.addEventListener('error', (event) => {
                const error = new Error(event.message || 'Animation export worker failed.');
                finish();
                this.onError?.(error);
                reject(error);
            }, { once: true });
            worker.postMessage({
                type: 'export',
                jobId,
                format,
                settings,
                startFocus,
                motionPath,
                baseName
            });
        });
    }
}
