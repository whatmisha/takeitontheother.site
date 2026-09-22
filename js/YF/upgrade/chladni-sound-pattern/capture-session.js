/** Permission must succeed before the generator enters its running state. */
export class CaptureSession {
    constructor({ mic, unlock, onReady, onStop }) {
        Object.assign(this, { mic, unlock, onReady, onStop });
        this.epoch = 0; this.pending = null; this.running = false;
    }
    start() {
        if (this.running) return Promise.resolve();
        if (this.pending) return this.pending;
        const epoch = ++this.epoch;
        this.pending = (async () => {
            await this.unlock();
            if (epoch !== this.epoch) return;
            await new Promise((resolve, reject) => this.mic.start(resolve, reject));
            if (epoch !== this.epoch) { this.mic.stop(); return; }
            this.mic.amp(1);
            this.running = true;
            this.onReady();
        })().catch(error => {
            if (epoch === this.epoch) { this.running = false; this.mic.stop(); this.onStop(); throw error; }
        }).finally(() => { this.pending = null; });
        return this.pending;
    }
    stop() {
        ++this.epoch;
        this.running = false;
        this.mic.stop();
        this.onStop();
    }
}
