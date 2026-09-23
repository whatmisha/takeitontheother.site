/** Permission must succeed before the generator enters its running state. */
export class CaptureSession {
    constructor({ mic, unlock, onReady, onStop, onStateChange = () => {} }) {
        Object.assign(this, { mic, unlock, onReady, onStop, onStateChange });
        this.epoch = 0; this.pending = null; this.running = false;
        this.phase = 'stopped';
    }
    setPhase(phase) {
        this.phase = phase;
        this.onStateChange(phase);
    }
    start() {
        if (this.running) return Promise.resolve();
        if (this.pending) return this.pending;
        const epoch = ++this.epoch;
        this.setPhase('activating-audio');
        this.pending = (async () => {
            await this.unlock();
            if (epoch !== this.epoch) return;
            this.setPhase('requesting-microphone');
            await new Promise((resolve, reject) => this.mic.start(resolve, reject));
            if (epoch !== this.epoch) { this.mic.stop(); return; }
            this.mic.amp(1);
            this.running = true;
            this.onReady();
            this.setPhase('running');
        })().catch(error => {
            if (epoch === this.epoch) { this.running = false; this.mic.stop(); this.onStop(); this.setPhase('error'); throw error; }
        }).finally(() => { this.pending = null; });
        return this.pending;
    }
    stop() {
        ++this.epoch;
        this.running = false;
        this.mic.stop();
        this.onStop();
        this.setPhase('stopped');
    }
}
