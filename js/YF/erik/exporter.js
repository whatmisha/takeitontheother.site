export class Exporter {
    constructor(onProgress = () => {}) { this.onProgress = onProgress; this.worker = null; }
    get busy() { return this.worker !== null; }
    run(type, settings, time) {
        if (this.busy) return Promise.reject(new Error('An export is already running.'));
        const worker = new Worker(new URL('./export-worker.js', import.meta.url), { type: 'module' });
        this.worker = worker;
        return new Promise((resolve, reject) => {
            const finish = (error, result) => {
                worker.terminate();
                if (this.worker === worker) { this.worker = null; this.cancelCurrent = null; }
                if (error) reject(error); else resolve(result);
            };
            this.cancelCurrent = () => finish(new DOMException('Export cancelled.', 'AbortError'));
            worker.onerror = event => finish(new Error(event.message || 'The export worker failed.'));
            worker.onmessage = ({ data }) => {
                if (data.type === 'progress') this.onProgress(data);
                else if (data.type === 'complete') finish(null, data);
                else if (data.type === 'error') finish(new Error(data.message));
            };
            worker.postMessage({ type, settings, time });
        });
    }
    cancel() { this.cancelCurrent?.(); }
}
export function probeVideo() {
    return new Promise(resolve => {
        const worker = new Worker(new URL('./export-worker.js', import.meta.url), { type: 'module' });
        const finish = result => { clearTimeout(timer); worker.terminate(); resolve(result); };
        const timer = setTimeout(() => finish({ supported: false, message: 'MP4 capability check timed out. Reload to retry, or export PNG.' }), 10000);
        worker.onerror = () => finish({ supported: false, message: 'MP4 is unavailable in this browser.' });
        worker.onmessage = ({ data }) => finish({ supported: data.type === 'supported', message: data.message || '' });
        worker.postMessage({ type: 'probe' });
    });
}
export function download(blob, filename) {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
